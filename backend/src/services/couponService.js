const { getDb } = require('../config/firebaseAdmin');
const { formatINR, rupeesToPaise } = require('../utils/currency');
const { logger } = require('../utils/logger');

const INITIAL_COUPONS = [
  {
    code: 'WELCOME10',
    description: '10% off on orders above ₹ 999',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValuePaise: 99900,
    maxDiscountPaise: 30000, // ₹ 300 cap
    startDate: new Date('2024-01-01'),
    expiryDate: new Date('2030-12-31'),
    totalUsageLimit: 10000,
    usedCount: 0,
    perCustomerLimit: 1,
    isActive: true
  },
  {
    code: 'LANE4PRO',
    description: 'Flat ₹ 200 off on orders above ₹ 1,499',
    discountType: 'fixed_amount',
    discountValue: 20000, // ₹ 200 in paise
    minOrderValuePaise: 149900,
    startDate: new Date('2024-01-01'),
    expiryDate: new Date('2030-12-31'),
    totalUsageLimit: 5000,
    usedCount: 0,
    perCustomerLimit: 1,
    isActive: true
  }
];

class CouponService {
  async seedInitialCoupons() {
    const db = getDb();
    if (!db) return;

    try {
      const snap = await db.collection('coupons').limit(1).get();
      if (snap.empty) {
        logger.info('Coupons collection empty. Seeding initial promotional coupons...');
        for (const c of INITIAL_COUPONS) {
          await db.collection('coupons').doc(c.code).set({
            ...c,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        logger.info('Successfully seeded WELCOME10 and LANE4PRO coupons.');
      }
    } catch (err) {
      logger.error('Error seeding coupons', err);
    }
  }

  async validateCoupon({ code, subtotalPaise, customerId = null }) {
    if (!code || typeof code !== 'string') {
      throw new Error('Please provide a coupon code.');
    }

    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    const doc = await db.collection('coupons').doc(cleanCode).get();

    if (!doc.exists) {
      throw new Error(`Coupon "${cleanCode}" is invalid.`);
    }

    const coupon = doc.data();

    if (!coupon.isActive) {
      throw new Error(`Coupon "${cleanCode}" is no longer active.`);
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      throw new Error(`Coupon "${cleanCode}" has not started yet.`);
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      throw new Error(`Coupon "${cleanCode}" has expired.`);
    }

    if (subtotalPaise < coupon.minOrderValuePaise) {
      const minRequired = formatINR(coupon.minOrderValuePaise);
      throw new Error(`Coupon requires a minimum order value of ${minRequired}.`);
    }

    if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) {
      throw new Error(`Coupon "${cleanCode}" usage limit has been reached.`);
    }

    // Calculate discount in Paise
    let discountPaise = 0;
    if (coupon.discountType === 'percentage') {
      discountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
      if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
      }
    } else if (coupon.discountType === 'fixed_amount') {
      discountPaise = Math.min(coupon.discountValue, subtotalPaise);
    }

    // Absolute cap: discount cannot exceed subtotal
    discountPaise = Math.min(discountPaise, subtotalPaise);

    return {
      isValid: true,
      code: cleanCode,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountPaise,
      discountFormatted: formatINR(discountPaise)
    };
  }

  async recordCouponRedemption(code, customerId = null) {
    if (!code) return;
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    const docRef = db.collection('coupons').doc(cleanCode);
    const doc = await docRef.get();
    if (doc.exists) {
      const current = doc.data().usedCount || 0;
      await docRef.update({
        usedCount: current + 1,
        updatedAt: new Date()
      });
    }
  }

  async listCoupons() {
    const db = getDb();
    const snap = await db.collection('coupons').get();
    return snap.docs.map(d => ({
      code: d.id,
      ...d.data(),
      minOrderFormatted: formatINR(d.data().minOrderValuePaise || 0),
      maxDiscountFormatted: d.data().maxDiscountPaise ? formatINR(d.data().maxDiscountPaise) : null
    }));
  }

  async createCoupon(data) {
    const cleanCode = data.code.toUpperCase().trim();
    const db = getDb();
    const docRef = db.collection('coupons').doc(cleanCode);

    const newCoupon = {
      code: cleanCode,
      description: data.description || '',
      discountType: data.discountType || 'percentage',
      discountValue: data.discountType === 'percentage' ? parseInt(data.discountValue, 10) : rupeesToPaise(data.discountValue),
      minOrderValuePaise: rupeesToPaise(data.minOrderValue || 0),
      maxDiscountPaise: data.maxDiscount ? rupeesToPaise(data.maxDiscount) : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : new Date('2030-12-31'),
      totalUsageLimit: data.totalUsageLimit ? parseInt(data.totalUsageLimit, 10) : null,
      usedCount: 0,
      perCustomerLimit: parseInt(data.perCustomerLimit, 10) || 1,
      isActive: data.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await docRef.set(newCoupon);
    return newCoupon;
  }

  async updateCoupon(code, data) {
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    const docRef = db.collection('coupons').doc(cleanCode);
    await docRef.update({
      ...data,
      updatedAt: new Date()
    });
    const updated = await docRef.get();
    return updated.data();
  }

  async deleteCoupon(code) {
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    await db.collection('coupons').doc(cleanCode).delete();
    return { code: cleanCode, deleted: true };
  }
}

module.exports = new CouponService();

