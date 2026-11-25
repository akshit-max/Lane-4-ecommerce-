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

  test('DELETE /api/cart clears the entire guest cart', async () => {
    const variant = sampleProduct.variants[0];

    // Add item first
    await request(app)
      .post('/api/cart/items')
      .send({
        productId: sampleProduct.id,
        variantId: variant.variantId,
        quantity: 2,
        guestId: 'gst_to_clear_1'
      });

    const delRes = await request(app)
      .delete('/api/cart?guestId=gst_to_clear_1');

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.items.length).toBe(0);
    expect(delRes.body.data.totalItemsCount).toBe(0);

    const checkRes = await request(app)
      .get('/api/cart?guestId=gst_to_clear_1');
    expect(checkRes.body.data.items.length).toBe(0);
  });

  test('cartService.clearCart clears BOTH user and guest carts simultaneously', async () => {
    const cartService = require('../src/services/cartService');
    const variant = sampleProduct.variants[0];
    const dualUserId = 'usr_dual_test_1';
    const dualGuestId = 'gst_dual_test_1';

    // Add to user cart
    await cartService.addItem(dualUserId, null, {
      productId: sampleProduct.id,
      variantId: variant.variantId,
      quantity: 1
    });

    // Add to guest cart
    await cartService.addItem(null, dualGuestId, {
      productId: sampleProduct.id,
      variantId: variant.variantId,
      quantity: 1
    });

    // Verify both have items
    const userCartBefore = await cartService.getCart(dualUserId, null);
    const guestCartBefore = await cartService.getCart(null, dualGuestId);
    expect(userCartBefore.items.length).toBe(1);
    expect(guestCartBefore.items.length).toBe(1);

    // Call clearCart with both IDs
    await cartService.clearCart(dualUserId, dualGuestId);

    // Verify both are now cleared
    const userCartAfter = await cartService.getCart(dualUserId, null);
    const guestCartAfter = await cartService.getCart(null, dualGuestId);
    expect(userCartAfter.items.length).toBe(0);
    expect(guestCartAfter.items.length).toBe(0);
  });
});

