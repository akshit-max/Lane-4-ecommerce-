const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Order Creation & Inventory Transaction Test Suite', () => {
  let sampleProduct;

  beforeAll(async () => {
    await seedService.seedAll();
    const prodRes = await request(app).get('/api/products/surge-racing-cap');
    sampleProduct = prodRes.body.data;
  });

  test('POST /api/orders creates order, locks stock and assigns human-friendly order number', async () => {
    const variant = sampleProduct.variants[0];

    // Check inventory before
    const invBefore = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', 'Bearer test_token_admin_lane4swim_in');
    const itemBefore = invBefore.body.data.find(i => i.sku === variant.sku);
    const stockBefore = itemBefore.availableQuantity;

    // Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerEmail: 'athlete@lane4swim.in',
        customerPhone: '+919988776655',
        shippingAddress: {
          addressee: 'Pooja Patil',
          addressLine1: '402, High Peak Towers',
          city: 'Nagpur',
          state: 'Maharashtra',
          postalCode: '440012'
        },
        items: [{
          productId: sampleProduct.id,
          variantId: variant.variantId,
          quantity: 2
        }],
        couponCode: null
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.success).toBe(true);
    expect(orderRes.body.data).toHaveProperty('orderId');
    expect(orderRes.body.data.orderNumber).toMatch(/^L4-\d{2}-\d{4}$/);
    expect(orderRes.body.data.status).toBe('pending_payment');
    expect(orderRes.body.data.paymentStatus).toBe('awaiting_payment');

    // Check inventory after: stock must be decremented by 2
    const invAfter = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', 'Bearer test_token_admin_lane4swim_in');
    const itemAfter = invAfter.body.data.find(i => i.sku === variant.sku);
    expect(itemAfter.availableQuantity).toBe(stockBefore - 2);

    // Cancel order and verify stock is restored
    const cancelRes = await request(app)
      .patch(`/api/admin/orders/${orderRes.body.data.orderId}/status`)
      .set('Authorization', 'Bearer test_token_admin_lane4swim_in')
      .send({ status: 'cancelled' });

    expect(cancelRes.status).toBe(200);

    const invRestored = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', 'Bearer test_token_admin_lane4swim_in');
    const itemRestored = invRestored.body.data.find(i => i.sku === variant.sku);
    expect(itemRestored.availableQuantity).toBe(stockBefore);
  });
});

