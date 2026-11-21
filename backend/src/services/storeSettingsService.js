const { getDb } = require('../config/firebaseAdmin');

const DEFAULT_STORE_SETTINGS = {
  storeName: 'The Lane4 Performance Store',
  supportEmail: 'Lane4performancestore@gmail.com',
  supportPhone: '+91 79725 41297',
  storeAddress: 'Nagpur, Maharashtra, India',
  instagramUrl: 'https://www.instagram.com/lane4.ps_swim.india',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=The+Lane4+Performance+Store+Nagpur+Maharashtra',
  announcementBanner: {
    enabled: true,
    text: 'PAN India Delivery · Founded by National Medalist Swimmers in Nagpur'
  }
};

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
    if (!db) return DEFAULT_STORE_SETTINGS;

    const doc = await db.collection('storeSettings').doc('profile').get();
    if (!doc.exists) return DEFAULT_STORE_SETTINGS;
    return doc.data();
  }

  async updateStoreSettings(data, adminUser) {
    const db = getDb();
    const docRef = db.collection('storeSettings').doc('profile');
    const updates = {
      ...data,
      updatedAt: new Date()
    };
    await docRef.set(updates, { merge: true });
    return this.getStoreSettings();
  }
}

module.exports = new StoreSettingsService();

