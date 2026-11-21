const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Full 28-Step End-to-End E-Commerce Customer & Admin Lifecycle Suite', () => {
  let guestId = `guest_e2e_${Date.now()}`;
  let adminToken = 'test_token_admin_lane4swim_in';
  let customerToken = 'test_token_e2e_swimmer_nagpur';
  let category;
  let product;
  let variant;
  let cart;
  let order;
  let paymentId;
  let reviewId;

  beforeAll(async () => {
    await seedService.seedAll();
  });

  // Step 1: Storefront configuration
  test('Step 1: Customer fetches public configuration (store info, contact, UPI)', async () => {
    const res = await request(app).get('/api/public-config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.storeName).toBe('The Lane4 Performance Store');
    expect(res.body.data.city).toBe('Nagpur');
    expect(res.body.data.paymentSettings.upiId).toBe('lane4swim@upi');
  });

  // Step 2: List categories
  test('Step 2: Customer browses categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    category = res.body.data.find(c => c.slug === 'racing-caps') || res.body.data[0];
    expect(category).toBeDefined();
  });

  // Step 3: Browse catalog
  test('Step 3: Customer browses product catalog', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });

  // Step 4: View single product details
  test('Step 4: Customer views detailed product page by slug', async () => {
    const res = await request(app).get('/api/products/mirror-racing-goggles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    product = res.body.data;
    expect(product.slug).toBe('mirror-racing-goggles');
    expect(product.variants.length).toBeGreaterThan(0);
  });

  // Step 5: Select variant & inspect stock
  test('Step 5: Customer selects specific variant and inspects stock availability', async () => {
    variant = product.variants[0];
    expect(variant).toBeDefined();
    expect(product.salePricePaise || product.regularPricePaise).toBeGreaterThan(0);
    expect(variant.stockQuantity).toBeGreaterThanOrEqual(1);
  });

  // Step 6: Add variant item to cart
  test('Step 6: Customer adds selected variant to cart', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('x-guest-id', guestId)
      .send({
        productId: product.id,
        variantId: variant.variantId,
        quantity: 2
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    cart = res.body.data;
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].quantity).toBe(2);
  });

  // Step 7: Update quantity in cart drawer
  test('Step 7: Customer updates item quantity in cart drawer', async () => {
    const itemId = cart.items[0].itemId || cart.items[0].id;
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('x-guest-id', guestId)
      .send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(1);
    cart = res.body.data;
  });

  // Step 8: Checkout quote without coupon
  test('Step 8: Customer requests checkout quote with Nagpur shipping address', async () => {
    const res = await request(app)
      .post('/api/checkout/quote')
      .set('x-guest-id', guestId)
      .send({
        items: [{
          productId: product.id,
          variantId: variant.variantId,
          quantity: 1
        }],
        postalCode: '440001'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.pricing.subtotalPaise).toBe(product.salePricePaise || product.regularPricePaise);
    expect(res.body.data.pricing.shippingChargesPaise).toBe(9900); // Below ₹1,999 free shipping threshold
  });

  // Step 9: Apply coupon code
  test('Step 9: Customer applies WELCOME10 coupon to checkout quote', async () => {
    const res = await request(app)
      .post('/api/checkout/quote')
      .set('x-guest-id', guestId)
      .send({
        items: [{
          productId: product.id,
          variantId: variant.variantId,
          quantity: 1
        }],
        postalCode: '440001',
        couponCode: 'WELCOME10'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.pricing.couponDiscountPaise).toBeGreaterThan(0);
    expect(res.body.data.pricing.couponCode).toBe('WELCOME10');
    expect(res.body.data.pricing.finalPayablePaise).toBe(
      res.body.data.pricing.subtotalPaise - res.body.data.pricing.couponDiscountPaise + res.body.data.pricing.shippingChargesPaise
    );
  });

  // Step 10: Place order
  test('Step 10: Customer places order, securing stock reservation and order ID', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-guest-id', guestId)
      .send({
        customerEmail: 'arjun.swimmer@nagpurswimming.org',
        customerPhone: '+919422113355',
        shippingAddress: {
          addressee: 'Arjun Swimmer',
          phone: '+919422113355',
          addressLine1: 'Civil Lines, Near NIT Swimming Pool',
          city: 'Nagpur',
          state: 'Maharashtra',
          postalCode: '440001',
          country: 'India'
        },
        items: [{
          productId: product.id,
          variantId: variant.variantId,
          quantity: 1
        }],
        couponCode: 'WELCOME10'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    order = res.body.data;
    expect(order.orderNumber).toMatch(/^L4-\d{2}-\d{4}$/);
    expect(order.orderStatus).toBe('pending_payment');
    expect(order.paymentStatus).toBe('awaiting_payment');
  });

  // Step 11: Inventory locked check
  test('Step 11: System locks inventory stock for the reserved order', async () => {
    const invRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    const inv = invRes.body.data.find(i => i.sku === variant.sku);
    expect(inv.availableQuantity).toBe(variant.stockQuantity - 1);
    expect(inv.reservedQuantity).toBe(1);
  });

  // Step 12: Customer views store payment instructions
  test('Step 12: Customer fetches payment instructions and store UPI VPA', async () => {
    const res = await request(app).get('/api/payments/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.upiId).toBe('lane4swim@upi');
    expect(res.body.data.paymentInstructions).toBeDefined();
  });

  // Step 13: Customer submits payment proof
  test('Step 13: Customer uploads UPI transaction screenshot and 12-digit UTR', async () => {
    const res = await request(app)
      .post('/api/payments/proof')
      .field('orderId', order.orderId)
      .field('upiReferenceNumber', '987654321012')
      .attach('screenshot', Buffer.from('mock-payment-receipt-content'), 'receipt.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('verification_pending');
    expect(res.body.data.orderStatus).toBe('payment_verification');
    paymentId = res.body.data.paymentId;
  });

  // Step 14: Customer polls order payment status
  test('Step 14: Customer verifies order payment status is verification_pending', async () => {
    const res = await request(app).get(`/api/payments/order/${order.orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('verification_pending');
    expect(res.body.data.upiReferenceNumber).toBe('987654321012');
  });

  // Step 15: Admin authenticates into Admin Portal
  test('Step 15: Store administrator logs in with admin ID token', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ idToken: adminToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.admin.role).toBe('super_admin');
  });

  // Step 16: Admin views dashboard overview
  test('Step 16: Admin fetches dashboard metrics and sales summary', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.body.data).toHaveProperty('pendingPaymentsCount');
  });

  // Step 17: Admin lists pending payment verifications
  test('Step 17: Admin queries pending payment verifications queue', async () => {
    const res = await request(app)
      .get('/api/admin/payments?status=verification_pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data.find(p => p.orderId === order.orderId);
    expect(item).toBeDefined();
    expect(item.upiReferenceNumber).toBe('987654321012');
    paymentId = item.paymentId;
  });

  // Step 18: Admin approves verified payment
  test('Step 18: Admin approves payment after verifying bank credit', async () => {
    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Verified against HDFC Bank statement credit of ₹1,448.10' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('verified');
  });

  // Step 19: Order transitions to confirmed, then admin moves to processing
  test('Step 19: Order transitions to confirmed and admin moves to processing', async () => {
    const res = await request(app).get(`/api/orders/${order.orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('confirmed');
    expect(res.body.data.paymentStatus).toBe('verified');

    const procRes = await request(app)
      .patch(`/api/admin/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });

    expect(procRes.status).toBe(200);
    expect(procRes.body.data.orderStatus).toBe('processing');
  });

  // Step 20: Admin dispatches order with tracking details
  test('Step 20: Admin assigns Blue Dart tracking number and dispatches order', async () => {
    const res = await request(app)
      .post(`/api/admin/orders/${order.orderId}/tracking`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courierName: 'Blue Dart Express',
        trackingNumber: 'BLUEDART-NAG-9823412',
        trackingUrl: 'https://www.bluedart.com/track/BLUEDART-NAG-9823412'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('shipped');
    expect(res.body.data.tracking.trackingNumber).toBe('BLUEDART-NAG-9823412');
  });

  // Step 21: Customer tracks shipment
  test('Step 21: Customer tracks shipment using order ID', async () => {
    const res = await request(app).get(`/api/orders/${order.orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('shipped');
    expect(res.body.data.tracking.courierName).toBe('Blue Dart Express');
  });

  // Step 22: Admin marks order delivered
  test('Step 22: Admin marks order as successfully delivered', async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'delivered',
        note: 'Delivered and signed by athlete at Civil Lines Nagpur'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('delivered');
  });

  // Step 23: Customer creates an account
  test('Step 23: Customer registers personal account for order management', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'arjun.swimmer@nagpurswimming.org',
        password: 'CompetitionSpeed2026!',
        displayName: 'Arjun Swimmer Nagpur',
        phone: '+919422113355'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // Step 24: Customer authenticates and fetches profile
  test('Step 24: Customer logs in and views account profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.uid).toBe('e2e_swimmer_nagpur');
  });

  // Step 25: Customer adds saved address in profile
  test('Step 25: Customer saves training pool delivery address in profile', async () => {
    const res = await request(app)
      .post('/api/customers/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        addressee: 'Arjun Swimmer (Club Locker)',
        phone: '+919422113355',
        addressLine1: 'Kamgar Kalyan Bhavan 50m Olympic Pool',
        city: 'Nagpur',
        state: 'Maharashtra',
        postalCode: '440009',
        isDefault: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.city).toBe('Nagpur');
  });

  // Step 26: Customer submits product review
  test('Step 26: Customer submits 5-star review for competition cap', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        rating: 5,
        title: 'Outstanding dome cap for state trials',
        comment: 'Zero wrinkles, stay tight on dive start, hydrodynamic perfection!',
        authorName: 'Arjun Swimmer'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    reviewId = res.body.data.reviewId;
  });

  // Step 27: Admin approves product review
  test('Step 27: Store administrator approves review in moderation queue', async () => {
    const res = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  // Step 28: Public product page displays verified review
  test('Step 28: Public product reviews feed displays newly approved review', async () => {
    const res = await request(app).get(`/api/products/${product.id}/reviews`);
    expect(res.status).toBe(200);
    const approvedReview = res.body.data.find(r => r.reviewId === reviewId);
    expect(approvedReview).toBeDefined();
    expect(approvedReview.rating).toBe(5);
    expect(approvedReview.title).toBe('Outstanding dome cap for state trials');
  });
});
