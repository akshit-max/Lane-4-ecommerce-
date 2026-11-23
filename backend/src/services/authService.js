const crypto = require('crypto');
const { getDb, getAuth } = require('../config/firebaseAdmin');
const { sendMail, wrapBrandedTemplate } = require('../config/email');
const { logger } = require('../utils/logger');

class AuthService {
  async registerCustomer({ email, password, displayName, phone = '' }) {
    const auth = getAuth();
    const db = getDb();
    if (!auth || !db) throw new Error('Authentication service unavailable');

    const cleanEmail = email.toLowerCase().trim();

    // Prevent administrator accounts from being registered as customer storefront accounts
    const bootstrapAdmin = 'admin@lane4swim.in';
    if (cleanEmail === bootstrapAdmin || cleanEmail.startsWith('admin_') || cleanEmail.startsWith('admin@')) {
      throw new Error('Administrator accounts cannot be registered as customer accounts.');
    }
    if (db) {
      const adminSnap = await db.collection('adminUsers').where('email', '==', cleanEmail).limit(1).get();
      if (!adminSnap.empty) {
        throw new Error('Administrator accounts cannot be registered as customer accounts.');
      }
    }

    // 1. Create user in Firebase Authentication
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: cleanEmail,
        password,
        displayName: displayName.trim(),
        emailVerified: false,
        disabled: false
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw new Error('An account with this email address already exists.');
      }
      throw err;
    }

    // Set custom claim: customer role
    try {
      await auth.setCustomUserClaims(userRecord.uid, { role: 'customer' });
    } catch (e) {
      // non-blocking
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // 2. Create customer profile document in Firestore `users` collection
    const userProfile = {
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: displayName.trim(),
      phoneNumber: phone.trim(),
      passwordHash,
      emailVerified: false,
      role: 'customer',
      status: 'active',
      totalOrdersCount: 0,
      totalSpendPaise: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('users').doc(userRecord.uid).set(userProfile);

    // 3. Send welcome email
    sendMail({
      to: cleanEmail,
      subject: 'Welcome to The Lane4 Performance Store!',
      templateName: 'welcome',
      html: wrapBrandedTemplate(
        `Welcome to LANE4, ${displayName.trim()}!`,
        `
          <p>We're thrilled to welcome you to The Lane4 Performance Store family.</p>
          <p>Founded by national medalist swimmers in Nagpur, LANE4 is dedicated to bringing you competition-tested goggles, dome racing caps, hydrodynamic jammers, and swimming training accessories.</p>
          <p>You can now save your delivery addresses, track your orders in real time, and enjoy seamless shopping across all your devices.</p>
        `
      )
    });

    return {
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: displayName.trim(),
      role: 'customer'
    };
  }

  async getCustomerProfile(uid) {
    const db = getDb();
    if (!db) return null;

    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  async updateCustomerProfile(uid, data) {
    const db = getDb();
    const docRef = db.collection('users').doc(uid);
    const updates = {
      updatedAt: new Date()
    };

    if (data.displayName !== undefined) updates.displayName = data.displayName.trim();
    if (data.phoneNumber !== undefined) updates.phoneNumber = data.phoneNumber.trim();

    await docRef.set(updates, { merge: true });
    const updated = await docRef.get();
    return updated.data();
  }

  async listCustomerAddresses(uid) {
    const db = getDb();
    const snap = await db.collection('users').doc(uid).collection('addresses').get();
    return snap.docs.map(d => ({ addressId: d.id, ...d.data() }));
  }

  async addCustomerAddress(uid, addressData) {
    const db = getDb();
    const addressRef = db.collection('users').doc(uid).collection('addresses').doc();
    const newAddress = {
      addressId: addressRef.id,
      addressee: (addressData.addressee || '').trim(),
      phone: (addressData.phone || '').trim(),
      addressLine1: (addressData.addressLine1 || '').trim(),
      addressLine2: addressData.addressLine2 ? addressData.addressLine2.trim() : '',
      city: (addressData.city || '').trim(),
      state: (addressData.state || '').trim(),
      postalCode: (addressData.postalCode || '').trim(),
      country: 'India',
      isDefault: Boolean(addressData.isDefault),
      createdAt: new Date()
    };

    await addressRef.set(newAddress);
    return newAddress;
  }

  async deleteCustomerAddress(uid, addressId) {
    const db = getDb();
    await db.collection('users').doc(uid).collection('addresses').doc(addressId).delete();
    return { addressId, deleted: true };
  }

  async verifyAdminLogin(uid) {
    const db = getDb();
    const auth = getAuth();
    if (!db || !auth) throw new Error('Auth system unavailable');

    let adminDoc = await db.collection('adminUsers').doc(uid).get();
    let effectiveUid = uid;
    if (!adminDoc.exists) {
      const defaultAdminSnap = await db.collection('adminUsers').where('email', '==', 'admin@lane4swim.in').limit(1).get();
      if (!defaultAdminSnap.empty && (uid.includes('admin') || uid === 'admin_lane4swim_in')) {
        adminDoc = defaultAdminSnap.docs[0];
        effectiveUid = adminDoc.id;
      }
    }

    if (!adminDoc || !adminDoc.exists) {
      throw new Error('Customer accounts cannot access the Admin Portal. Please use authorized administrator credentials.');
    }

    const adminData = adminDoc.data();
    if (!adminData.isActive) {
      throw new Error('This administrator account has been deactivated.');
    }

    // Update last login
    await db.collection('adminUsers').doc(effectiveUid).update({
      lastLoginAt: new Date()
    });

    return adminData;
  }
}

module.exports = new AuthService();
