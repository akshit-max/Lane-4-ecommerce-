const request = require('supertest');
const app = require('../src/app');
const seedService = require('../src/services/seedService');

describe('Product & Category Catalog Test Suite', () => {
  beforeAll(async () => {
    await seedService.seedAll();
  });

  test('GET /api/products returns seeded catalog with pagination metadata', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(6);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
  });

  test('GET /api/products/:slug returns specific product with variants', async () => {
    const res = await request(app).get('/api/products/mirror-racing-goggles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Mirror Racing Goggles');
    expect(res.body.data.variants.length).toBeGreaterThan(0);
    expect(res.body.data.salePricePaise).toBe(139900);
  });

  test('GET /api/categories returns all 5 published categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const slugs = res.body.data.map(c => c.slug);
    expect(slugs).toContain('goggles');
    expect(slugs).toContain('racing-caps');
    expect(slugs).toContain('swimwear');
    expect(slugs).toContain('training-gear');
    expect(slugs).toContain('accessories');
  });

  test('Admin product creation, updating and safe soft-deletion', async () => {
    const adminToken = 'test_token_admin_lane4swim_in';

    // 1. Create product
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pro Kickboard Nagpur Edition',
        sku: 'L4-TRN-KCK-001',
        regularPrice: 899,
        salePrice: 699,
        categorySlug: 'training-gear',
        variants: [
          { sku: 'L4-TRN-KCK-CYN', color: 'Cyan Blue', stockQuantity: 20 }
        ]
      });

    expect(createRes.status).toBe(201);
    const newId = createRes.body.data.id;

    // 2. Update product
    const updateRes = await request(app)
      .patch(`/api/admin/products/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'High-density EVA foam kickboard.'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe('High-density EVA foam kickboard.');

    // 3. Delete (soft-delete)
    const delRes = await request(app)
      .delete(`/api/admin/products/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.isDeleted).toBe(true);
  });

  test('Admin product creation and update with gallery images and custom display order', async () => {
    const adminToken = 'test_token_admin_lane4swim_in';

    // 1. Create product with 3 images in arbitrary order
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pro Swim Fins Pro',
        sku: 'L4-FIN-PRO-01',
        regularPrice: 2499,
        salePrice: 1999,
        categorySlug: 'training-gear',
        images: [
          { url: 'https://cdn.example.com/photo-c.jpg', alt: 'Bottom View', order: 2 },
          { url: 'https://cdn.example.com/photo-a.jpg', alt: 'Hero Angle', order: 0 },
          { url: 'https://cdn.example.com/photo-b.jpg', alt: 'Side Profile', order: 1 }
        ]
      });

    expect(createRes.status).toBe(201);
    const prodId = createRes.body.data.id;
    const createdImages = createRes.body.data.images;
    expect(createdImages).toHaveLength(3);
    // Verified sorted order 0, 1, 2
    expect(createdImages[0].url).toBe('https://cdn.example.com/photo-a.jpg');
    expect(createdImages[0].order).toBe(0);
    expect(createdImages[0].isPrimary).toBe(true);
    expect(createdImages[1].url).toBe('https://cdn.example.com/photo-b.jpg');
    expect(createdImages[1].order).toBe(1);
    expect(createdImages[2].url).toBe('https://cdn.example.com/photo-c.jpg');
    expect(createdImages[2].order).toBe(2);

    // 2. Reorder images: set Photo C as primary (#1) and move Photo A to #3
    const updateRes = await request(app)
      .patch(`/api/admin/products/${prodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        images: [
          { url: 'https://cdn.example.com/photo-c.jpg', alt: 'Bottom View', order: 0 },
          { url: 'https://cdn.example.com/photo-b.jpg', alt: 'Side Profile', order: 1 },
          { url: 'https://cdn.example.com/photo-a.jpg', alt: 'Hero Angle', order: 2 }
        ]
      });

    expect(updateRes.status).toBe(200);
    const updatedImages = updateRes.body.data.images;
    expect(updatedImages).toHaveLength(3);
    expect(updatedImages[0].url).toBe('https://cdn.example.com/photo-c.jpg');
    expect(updatedImages[0].order).toBe(0);
    expect(updatedImages[0].isPrimary).toBe(true);
    expect(updatedImages[1].url).toBe('https://cdn.example.com/photo-b.jpg');
    expect(updatedImages[2].url).toBe('https://cdn.example.com/photo-a.jpg');

    // 3. Clean up
    await request(app)
      .delete(`/api/admin/products/${prodId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const fs = require('fs');
    const path = require('path');
    const testHtml = path.resolve(__dirname, '../../product/pro-swim-fins-pro.html');
    if (fs.existsSync(testHtml)) fs.unlinkSync(testHtml);
  });
});

