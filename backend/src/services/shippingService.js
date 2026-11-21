const { getDb } = require('../config/firebaseAdmin');
const { formatINR, rupeesToPaise } = require('../utils/currency');
const { logger } = require('../utils/logger');

const DEFAULT_SHIPPING_SETTINGS = {
  baseShippingChargePaise: 9900,        // ₹ 99.00
  freeShippingThresholdPaise: 199900,   // Free shipping on orders >= ₹ 1,999.00
  estimatedDeliveryDays: '3-5 business days',
  serviceableAllIndia: true,
  originCity: 'Nagpur',
  originState: 'Maharashtra'
};

class ShippingService {
  async seedInitialShippingSettings() {
    const db = getDb();
    if (!db) return;

    try {
      const doc = await db.collection('shippingSettings').doc('global').get();
      if (!doc.exists) {
        await db.collection('shippingSettings').doc('global').set({
          ...DEFAULT_SHIPPING_SETTINGS,
          updatedAt: new Date()
        });
        logger.info('Initialized global shipping settings (PAN India, ₹99 flat / Free over ₹1,999).');
      }
    } catch (err) {
      logger.error('Error seeding shipping settings', err);
    }
  }

  async getShippingSettings() {
    const db = getDb();
    if (!db) return DEFAULT_SHIPPING_SETTINGS;

    const doc = await db.collection('shippingSettings').doc('global').get();
    if (!doc.exists) {
      return DEFAULT_SHIPPING_SETTINGS;
    }
    return doc.data();
  }

  async calculateShipping(subtotalPaise, postalCode = null) {
    const settings = await this.getShippingSettings();

    if (subtotalPaise >= settings.freeShippingThresholdPaise) {
      return {
        shippingChargesPaise: 0,
        isFreeShipping: true,
        thresholdPaise: settings.freeShippingThresholdPaise,
        estimatedDeliveryDays: settings.estimatedDeliveryDays,
        shippingFormatted: 'FREE'
      };
    }

    return {
      shippingChargesPaise: settings.baseShippingChargePaise,
      isFreeShipping: false,
      thresholdPaise: settings.freeShippingThresholdPaise,
      amountNeededForFreeShippingPaise: settings.freeShippingThresholdPaise - subtotalPaise,
      estimatedDeliveryDays: settings.estimatedDeliveryDays,
      shippingFormatted: formatINR(settings.baseShippingChargePaise)
    };
  }

  async updateShippingSettings(data) {
    const db = getDb();
    const docRef = db.collection('shippingSettings').doc('global');
    const updates = {
      updatedAt: new Date()
    };

    if (data.baseShippingCharge !== undefined) {
      updates.baseShippingChargePaise = rupeesToPaise(data.baseShippingCharge);
    }
    if (data.freeShippingThreshold !== undefined) {
      updates.freeShippingThresholdPaise = rupeesToPaise(data.freeShippingThreshold);
    }
    if (data.estimatedDeliveryDays !== undefined) {
      updates.estimatedDeliveryDays = data.estimatedDeliveryDays;
    }

    await docRef.set(updates, { merge: true });
    return this.getShippingSettings();
  }
}

module.exports = new ShippingService();

