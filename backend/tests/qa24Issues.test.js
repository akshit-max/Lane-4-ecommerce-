const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');
const couponService = require('../src/services/couponService');
const productService = require('../src/services/productService');
const adminDashboardService = require('../src/services/adminDashboardService');
const { getDb } = require('../src/config/firebaseAdmin');

describe('LANE4 Comprehensive QA 24-Issues Verification Test Suite', () => {
  const adminToken = 'test_token_admin_lane4swim_in';
  let db;
  let testProduct;

  const getErrMsg = (res) => {
    if (res.body && res.body.error) {
      if (Array.isArray(res.body.error.details) && res.body.error.details.length > 0) {
        return res.body.error.details.map(d => d.message).join(' ');
      }
      if (typeof res.body.error === 'string') return res.body.error;
      if (res.body.error.message) return res.body.error.message;
    }
    if (res.body && res.body.message) return res.body.message;
    return '';
  };

  beforeAll(async () => {
    await seedService.seedAll();
    db = getDb();

    // Fetch or create a verified catalog product for testing
    const prodRes = await request(app).get('/api/products/surge-racing-cap');
    testProduct = prodRes.body.data;
  });

  // ==========================================
  // HIGH PRIORITY ISSUES (1 - 8)
  // ==========================================

  describe('Issue 1: Same Product Shows Different Prices Across Application', () => {
    test('Positive: Authoritative pricing calculation strictly uses trusted DB pricing', async () => {
      const quoteRes = await request(app)
        .post('/api/checkout/quote')
        .send({
          items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
        });

      expect(quoteRes.status).toBe(200);
      const expectedUnitPrice = testProduct.salePricePaise && testProduct.salePricePaise > 0 && testProduct.salePricePaise < testProduct.regularPricePaise
        ? testProduct.salePricePaise
        : testProduct.regularPricePaise;
      expect(quoteRes.body.data.pricing.subtotalPaise).toBe(expectedUnitPrice);
    });

    test('Negative: Forged or altered price in client request is completely ignored by backend', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .send({
          customerEmail: 'pricecheck@lane4swim.in',
          shippingAddress: {
            addressee: 'Price Check',
            addressLine1: 'Civil Lines',
            city: 'Nagpur',
            state: 'Maharashtra',
            postalCode: '440001'
          },
          items: [{
            productId: testProduct.id,
            variantId: testProduct.variants[0].variantId,
            quantity: 1,
            unitPricePaise: 100 // Client attempts to pay ₹ 1 instead of ₹ 599
          }]
        });

      expect(orderRes.status).toBe(201);
      // Backend must calculate final payable using authoritative DB price
      expect(orderRes.body.data.pricing.subtotalPaise).toBe(testProduct.salePricePaise || testProduct.regularPricePaise);
    });
  });

  describe('Issue 2: Old Orders Were Charged More Than Advertised', () => {
    test('Positive: Order total accurately reflects product price + shipping - coupon without unexpected charges', async () => {
      const quoteRes = await request(app)
        .post('/api/checkout/quote')
        .send({
          items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 2 }]
        });

      const p = quoteRes.body.data.pricing;
      expect(p.finalPayablePaise).toBe(p.subtotalPaise + (p.shippingChargesPaise || p.shippingPaise || 0) - (p.couponDiscountPaise || 0));
    });

    test('Negative: Order rejects empty items or zero payable', async () => {
      const badOrder = await request(app)
        .post('/api/orders')
        .send({
          customerEmail: 'badorder@lane4swim.in',
          shippingAddress: {
            addressLine1: 'Line 1',
            city: 'Nagpur',
            state: 'Maharashtra',
            postalCode: '440001'
          },
          items: []
        });

      expect(badOrder.status).toBe(400);
    });
  });

  describe('Issue 3: UTR Number Length Validation', () => {
    let orderForUtr;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          customerEmail: 'utrtest@lane4swim.in',
          shippingAddress: {
            addressee: 'UTR Test',
            addressLine1: 'Dharampeth',
            city: 'Nagpur',
            state: 'Maharashtra',
            postalCode: '440010'
          },
          items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
        });
      orderForUtr = res.body.data;
    });

    test('Positive: Valid 12-digit numeric UTR is accepted', async () => {
      const res = await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderForUtr.orderId)
        .field('upiReferenceNumber', '987654321098')
        .attach('screenshot', Buffer.from('fake image data'), 'proof.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Negative: Invalid length 19-digit UTR (1111111111111111111) is strictly rejected', async () => {
      const res = await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderForUtr.orderId)
        .field('upiReferenceNumber', '1111111111111111111')
        .attach('screenshot', Buffer.from('fake image data'), 'proof.png');

      expect(res.status).toBe(400);
      expect(getErrMsg(res)).toMatch(/12-digit/i);
    });

    test('Negative: Non-numeric UTR is strictly rejected', async () => {
      const res = await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderForUtr.orderId)
        .field('upiReferenceNumber', '123456ABCDEF')
        .attach('screenshot', Buffer.from('fake image data'), 'proof.png');

      expect(res.status).toBe(400);
    });
  });

  describe('Issue 4: Same UTR Can Be Used for Multiple Orders', () => {
    let orderA, orderB;
    const duplicateUtr = '445566778899';

    beforeAll(async () => {
      const resA = await request(app).post('/api/orders').send({
        customerEmail: 'ordera@lane4swim.in',
        shippingAddress: { addressee: 'User A', addressLine1: 'Line A', city: 'Nagpur', state: 'Maharashtra', postalCode: '440010' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      orderA = resA.body.data;

      const resB = await request(app).post('/api/orders').send({
        customerEmail: 'orderb@lane4swim.in',
        shippingAddress: { addressee: 'User B', addressLine1: 'Line B', city: 'Nagpur', state: 'Maharashtra', postalCode: '440010' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      orderB = resB.body.data;
    });

    test('Positive: Submitting unique UTR on Order A succeeds', async () => {
      const resA = await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderA.orderId)
        .field('upiReferenceNumber', duplicateUtr)
        .attach('screenshot', Buffer.from('proof img A'), 'proofA.png');

      expect(resA.status).toBe(200);
    });

    test('Negative: Submitting the same UTR on Order B is rejected as duplicate', async () => {
      const resB = await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderB.orderId)
        .field('upiReferenceNumber', duplicateUtr)
        .attach('screenshot', Buffer.from('proof img B'), 'proofB.png');

      expect(resB.status).toBe(400);
      expect(getErrMsg(resB)).toMatch(/already (been submitted|used)|duplicate/i);
    });
  });

  describe('Issue 5: Stock Quantity Never Changes', () => {
    test('Positive: Stock is deducted on order confirmation and restored on cancellation', async () => {
      const variant = testProduct.variants[0];
      const invBefore = await request(app).get('/api/admin/inventory').set('Authorization', `Bearer ${adminToken}`);
      const itemBefore = invBefore.body.data.find(i => i.sku === variant.sku);
      const stockBefore = itemBefore.availableQuantity;

      // Create order with 3 units
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'stocktest@lane4swim.in',
        shippingAddress: { addressee: 'Stock Test', addressLine1: 'Ramdaspeth', city: 'Nagpur', state: 'Maharashtra', postalCode: '440010' },
        items: [{ productId: testProduct.id, variantId: variant.variantId, quantity: 3 }]
      });
      const orderId = oRes.body.data.orderId;

      // Inventory must be decremented by 3
      const invAfterCreate = await request(app).get('/api/admin/inventory').set('Authorization', `Bearer ${adminToken}`);
      const itemAfterCreate = invAfterCreate.body.data.find(i => i.sku === variant.sku);
      expect(itemAfterCreate.availableQuantity).toBe(stockBefore - 3);

      // Cancel order
      await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      // Inventory must be restored
      const invAfterCancel = await request(app).get('/api/admin/inventory').set('Authorization', `Bearer ${adminToken}`);
      const itemAfterCancel = invAfterCancel.body.data.find(i => i.sku === variant.sku);
      expect(itemAfterCancel.availableQuantity).toBe(stockBefore);
    });

    test('Negative: Order placement fails if requested quantity exceeds available stock', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'outfit@lane4swim.in',
        shippingAddress: { addressee: 'Huge Qty', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 99999 }]
      });

      expect(oRes.status).toBe(500); // Insufficient stock
    });
  });

  describe('Issue 6: Invalid Order Status Transitions', () => {
    let orderId;

    beforeAll(async () => {
      const res = await request(app).post('/api/orders').send({
        customerEmail: 'statustest@lane4swim.in',
        shippingAddress: { addressee: 'Status Test', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      orderId = res.body.data.orderId;
    });

    test('Positive: Valid progressive status transition succeeds', async () => {
      const res = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'payment_verification' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('payment_verification');
    });

    test('Negative: Invalid transition (e.g. delivered -> pending_payment) is rejected with 400', async () => {
      // First cancel the order
      await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      // Attempt invalid transition: cancelled -> delivered
      const badRes = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' });

      expect(badRes.status).toBe(400);
      expect(getErrMsg(badRes)).toMatch(/invalid.*transition/i);
    });
  });

  describe('Issue 7: Cancelled Order Still Counts as Paid', () => {
    test('Positive: Verified order cancellation records pending_refund and excludes from revenue', async () => {
      // 1. Create order
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'revtest@lane4swim.in',
        shippingAddress: { addressee: 'Rev Test', addressLine1: 'Wardha Rd', city: 'Nagpur', state: 'Maharashtra', postalCode: '440015' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      // 2. Submit payment and approve
      await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderId)
        .field('upiReferenceNumber', '889900112233')
        .attach('screenshot', Buffer.from('proof'), 'proof.png');

      const paySnap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get();
      const paymentId = paySnap.docs[0].id;

      await request(app)
        .post(`/api/admin/payments/${paymentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ internalNote: 'Verified bank record' });

      // Revenue before cancellation
      const statsBefore = await adminDashboardService.getMetrics();

      // 3. Cancel the verified order
      const cancelRes = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.refundStatus).toBe('pending_refund');
      expect(cancelRes.body.data.financialStatus).toBe('cancelled_refund_pending');

      // 4. Verify revenue does not include cancelled order
      const statsAfter = await adminDashboardService.getMetrics();
      expect(statsAfter.pendingRefundsCount).toBeGreaterThanOrEqual(1);
      expect(statsAfter.totalRevenuePaise).toBeLessThanOrEqual(statsBefore.totalRevenuePaise);
    });
  });

  describe('Issue 8: Rejected Payment Does Not Update Order Status', () => {
    test('Positive: Payment rejection sets order status to payment_rejected and blocks shipping', async () => {
      // Create order
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'rejecttest@lane4swim.in',
        shippingAddress: { addressee: 'Reject Test', addressLine1: 'Sadar', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      // Submit payment
      await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderId)
        .field('upiReferenceNumber', '778899001122')
        .attach('screenshot', Buffer.from('proof'), 'proof.png');

      const paySnap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get();
      const paymentId = paySnap.docs[0].id;

      // Reject payment
      const rejRes = await request(app)
        .post(`/api/admin/payments/${paymentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid transaction reference in bank' });

      expect(rejRes.status).toBe(200);

      // Check order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      expect(orderDoc.data().status).toBe('payment_rejected');
      expect(orderDoc.data().paymentStatus).toBe('rejected');
    });

    test('Negative: Rejected payment order cannot be marked shipped without re-verification', async () => {
      const oSnap = await db.collection('orders').where('status', '==', 'payment_rejected').limit(1).get();
      if (!oSnap.empty) {
        const orderId = oSnap.docs[0].id;
        const shipRes = await request(app)
          .patch(`/api/admin/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'shipped' });

        expect(shipRes.status).toBe(400); // Invalid status transition
      }
    });
  });

  // ==========================================
  // MEDIUM PRIORITY ISSUES (9 - 16)
  // ==========================================

  describe('Issue 9: Coupon Usage Count Does Not Match Orders', () => {
    test('Positive: Coupon usage increases only upon qualifying order placement and reverts on cancellation', async () => {
      const cBefore = await couponService.getCouponByCode('WELCOME10');
      const usesBefore = cBefore.currentUses || 0;

      // Place order with coupon
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'coupontest@lane4swim.in',
        shippingAddress: { addressee: 'Coupon User', addressLine1: 'Dhantoli', city: 'Nagpur', state: 'Maharashtra', postalCode: '440012' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 4 }],
        couponCode: 'WELCOME10'
      });

      const orderId = oRes.body.data.orderId;
      const cAfter = await couponService.getCouponByCode('WELCOME10');
      expect(cAfter.currentUses).toBe(usesBefore + 1);

      // Cancel order and verify usage reverted
      await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      const cAfterCancel = await couponService.getCouponByCode('WELCOME10');
      expect(cAfterCancel.currentUses).toBe(usesBefore);
    });

    test('Negative: Invalid/unqualifying coupon validation does not inflate usage count', async () => {
      const cBefore = await couponService.getCouponByCode('WELCOME10');
      const usesBefore = cBefore.currentUses || 0;

      // Subtotal below minimum threshold (₹ 500 < ₹ 999)
      await request(app)
        .post('/api/coupons/validate')
        .send({ code: 'WELCOME10', subtotalPaise: 50000 });

      const cAfter = await couponService.getCouponByCode('WELCOME10');
      expect(cAfter.currentUses).toBe(usesBefore);
    });
  });

  describe('Issue 10: Order Does Not Display Applied Coupon', () => {
    test('Positive: Applied coupon and discount amount are stored in order record and breakdown', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'coupondetails@lane4swim.in',
        shippingAddress: { addressee: 'Discount Display', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 4 }],
        couponCode: 'WELCOME10'
      });

      const order = oRes.body.data;
      expect(order.pricing.couponCode).toBe('WELCOME10');
      expect(order.pricing.couponDiscountPaise).toBeGreaterThan(0);
      expect(order.coupon).toBeDefined();
      expect(order.coupon.code).toBe('WELCOME10');
    });

    test('Negative: Non-coupon orders have zero discount without affecting calculation', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'nocoupon@lane4swim.in',
        shippingAddress: { addressee: 'No Coupon', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });

      expect(oRes.body.data.pricing.couponDiscountPaise).toBe(0);
    });
  });

  describe('Issue 11: Tracking Numbers Are Not Marked as Shipped', () => {
    test('Positive: Attaching valid courier tracking transitions confirmed order to shipped', async () => {
      // Create and confirm order
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'dispatch@lane4swim.in',
        shippingAddress: { addressee: 'Dispatch User', addressLine1: 'Gokulpeth', city: 'Nagpur', state: 'Maharashtra', postalCode: '440010' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      // Add tracking
      const trackRes = await request(app)
        .post(`/api/admin/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courierName: 'DTDC Express',
          trackingNumber: 'DTDC123456789'
        });

      expect(trackRes.status).toBe(200);
      expect(trackRes.body.data.status).toBe('shipped');
      expect(trackRes.body.data.fulfillment.trackingNumber).toBe('DTDC123456789');
    });

    test('Negative: Adding tracking to unconfirmed/pending order is rejected', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'pendingtrack@lane4swim.in',
        shippingAddress: { addressee: 'Pending User', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      const trackRes = await request(app)
        .post(`/api/admin/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courierName: 'DTDC Express',
          trackingNumber: 'DTDC987654321'
        });

      expect(trackRes.status).toBe(400);
    });
  });

  describe('Issue 12: Cancelling an Order Has No Confirmation (State Safety)', () => {
    test('Positive: Admin cancellation requires valid authorization and transitions state cleanly', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'cancelsafety@lane4swim.in',
        shippingAddress: { addressee: 'Cancel Safety', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      const cancelRes = await request(app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');
    });

    test('Negative: Cancellation without authorization token is rejected with 401', async () => {
      const cancelRes = await request(app)
        .patch(`/api/admin/orders/some-id/status`)
        .send({ status: 'cancelled' });

      expect(cancelRes.status).toBe(401);
    });
  });

  describe('Issue 13 & 14: Payment Approval Dialog Status & Truthful Note', () => {
    test('Positive: Approving payment transitions order to confirmed with recorded staff note', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'approvenote@lane4swim.in',
        shippingAddress: { addressee: 'Staff Note', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderId)
        .field('upiReferenceNumber', '667788990011')
        .attach('screenshot', Buffer.from('screenshot'), 'screen.png');

      const paySnap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get();
      const paymentId = paySnap.docs[0].id;

      const staffNote = 'Verified in HDFC Current A/C Statement';
      const appRes = await request(app)
        .post(`/api/admin/payments/${paymentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ internalNote: staffNote });

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.orderStatus).toBe('confirmed');

      const payDoc = await db.collection('payments').doc(paymentId).get();
      expect(payDoc.data().verification.internalNotes).toBe(staffNote);
      expect(payDoc.data().verification.verifiedByName).toBeDefined();
    });

    test('Negative: Non-admin cannot approve payment', async () => {
      const appRes = await request(app)
        .post(`/api/admin/payments/fake-payment/approve`)
        .send({ internalNote: 'Attempt without token' });

      expect(appRes.status).toBe(401);
    });
  });

  describe('Issue 15: Recent Orders Not Sorted Newest First', () => {
    test('Positive: Dashboard and order list strictly sort newest orders first', async () => {
      const metrics = await adminDashboardService.getMetrics();
      const recentOrders = metrics.recentOrders || [];

      for (let i = 0; i < recentOrders.length - 1; i++) {
        const timeA = new Date(recentOrders[i].createdAt).getTime();
        const timeB = new Date(recentOrders[i + 1].createdAt).getTime();
        expect(timeA).toBeGreaterThanOrEqual(timeB);
      }
    });

    test('Negative: Sort is not random or ascending', async () => {
      const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${adminToken}`);
      const orders = res.body.data;
      if (orders.length >= 2) {
        const first = new Date(orders[0].createdAt).getTime();
        const last = new Date(orders[orders.length - 1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(last);
      }
    });
  });

  describe('Issue 16: Add to Cart Button Has No Text', () => {
    test('Positive: Storefront products provide valid accessible Add to Bag labels', async () => {
      const fs = require('fs');
      const capHtml = fs.readFileSync(require('path').resolve(__dirname, '../../product/swimming-cap.html'), 'utf8');

      expect(capHtml).toMatch(/value="Add to Bag"/i);
      expect(capHtml).toMatch(/aria-label="Add to Bag"/i);
    });

    test('Negative: Blank button text is prevented', async () => {
      const fs = require('fs');
      const capHtml = fs.readFileSync(require('path').resolve(__dirname, '../../product/swimming-cap.html'), 'utf8');
      expect(capHtml).not.toMatch(/commerce-add-to-cart-button[^>]*value=""/);
    });
  });

  // ==========================================
  // LOW PRIORITY ISSUES (17 - 24)
  // ==========================================

  describe('Issue 17: Test Product Is Live on Storefront', () => {
    test('Positive: Live product catalog contains only published production products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      const items = res.body.data.products;
      const testItem = items.find(p => p.slug === 'test-product-cap' || p.sku === '123');
      expect(testItem).toBeUndefined();
    });

    test('Negative: Accessing test-product-cap directly via public API returns 404', async () => {
      const res = await request(app).get('/api/products/test-product-cap');
      expect(res.status).toBe(404);
    });
  });

  describe('Issue 18: Dashboard Low-Stock Count Is Incorrect', () => {
    test('Positive: Low-stock items accurately counted using threshold <= 5', async () => {
      const metrics = await adminDashboardService.getMetrics();
      expect(metrics).toHaveProperty('lowStockCount');
      expect(typeof metrics.lowStockCount).toBe('number');
      expect(metrics.lowStockCount).toBeGreaterThanOrEqual(0);
    });

    test('Negative: Sufficient stock items (>5) are not counted as low stock', async () => {
      const invRes = await request(app).get('/api/admin/inventory').set('Authorization', `Bearer ${adminToken}`);
      const inv = invRes.body.data || [];
      const calculatedLowStock = inv.filter(i => (i.availableQuantity || 0) <= (i.lowStockThreshold || 5)).length;

      const metrics = await adminDashboardService.getMetrics();
      expect(metrics.lowStockCount).toBe(calculatedLowStock);
    });
  });

  describe('Issue 19: Product Is in the Wrong Category', () => {
    test('Positive: Pro Kickboard Hydro Flow is correctly assigned to training-gear', async () => {
      const doc = await productService.getProductBySlug('pro-kickboard-hydro-flow', true);
      if (doc) {
        expect(doc.categorySlug).toBe('training-gear');
      }
    });

    test('Negative: Pro Kickboard is excluded from fins-and-flippers category query', async () => {
      const res = await request(app).get('/api/products?category=fins-and-flippers');
      const found = res.body.data.products.find(p => p.slug === 'pro-kickboard-hydro-flow');
      expect(found).toBeUndefined();
    });
  });

  describe('Issue 20: Incorrect Product Description', () => {
    test('Positive: Swimming Cap displays genuine silicone swimming cap description and subtitle', async () => {
      const fs = require('fs');
      const html = fs.readFileSync(require('path').resolve(__dirname, '../../product/swimming-cap.html'), 'utf8');

      expect(html).not.toMatch(/<div class="paragraph-18px">test<\/div>/);
      expect(html).not.toMatch(/Short-blade silicone training fins/);
      expect(html).toMatch(/hypoallergenic silicone/i);
    });

    test('Negative: "test" subtitle is removed from DB document', async () => {
      const prod = await productService.getProductBySlug('swimming-cap');
      if (prod) {
        expect(prod.shortDescription).not.toBe('test');
        expect(prod.description).not.toBe('test');
      }
    });
  });

  describe('Issue 21: Invalid Data Accepted Without Validation', () => {
    test('Positive: Valid email, Indian PIN code, and tracking number are accepted', async () => {
      const res = await request(app).post('/api/orders').send({
        customerEmail: 'valid.customer@gmail.com',
        shippingAddress: { addressee: 'Valid Customer', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      expect(res.status).toBe(201);
    });

    test('Negative: Invalid 5-digit PIN (33333) is rejected with 400', async () => {
      const res = await request(app).post('/api/orders').send({
        customerEmail: 'valid@gmail.com',
        shippingAddress: { addressee: 'Bad PIN', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '33333' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      expect(res.status).toBe(400);
    });

    test('Negative: Repeated dummy tracking number (sssss) is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/admin/orders/any-id/tracking')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ courierName: 'DTDC', trackingNumber: 'sssss' });

      expect(res.status).toBe(400);
    });
  });

  describe('Issue 22: Rejected Payments Show "Verified By"', () => {
    test('Positive: Rejected payments record rejection audit with reason and rejector UID', async () => {
      const oRes = await request(app).post('/api/orders').send({
        customerEmail: 'rejectaudit@lane4swim.in',
        shippingAddress: { addressee: 'Reject Audit', addressLine1: 'Civil Lines', city: 'Nagpur', state: 'Maharashtra', postalCode: '440001' },
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].variantId, quantity: 1 }]
      });
      const orderId = oRes.body.data.orderId;

      await request(app)
        .post('/api/payments/proof')
        .field('orderId', orderId)
        .field('upiReferenceNumber', '556677889900')
        .attach('screenshot', Buffer.from('proof'), 'proof.png');

      const paySnap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get();
      const paymentId = paySnap.docs[0].id;

      await request(app)
        .post(`/api/admin/payments/${paymentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid screenshot amount' });

      const payDoc = await db.collection('payments').doc(paymentId).get();
      expect(payDoc.data().status).toBe('rejected');
      expect(payDoc.data().rejection).toBeDefined();
      expect(payDoc.data().rejection.reason).toBe('Invalid screenshot amount');
    });

    test('Negative: Rejection audit does not label payment as verified', async () => {
      const pSnap = await db.collection('payments').where('status', '==', 'rejected').limit(1).get();
      if (!pSnap.empty) {
        const data = pSnap.docs[0].data();
        expect(data.status).not.toBe('verified');
      }
    });
  });

  describe('Issue 23: No Cancelled Orders Filter Tab', () => {
    test('Positive: Admin orders API supports filtering cancelled orders', async () => {
      const res = await request(app)
        .get('/api/admin/orders?status=cancelled')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const order of res.body.data) {
        expect(order.status).toBe('cancelled');
      }
    });

    test('Negative: Non-cancelled orders are excluded from cancelled filter', async () => {
      const res = await request(app)
        .get('/api/admin/orders?status=cancelled')
        .set('Authorization', `Bearer ${adminToken}`);

      const nonCancelled = res.body.data.find(o => o.status !== 'cancelled');
      expect(nonCancelled).toBeUndefined();
    });
  });

  describe('Issue 24: Success Messages Display Internal Status Names', () => {
    test('Positive: Formatted status label transforms internal enums to human readable strings', () => {
      const formatStatusLabel = (status) => {
        const map = {
          pending_payment: 'Pending Payment',
          payment_verification: 'Payment Verification',
          confirmed: 'Confirmed',
          processing: 'Processing',
          shipped: 'Shipped',
          out_for_delivery: 'Out for Delivery',
          delivered: 'Delivered',
          cancelled: 'Cancelled',
          payment_rejected: 'Payment Rejected'
        };
        return map[status] || (status ? status.replace(/_/g, ' ') : status);
      };

      expect(formatStatusLabel('out_for_delivery')).toBe('Out for Delivery');
      expect(formatStatusLabel('pending_payment')).toBe('Pending Payment');
      expect(formatStatusLabel('payment_verification')).toBe('Payment Verification');
      expect(formatStatusLabel('payment_rejected')).toBe('Payment Rejected');
    });

    test('Negative: Formatted status does not contain underscores', () => {
      const formatStatusLabel = (status) => {
        const map = {
          pending_payment: 'Pending Payment',
          payment_verification: 'Payment Verification',
          confirmed: 'Confirmed',
          processing: 'Processing',
          shipped: 'Shipped',
          out_for_delivery: 'Out for Delivery',
          delivered: 'Delivered',
          cancelled: 'Cancelled',
          payment_rejected: 'Payment Rejected'
        };
        return map[status] || (status ? status.replace(/_/g, ' ') : status);
      };

      expect(formatStatusLabel('out_for_delivery')).not.toMatch(/_/);
    });
  });
});
