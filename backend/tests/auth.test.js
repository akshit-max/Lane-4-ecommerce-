const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Authentication & Authorization Test Suite', () => {
  beforeAll(async () => {
    await seedService.seedAll();
  });

  test('POST /api/auth/register creates customer profile and handles duplicate registration', async () => {
    const testEmail = `swimmer_${Date.now()}@example.com`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        displayName: 'Arjun Swimmer',
        phone: '+919876543210'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);

    // Duplicate test
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        displayName: 'Arjun Swimmer'
      });

    expect(dupRes.status).toBe(500); // Handled error
  });

  test('POST /api/auth/register rejects invalid inputs', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me requires valid Bearer token', async () => {
    const unauthRes = await request(app).get('/api/auth/me');
    expect(unauthRes.status).toBe(401);

    const validRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer test_token_customer_user_1');

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.uid).toBe('customer_user_1');
  });

  test('POST /api/auth/admin/login validates administrative custom claims', async () => {
    // Admin login with non-admin token
    const nonAdminRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ idToken: 'test_token_regular_user' });

    expect(nonAdminRes.status).toBe(403);

    // Bootstrap admin login
    const adminRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ idToken: 'test_token_admin_lane4swim_in' });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.admin.role).toBe('super_admin');
  });

  test('POST /api/auth/login rejects administrator accounts from customer storefront', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ idToken: 'test_token_admin_lane4swim_in' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ADMIN_ACCESS_RESTRICTED');
  });

  test('POST /api/auth/admin/login rejects normal customer credentials with 403', async () => {
    // Register a customer first
    const customerEmail = `swimmer_admin_test_${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'Password123!',
        displayName: 'Test Swimmer'
      });

    // Attempt admin login with customer credentials
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({
        email: customerEmail,
        password: 'Password123!'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CUSTOMER_ACCESS_DENIED');
  });

  test('POST /api/auth/register rejects registration with administrator emails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@lane4swim.in',
        password: 'Password123!',
        displayName: 'Impostor Admin'
      });

    expect(res.status).toBe(500); // Handled service exception
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/admin/login rejects empty or invalid administrator credentials', async () => {
    // Empty body
    const emptyRes = await request(app)
      .post('/api/auth/admin/login')
      .send({});
    expect(emptyRes.status).toBe(400);

    // Empty string fields
    const emptyFieldsRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: '', password: '' });
    expect(emptyFieldsRes.status).toBe(400);

    // Wrong password for existing admin
    const wrongPassRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lane4swim.in', password: 'incorrectPassword' });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('POST /api/auth/admin/login authenticates with correct password and allows GET /api/auth/admin/verify', async () => {
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({
        email: 'admin@lane4swim.in',
        password: 'AdminSecurePass2026!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.body.data.admin.email).toBe('admin@lane4swim.in');

    const adminToken = loginRes.body.data.token;

    // Verify valid admin token
    const verifyRes = await request(app)
      .get('/api/auth/admin/verify')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.valid).toBe(true);
    expect(verifyRes.body.data.admin.email).toBe('admin@lane4swim.in');

    // Verify rejection of invalid token
    const badVerifyRes = await request(app)
      .get('/api/auth/admin/verify')
      .set('Authorization', 'Bearer invalid.token.payload');

    expect(badVerifyRes.status).toBe(401);
  });
});

