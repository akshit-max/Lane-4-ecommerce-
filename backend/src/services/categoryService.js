const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

function generateCategoryHtmlPage(category) {
  try {
    const templatePath = path.resolve(__dirname, '../../../category/training-gear.html');
    if (!fs.existsSync(templatePath)) return;
    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace Title
    html = html.replace(/<title>.*?<\/title>/, `<title>${category.name} | Swimming Gear | The Lane4 Performance Store</title>`);
    // Replace meta description
    if (category.description) {
      html = html.replace(/<meta content="[^"]*" name="description">/, `<meta content="${category.description} Shop online with PAN India delivery from The Lane4 Performance Store, Nagpur, Maharashtra." name="description">`);
    }
    // Replace data-wf-item-slug
    html = html.replace(/data-wf-item-slug="[^"]*"/, `data-wf-item-slug="${category.slug}"`);
    // Replace heading
    html = html.replace(/<h1[^>]*class="title-h1"[^>]*>.*?<\/h1>/, `<h1 class="title-h1">${category.name}</h1>`);
    // Replace breadcrumb or category title
    html = html.replace(/<a href="training-gear\.html"[^>]*>.*?<\/a>/g, `<a href="${category.slug}.html" class="w-inline-block"><div class="paragraph-14px">${category.name}</div></a>`);

    // Empty out hardcoded static products inside .collection-list-category so newly created categories start clean
    html = html.replace(/(<div class="collection-list-category w-dyn-items">)[\s\S]*?(<\/div>\s*<div class="w-dyn-empty")/i, '$1$2');

    // Ensure lane4-catalog.js is present
    if (!html.includes('lane4-catalog.js')) {
      html = html.replace('</body>', '<script src="../js/lane4-catalog.js"></script>\n</body>');
    }

    const outputPath = path.resolve(__dirname, `../../../category/${category.slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf8');
    logger.info(`Generated category storefront page: category/${category.slug}.html`);
  } catch (err) {
    logger.warn('Could not generate category HTML file:', err);
  }
}

const INITIAL_CATEGORIES = [
  {
    name: 'Goggles',
    slug: 'goggles',
    description: 'Competition racing and open water swimming goggles with anti-fog and UV protection.',
    displayOrder: 1,
    isPublished: true,
    isDeleted: false
  },
  {
    name: 'Racing Caps',
    slug: 'racing-caps',
    description: 'Dome silicone competition caps and comfortable Lycra training caps.',
    displayOrder: 2,
    isPublished: true,
    isDeleted: false
  },
  {
    name: 'Swimwear',
    slug: 'swimwear',
    description: 'FINA-compliant racing suits and hydrodynamic jammers.',
    displayOrder: 3,
    isPublished: true,
    isDeleted: false
  },
  {
    name: 'Training Gear',
    slug: 'training-gear',
    description: 'Short blade kick fins, kickboards, and pool training essentials.',
    displayOrder: 4,
    isPublished: true,
    isDeleted: false
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Nose clips, earplugs, gear bags, and replacement straps.',
    displayOrder: 5,
    isPublished: true,
    isDeleted: false
  }
];

class CategoryService {
  async seedInitialCategories() {
    const db = getDb();
    if (!db) return;

    try {
      const snap = await db.collection('categories').limit(1).get();
      if (snap.empty) {
        logger.info('Categories collection empty. Seeding initial categories...');
        for (const cat of INITIAL_CATEGORIES) {
          const docRef = db.collection('categories').doc();
          await docRef.set({
            id: docRef.id,
            ...cat,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        logger.info('Successfully seeded 5 initial categories.');
      }
    } catch (err) {
      logger.error('Error seeding categories', err);
    }
  }

  async listCategories() {
    const db = getDb();
    if (!db) return [];

    const snap = await db.collection('categories')
      .where('isPublished', '==', true)
      .where('isDeleted', '==', false)
      .get();

    const categories = snap.docs.map(doc => doc.data());
    categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return categories;
  }

  async getCategoryBySlug(slug) {
    const db = getDb();
    if (!db) return null;

    const snap = await db.collection('categories')
      .where('slug', '==', slug)
      .where('isDeleted', '==', false)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data();
  }

  async createCategory(data) {
    const db = getDb();
    const docRef = db.collection('categories').doc();
    const newCategory = {
      id: docRef.id,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: data.description || '',
      displayOrder: parseInt(data.displayOrder, 10) || 0,
      image: data.image || null,
      isPublished: data.isPublished !== false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await docRef.set(newCategory);
    generateCategoryHtmlPage(newCategory);
    return newCategory;
  }

  async updateCategory(id, data) {
    const db = getDb();
    const docRef = db.collection('categories').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Category not found');

    const updates = {
      ...data,
      updatedAt: new Date()
    };
    await docRef.update(updates);
    const updated = await docRef.get();
    const updatedData = updated.data();
    generateCategoryHtmlPage(updatedData);
    return updatedData;
  }

  async deleteCategory(id) {
    const db = getDb();
    const docRef = db.collection('categories').doc(id);
    await docRef.update({
      isDeleted: true,
      isPublished: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
    return { id, isDeleted: true };
  }
}

module.exports = new CategoryService();

