const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Manual QR Payment & Admin Verification Workflow Test Suite', () => {
  let testOrder;
  const adminToken = 'test_token_admin_lane4swim_in';

  beforeAll(async () => {
    await seedService.seedAll();

    // Create a test order
    const prodRes = await request(app).get('/api/products/lycra-training-cap');
    const product = prodRes.body.data;

    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerEmail: 'swimtest@lane4swim.in',
        shippingAddress: {
          addressee: 'Test Swimmer',
          addressLine1: 'Civil Lines',
          city: 'Nagpur',
          state: 'Maharashtra',
          postalCode: '440001'
        },
        items: [{
          productId: product.id,
          variantId: product.variants[0].variantId,
          quantity: 1
        }]
      });

    testOrder = orderRes.body.data;
  });

  test('GET /api/payments/settings returns public store UPI VPA and instructions', async () => {
    const res = await request(app).get('/api/payments/settings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('upiId');
    expect(res.body.data).toHaveProperty('upiAccountName');
    expect(res.body.data).toHaveProperty('qrCodeUrl');
  });

  test('POST /api/payments/proof rejects missing screenshot or short UTR', async () => {
    // Missing file
    const noFileRes = await request(app)
      .post('/api/payments/proof')
      .field('orderId', testOrder.orderId)
      .field('upiReferenceNumber', '123456789012');

    expect(noFileRes.status).toBe(400);

    // Invalid UTR length
    const shortUtrRes = await request(app)
      .post('/api/payments/proof')
      .field('orderId', testOrder.orderId)
      .field('upiReferenceNumber', '123')
      .attach('screenshot', Buffer.from('fake-image-bytes'), 'receipt.jpg');

    expect(shortUtrRes.status).toBe(400); // Validation error (HTTP 400 Bad Request)
  });

  test('POST /api/payments/proof accepts valid screenshot and transitions order to verification_pending', async () => {
    const res = await request(app)
      .post('/api/payments/proof')
      .field('orderId', testOrder.orderId)
      .field('upiReferenceNumber', '987654321098')
      .attach('screenshot', Buffer.from('fake-jpeg-content'), 'payment_screenshot.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('verification_pending');
    expect(res.body.data.orderStatus).toBe('payment_verification');
  });

  test('Admin payment verification cycle: rejection with feedback, followed by resubmission & approval', async () => {
    // 1. Fetch pending payments as Admin
    const pendingRes = await request(app)
      .get('/api/admin/payments?status=verification_pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pendingRes.status).toBe(200);
    const payment = pendingRes.body.data.find(p => p.orderId === testOrder.orderId);
    expect(payment).toBeDefined();

    // 2. Reject payment (e.g. blurred screenshot)
    const rejectRes = await request(app)
      .post(`/api/admin/payments/${payment.paymentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Screenshot unreadable. Please re-upload with clear UTR.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');

    // 3. Customer resubmits proof
    const resubmitRes = await request(app)
      .post('/api/payments/proof')
      .field('orderId', testOrder.orderId)
      .field('upiReferenceNumber', '987654321099') // corrected UTR
      .attach('screenshot', Buffer.from('valid-clear-jpeg'), 'clear_receipt.jpg');

    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.data.paymentStatus).toBe('verification_pending');

    // 4. Admin approves payment
    const approveRes = await request(app)
      .post(`/api/admin/payments/${payment.paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ internalNote: 'Confirmed credit in HDFC account.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('verified');
    expect(approveRes.body.data.orderStatus).toBe('confirmed');

    // 5. Verify order is now confirmed
    const orderCheck = await request(app).get(`/api/orders/${testOrder.orderId}`);
    expect(orderCheck.body.data.paymentStatus).toBe('verified');
    expect(orderCheck.body.data.status).toBe('confirmed');
  });

  test('Admin can upload UPI QR image and update payment settings', async () => {
    // 1. Upload QR image
    const uploadRes = await request(app)
      .post('/api/admin/store/payment-settings/qr-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('qrImage', Buffer.from('fake-qr-code-png-data'), 'test-qr.png');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data).toHaveProperty('qrCodeUrl');
    const uploadedQrUrl = uploadRes.body.data.qrCodeUrl;

    // 2. Verify settings update
    const patchRes = await request(app)
      .patch('/api/admin/store/payment-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        upiId: 'customstore@upi',
        merchantName: 'LANE4 AQUATICS STORE'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.upiId).toBe('customstore@upi');
    expect(patchRes.body.data.merchantName).toBe('LANE4 AQUATICS STORE');

    // 3. Verify public settings reflect the uploaded QR and updated VPA
    const publicRes = await request(app).get('/api/payments/settings');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.upiId).toBe('customstore@upi');
    expect(publicRes.body.data.merchantName).toBe('LANE4 AQUATICS STORE');
    expect(publicRes.body.data.qrCodeUrl).toBe(uploadedQrUrl);
  });
});

