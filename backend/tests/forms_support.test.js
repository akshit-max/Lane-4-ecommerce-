const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Forms, Enquiries, Newsletter & Reviews Test Suite', () => {
  const adminToken = 'test_token_admin_lane4swim_in';

  beforeAll(async () => {
    await seedService.seedAll();
  });

  test('POST /api/enquiries handles contact modals (press, complaint, feedback, ideas, general)', async () => {
    const types = ['press', 'complaint', 'feedback', 'ideas', 'general'];

    for (const type of types) {
      const res = await request(app)
        .post('/api/enquiries')
        .send({
          type,
          name: `Swimmer ${type}`,
          email: `${type}@example.com`,
          phone: '+919876543210',
          message: `Inquiry regarding ${type} from Nagpur.`
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe(type);
    }
  });

  test('POST /api/enquiries strictly rejects numbers in name', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .send({
        type: 'general',
        name: 'John123 Doe',
        email: 'john@example.com',
        phone: '9876543210',
        message: 'This is a test message regarding swimming gear.'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const msg = typeof res.body.error === 'string' ? res.body.error : (res.body.error && res.body.error.message) || res.body.message;
    expect(msg).toMatch(/number/i);
  });

  test('POST /api/enquiries strictly rejects text/letters in phone number', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .send({
        type: 'general',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '98765abcde',
        message: 'This is a test message regarding swimming gear.'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const msg = typeof res.body.error === 'string' ? res.body.error : (res.body.error && res.body.error.message) || res.body.message;
    expect(msg).toMatch(/phone|number|letter/i);
  });

  test('POST /api/enquiries strictly rejects invalid email address', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .send({
        type: 'general',
        name: 'John Doe',
        email: 'not-an-email',
        phone: '9876543210',
        message: 'This is a test message regarding swimming gear.'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const msg = typeof res.body.error === 'string' ? res.body.error : (res.body.error && res.body.error.message) || res.body.message;
    expect(msg).toMatch(/email/i);
  });

  test('POST /api/enquiries rejects message that is too short', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .send({
        type: 'general',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        message: 'Hi'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const msg = typeof res.body.error === 'string' ? res.body.error : (res.body.error && res.body.error.message) || res.body.message;
    expect(msg).toMatch(/message|characters/i);
  });

  test('POST /api/newsletter/subscribe records subscription and deduplicates safely', async () => {
    const email = `news_${Date.now()}@example.com`;

    const res1 = await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email, sourcePage: 'index.htm' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('subscribed');

    // Duplicate subscription
    const res2 = await request(app)
      .post('/api/newsletter/subscribe')
      .send({ email, sourcePage: 'index.htm' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('already_subscribed');
  });

  test('Product reviews submission and admin moderation cycle', async () => {
    const prodRes = await request(app).get('/api/products/mirror-racing-goggles');
    const product = prodRes.body.data;

    // 1. Submit review
    const revRes = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .send({
        rating: 5,
        title: 'Best racing goggles in India',
        comment: 'Crystal clear in the 50m pool, zero leaks on dive!',
        authorName: 'National Swimmer'
      });

    expect(revRes.status).toBe(201);
    expect(revRes.body.data.status).toBe('pending'); // Pending moderation
    const reviewId = revRes.body.data.reviewId;

    // Public list should not show pending review yet
    const pubListBefore = await request(app).get(`/api/products/${product.id}/reviews`);
    expect(pubListBefore.body.data.find(r => r.reviewId === reviewId)).toBeUndefined();

    // 2. Admin approves review
    const modRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(modRes.status).toBe(200);

    // Public list should now include approved review
    const pubListAfter = await request(app).get(`/api/products/${product.id}/reviews`);
    expect(pubListAfter.body.data.find(r => r.reviewId === reviewId)).toBeDefined();
  });
});

