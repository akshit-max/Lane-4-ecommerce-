const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Shopping Cart & Variant Operations Test Suite', () => {
  const guestId = 'gst_test_session_99';
  let sampleProduct;

  beforeAll(async () => {
    await seedService.seedAll();
    const prodRes = await request(app).get('/api/products/mirror-racing-goggles');
    sampleProduct = prodRes.body.data;
  });

  test('POST /api/cart/items adds product variant to guest cart and computes subtotal', async () => {
    const variant = sampleProduct.variants[0];

    const res = await request(app)
      .post('/api/cart/items')
      .send({
        productId: sampleProduct.id,
        variantId: variant.variantId,
        quantity: 1,
        guestId
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.subtotalPaise).toBe(sampleProduct.salePricePaise || sampleProduct.regularPricePaise);
    expect(res.body.data.totalItemsCount).toBe(1);
  });

  test('PATCH /api/cart/items/:id updates quantity and enforces stock bounds', async () => {
    const variant = sampleProduct.variants[0];
    const itemId = `${sampleProduct.id}_${variant.variantId}`;

    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .send({
        quantity: 3,
        guestId
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalItemsCount).toBe(3);

    // Oversell attempt
    const overRes = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .send({
        quantity: 9999,
        guestId
      });

    expect(overRes.status).toBe(500); // Exceeds available stock
  });

  test('DELETE /api/cart/items/:id removes item and updates subtotal', async () => {
    const variant = sampleProduct.variants[0];
    const itemId = `${sampleProduct.id}_${variant.variantId}`;

    const res = await request(app)
      .delete(`/api/cart/items/${itemId}?guestId=${guestId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
    expect(res.body.data.subtotalPaise).toBe(0);
  });
});

