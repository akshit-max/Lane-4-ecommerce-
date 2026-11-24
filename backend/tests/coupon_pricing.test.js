const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Coupon Validation & Pricing Calculation Test Suite', () => {
  beforeAll(async () => {
    await seedService.seedAll();
  });

  test('POST /api/coupons/validate verifies percentage discounts, min order, and caps', async () => {
    // 1. Below minimum threshold
    const lowRes = await request(app)
      .post('/api/coupons/validate')
      .send({
        code: 'WELCOME10',
        subtotalPaise: 50000 // ₹ 500 (below ₹ 999 requirement)
      });

    expect(lowRes.status).toBe(500); // Fails minimum order check

    // 2. Above minimum threshold
    const validRes = await request(app)
      .post('/api/coupons/validate')
      .send({
        code: 'WELCOME10',
        subtotalPaise: 150000 // ₹ 1,500
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.data.discountPaise).toBe(15000); // 10% of 150000 = 15000 (₹ 150.00)

    // 3. Exceeds max cap
    const capRes = await request(app)
      .post('/api/coupons/validate')
      .send({
        code: 'WELCOME10',
        subtotalPaise: 500000 // ₹ 5,000 (10% would be ₹ 500, cap is ₹ 300)
      });

    expect(capRes.status).toBe(200);
    expect(capRes.body.data.discountPaise).toBe(30000); // Cap of ₹ 300 (30000 paise)
  });

  test('POST /api/checkout/quote computes exact subtotal, shipping, coupon and final payable in integer paise', async () => {
    const prodRes = await request(app).get('/api/products/mirror-racing-goggles');
    const product = prodRes.body.data;

    // Subtotal = ₹ 1,499.00 (below ₹ 1,999 free shipping threshold => +₹ 99.00 shipping)
    const quoteRes = await request(app)
      .post('/api/checkout/quote')
      .send({
        items: [{ productId: product.id, variantId: product.variants[0].variantId, quantity: 1 }],
        couponCode: 'WELCOME10'
      });

    expect(quoteRes.status).toBe(200);
    const p = quoteRes.body.data.pricing;
    expect(p.subtotalPaise).toBe(139900);
    expect(p.couponDiscountPaise).toBe(13990); // 10% of 139900
    expect(p.shippingChargesPaise).toBe(9900);  // Base shipping charge
    // Final payable = 139900 - 13990 + 9900 = 135810 (₹ 1,358.10)
    expect(p.finalPayablePaise).toBe(135810);
  });
});

