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

    // Min Order Value check (handling both minOrderValuePaise and minOrderValue in rupees)
    const minOrderPaise = coupon.minOrderValuePaise !== undefined 
      ? coupon.minOrderValuePaise 
      : (coupon.minOrderValue ? rupeesToPaise(coupon.minOrderValue) : 0);

    if (subtotalPaise < minOrderPaise) {
      const minRequired = formatINR(minOrderPaise);
      throw new Error(`Coupon requires a minimum order value of ${minRequired}.`);
    }

    // Max Order Value check (if coupon specifies an upper ceiling for order eligibility)
    const maxOrderPaise = coupon.maxOrderValuePaise !== undefined
      ? coupon.maxOrderValuePaise
      : (coupon.maxOrderValue ? rupeesToPaise(coupon.maxOrderValue) : null);

    if (maxOrderPaise && subtotalPaise > maxOrderPaise) {
      const maxAllowed = formatINR(maxOrderPaise);
      throw new Error(`Coupon is valid only for orders up to ${maxAllowed}.`);
    }

    if (coupon.totalUsageLimit && coupon.usedCount >= coupon.totalUsageLimit) {
      throw new Error(`Coupon "${cleanCode}" usage limit has been reached.`);
    }

    // Resolve max discount cap in paise
    let maxCapPaise = null;
    if (coupon.maxDiscountPaise !== undefined && coupon.maxDiscountPaise !== null) {
      maxCapPaise = coupon.maxDiscountPaise;
    } else if (coupon.maxDiscount !== undefined && coupon.maxDiscount !== null && coupon.maxDiscount !== '') {
      maxCapPaise = typeof coupon.maxDiscount === 'number' && coupon.maxDiscount > 1000 ? coupon.maxDiscount : rupeesToPaise(coupon.maxDiscount);
    }

    // Calculate discount in Paise
    let discountPaise = 0;
    if (coupon.discountType === 'percentage') {
      discountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
      if (maxCapPaise && discountPaise > maxCapPaise) {
        discountPaise = maxCapPaise;
      }
    } else if (coupon.discountType === 'fixed_amount') {
      const fixedPaise = coupon.discountValuePaise || (coupon.discountValue > 1000 ? coupon.discountValue : rupeesToPaise(coupon.discountValue));
      discountPaise = Math.min(fixedPaise, subtotalPaise);
      if (maxCapPaise && discountPaise > maxCapPaise) {
        discountPaise = maxCapPaise;
      }
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

  async revertCouponRedemption(code) {
    if (!code) return;
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    const docRef = db.collection('coupons').doc(cleanCode);
    const doc = await docRef.get();
    if (doc.exists) {
      const current = doc.data().usedCount || 0;
      await docRef.update({
        usedCount: Math.max(0, current - 1),
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
    const updates = {
      ...data,
      updatedAt: new Date()
    };
    if (data.minOrderValue !== undefined) {
      updates.minOrderValuePaise = rupeesToPaise(data.minOrderValue || 0);
    }
    if (data.maxDiscount !== undefined) {
      updates.maxDiscountPaise = data.maxDiscount ? rupeesToPaise(data.maxDiscount) : null;
    }
    if (data.maxOrderValue !== undefined) {
      updates.maxOrderValuePaise = data.maxOrderValue ? rupeesToPaise(data.maxOrderValue) : null;
    }
    if (data.discountValue !== undefined && data.discountType !== 'percentage') {
      updates.discountValue = rupeesToPaise(data.discountValue);
    }
    await docRef.update(updates);
    const updated = await docRef.get();
    return updated.data();
  }

  async deleteCoupon(code) {
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    await db.collection('coupons').doc(cleanCode).delete();
    return { code: cleanCode, deleted: true };
  }

  async getCouponByCode(code) {
    if (!code) return null;
    const cleanCode = code.toUpperCase().trim();
    const db = getDb();
    if (!db) return null;
    const doc = await db.collection('coupons').doc(cleanCode).get();
    if (doc.exists) {
      const data = doc.data();
      return { id: doc.id, ...data, usedCount: data.usedCount || 0, currentUses: data.usedCount || 0 };
    }
    const snap = await db.collection('coupons').where('code', '==', cleanCode).limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return { id: snap.docs[0].id, ...data, usedCount: data.usedCount || 0, currentUses: data.usedCount || 0 };
    }
    return null;
  }
}

module.exports = new CouponService();

