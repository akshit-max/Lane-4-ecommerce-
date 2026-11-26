const { getDb } = require('../config/firebaseAdmin');

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const DEFAULT_STORE_SETTINGS = {
  storeName: 'The Lane4 Performance Store',
  legalName: 'The Lane4 Performance Store',
  gstin: '',
  supportEmail: 'Lane4performancestore@gmail.com',
  supportPhone: '+91 79725 41297',
  storeAddress: 'Nagpur, Maharashtra, India',
  city: 'Nagpur',
  state: 'Maharashtra',
  stateCode: '27',
  instagramUrl: 'https://www.instagram.com/lane4.ps_swim.india',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Lane4+Performance+Store+Nagpur+Maharashtra',
  announcementBanner: {
    enabled: true,
    text: 'PAN India Delivery · Founded by National Medalist Swimmers in Nagpur'
  }
};

function isValidCertifiedGstin(gstin) {
  const clean = String(gstin || '').trim().toUpperCase();
  return Boolean(clean && GSTIN_REGEX.test(clean) && !clean.includes('TEST') && !clean.includes('PENDING'));
}

class StoreSettingsService {
  async seedInitialStoreSettings() {
    const db = getDb();
    if (!db) return;

    try {
      const doc = await db.collection('storeSettings').doc('profile').get();
      if (!doc.exists) {
        await db.collection('storeSettings').doc('profile').set({
          ...DEFAULT_STORE_SETTINGS,
          updatedAt: new Date()
        });
      }
    } catch (e) {
      // ignore
    }
  }

  async getStoreSettings() {
    const db = getDb();
    let stored = {};
    if (db) {
      const doc = await db.collection('storeSettings').doc('profile').get();
      if (doc.exists) stored = doc.data() || {};
    }
    const merged = { ...DEFAULT_STORE_SETTINGS, ...stored };
    const effectiveGstin = (merged.gstin || process.env.SELLER_GSTIN || '').trim().toUpperCase();
    return {
      ...merged,
      gstin: (merged.gstin || '').trim().toUpperCase(),
      envGstinConfigured: isValidCertifiedGstin(process.env.SELLER_GSTIN || ''),
      effectiveGstin: isValidCertifiedGstin(effectiveGstin) ? effectiveGstin : '',
      isCertifiedGstin: isValidCertifiedGstin(effectiveGstin)
    };
  }

  async updateStoreSettings(data, adminUser) {
    const db = getDb();
    const docRef = db.collection('storeSettings').doc('profile');
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? (existingDoc.data() || {}) : {};

    const updates = {
      updatedAt: new Date()
    };

    const stringFields = ['storeName', 'legalName', 'supportEmail', 'supportPhone', 'storeAddress', 'city', 'state', 'stateCode', 'instagramUrl', 'googleMapsUrl'];
    for (const key of stringFields) {
      if (data[key] !== undefined && data[key] !== null) {
        updates[key] = String(data[key]).trim();
      }
    }
    if (data.announcementBanner !== undefined && typeof data.announcementBanner === 'object') {
      updates.announcementBanner = data.announcementBanner;
    }

    // Preserve existing GSTIN unless explicitly updated with a valid 15-char GSTIN or explicitly cleared
    if (data.clearGstin === true) {
      updates.gstin = '';
    } else if (data.gstin !== undefined && data.gstin !== null) {
      const cleanGstin = String(data.gstin).trim().toUpperCase();
      if (cleanGstin) {
        if (!isValidCertifiedGstin(cleanGstin)) {
          const err = new Error('Please enter a valid 15-character Indian GSTIN (e.g. 27AABCL1234M1Z5).');
          err.statusCode = 400;
          err.code = 'INVALID_GSTIN';
          throw err;
        }
        updates.gstin = cleanGstin;
      } else if (existingData.gstin) {
        // Never wipe previously configured GSTIN on empty/partial settings save
        updates.gstin = existingData.gstin;
      }
    }

    await docRef.set(updates, { merge: true });

    if (adminUser) {
      try {
        await db.collection('adminActivityLogs').add({
          adminUid: adminUser.uid || 'admin',
          adminEmail: adminUser.email || 'staff@lane4.in',
          action: 'store_settings_updated',
          resourceType: 'settings',
          resourceId: 'store_profile',
          details: updates,
          timestamp: new Date()
        });
      } catch (_) {}
    }

    return this.getStoreSettings();
  }
}

module.exports = new StoreSettingsService();
