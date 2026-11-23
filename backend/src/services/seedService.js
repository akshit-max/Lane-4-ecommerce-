const crypto = require('crypto');
const productService = require('./productService');
const categoryService = require('./categoryService');
const couponService = require('./couponService');
const shippingService = require('./shippingService');
const paymentService = require('./paymentService');
const storeSettingsService = require('./storeSettingsService');
const { getDb, getAuth } = require('../config/firebaseAdmin');
const { config } = require('../config/environment');
const { logger } = require('../utils/logger');

class SeedService {
  async seedAll() {
    logger.info('Running database seed initialization check...');
    try {
      await categoryService.seedInitialCategories();
      await productService.seedInitialProducts();
      await couponService.seedInitialCoupons();
      await shippingService.seedInitialShippingSettings();
      await paymentService.seedInitialPaymentSettings();
      await storeSettingsService.seedInitialStoreSettings();
      await this.seedBootstrapAdmin();
      logger.info('Database seed check completed successfully.');
    } catch (err) {
      logger.error('Error during database seed initialization', err);
    }
  }

  async seedBootstrapAdmin() {
    const db = getDb();
    const auth = getAuth();
    if (!db || !auth) return;

    const email = config.adminBootstrap.email;
    const password = config.adminBootstrap.password;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    try {
      const snap = await db.collection('adminUsers').where('email', '==', email).limit(1).get();
      if (snap.empty) {
        logger.info(`Bootstrap admin user (${email}) not found in adminUsers. Creating...`);

        let uid = 'admin_lane4swim_in';
        try {
          const userRecord = await auth.getUserByEmail(email);
          uid = userRecord.uid;
        } catch (e) {
          // User doesn't exist in auth, create
          const newUser = await auth.createUser({
            uid: 'admin_lane4swim_in',
            email,
            password,
            displayName: 'LANE4 Chief Administrator',
            emailVerified: true
          });
          uid = newUser.uid || 'admin_lane4swim_in';
        }

        // Set custom claims: super_admin
        await auth.setCustomUserClaims(uid, {
          role: 'super_admin',
          permissions: [
            'dashboard:read',
            'orders:read',
            'orders:write',
            'payments:read',
            'payments:verify',
            'products:read',
            'products:write',
            'products:delete',
            'inventory:read',
            'inventory:write',
            'categories:write',
            'coupons:write',
            'customers:read',
            'settings:write',
            'reviews:write',
            'enquiries:read',
            'super_admin'
          ]
        });

        // Write to adminUsers document
        await db.collection('adminUsers').doc(uid).set({
          uid,
          email,
          passwordHash,
          displayName: 'LANE4 Chief Administrator',
          role: 'super_admin',
          permissions: [
            'dashboard:read',
            'orders:read',
            'orders:write',
            'payments:read',
            'payments:verify',
            'products:read',
            'products:write',
            'products:delete',
            'inventory:read',
            'inventory:write',
            'categories:write',
            'coupons:write',
            'customers:read',
            'settings:write',
            'reviews:write',
            'enquiries:read',
            'super_admin'
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        logger.info(`Bootstrap super administrator successfully registered with email: ${email}`);
      } else {
        const adminDoc = snap.docs[0];
        const data = adminDoc.data();
        if (!data.passwordHash) {
          await adminDoc.ref.update({
            passwordHash,
            updatedAt: new Date()
          });
          logger.info(`Bootstrap administrator passwordHash synced to Firestore document (${adminDoc.id}).`);
        }
      }
    } catch (err) {
      logger.error('Failed to create bootstrap admin account', err);
    }
  }
}

module.exports = new SeedService();
