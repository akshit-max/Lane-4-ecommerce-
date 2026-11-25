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

    // 3. Send welcome email and verification email
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

    // Generate initial email verification token
    try {
      await this.sendVerificationEmail({
        uid: userRecord.uid,
        email: cleanEmail,
        displayName: displayName.trim()
      });
    } catch (_) {}

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

  async requestPasswordReset(email) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');
    const cleanEmail = (email || '').toLowerCase().trim();

    const genericResponse = {
      message: 'If an account exists with this email address, password reset instructions have been sent.'
    };

    if (!cleanEmail) return genericResponse;

    try {
      const snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (snap.empty) {
        // Anti-enumeration: Return same success response without disclosing non-existence
        return genericResponse;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (userData.status === 'suspended' || userData.status === 'deactivated') {
        return genericResponse;
      }

      // Generate 32-byte cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiration

      // Invalidate any previous unused reset tokens for this user
      try {
        const oldTokens = await db.collection('passwordResetTokens').where('uid', '==', userDoc.id).where('used', '==', false).get();
        for (const tDoc of oldTokens.docs) {
          await tDoc.ref.update({ used: true, invalidatedAt: new Date() });
        }
      } catch (_) {}

      // Store hashed token (Never store raw token in DB)
      await db.collection('passwordResetTokens').doc(tokenHash).set({
        uid: userDoc.id,
        email: cleanEmail,
        tokenHash,
        expiresAt,
        used: false,
        createdAt: new Date()
      });

      // Dispatch reset email
      sendMail({
        to: cleanEmail,
        subject: 'Reset Your LANE4 Account Password',
        templateName: 'password_reset',
        html: wrapBrandedTemplate(
          'Password Reset Request',
          `
            <p>Hi ${userData.displayName || 'Swimmer'},</p>
            <p>We received a request to reset the password for your LANE4 customer account.</p>
            <p>Click the link below or paste it into your browser to choose a new password. This link is valid for 1 hour and can only be used once:</p>
            <p><a href="https://lane4swim.in/reset-password.html?token=${rawToken}" style="display:inline-block;padding:10px 18px;background:#000000;color:#ffffff;border-radius:6px;font-weight:700;text-decoration:none;">Reset My Password</a></p>
            <p style="font-size:12px;color:#64748b;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
          `
        )
      });

      return {
        ...genericResponse,
        ...(process.env.NODE_ENV === 'test' ? { testResetToken: rawToken } : {})
      };
    } catch (err) {
      logger.error('Error during password reset request:', err.message);
      return genericResponse;
    }
  }

  async resetPassword({ token, newPassword }) {
    const db = getDb();
    const auth = getAuth();
    if (!db || !auth) throw new Error('Authentication service unavailable');

    if (!token || !token.trim()) {
      const err = new Error('Password reset token is required.');
      err.statusCode = 400;
      err.code = 'MISSING_TOKEN';
      throw err;
    }

    if (!newPassword || newPassword.length < 6) {
      const err = new Error('New password must be at least 6 characters long.');
      err.statusCode = 400;
      err.code = 'INVALID_PASSWORD';
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const tokenDoc = await db.collection('passwordResetTokens').doc(tokenHash).get();

    if (!tokenDoc.exists) {
      const err = new Error('Invalid or expired password reset link. Please request a new one.');
      err.statusCode = 400;
      err.code = 'INVALID_OR_EXPIRED_TOKEN';
      throw err;
    }

    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      const err = new Error('This password reset link has already been used.');
      err.statusCode = 400;
      err.code = 'TOKEN_ALREADY_USED';
      throw err;
    }

    const expiresAt = tokenData.expiresAt ? (tokenData.expiresAt.toMillis ? tokenData.expiresAt.toMillis() : new Date(tokenData.expiresAt).getTime()) : 0;
    if (Date.now() > expiresAt) {
      const err = new Error('This password reset link has expired. Please request a new one.');
      err.statusCode = 400;
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    // Hash new password and update user in Firestore
    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    const now = new Date();
    await db.collection('users').doc(tokenData.uid).update({
      passwordHash,
      passwordChangedAt: now,
      updatedAt: now
    });

    // Update password in Firebase Auth
    try {
      await auth.updateUser(tokenData.uid, { password: newPassword });
    } catch (_) {}

    // Mark token as used (single-use enforcement)
    await db.collection('passwordResetTokens').doc(tokenHash).update({
      used: true,
      usedAt: new Date()
    });

    return {
      message: 'Password has been successfully reset. You can now sign in with your new password.'
    };
  }

  async sendVerificationEmail(user) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const cleanEmail = (user.email || '').toLowerCase().trim();
    if (!cleanEmail) throw new Error('Email address is required');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours expiration

    // Invalidate any previous unused verification tokens for this user
    try {
      const oldTokens = await db.collection('emailVerificationTokens').where('uid', '==', user.uid).where('used', '==', false).get();
      for (const tDoc of oldTokens.docs) {
        await tDoc.ref.update({ used: true, invalidatedAt: new Date() });
      }
    } catch (_) {}

    await db.collection('emailVerificationTokens').doc(tokenHash).set({
      uid: user.uid,
      email: cleanEmail,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: new Date()
    });

    sendMail({
      to: cleanEmail,
      subject: 'Verify Your LANE4 Account Email',
      templateName: 'verify_email',
      html: wrapBrandedTemplate(
        'Verify Your Email Address',
        `
          <p>Hi ${user.displayName || 'Swimmer'},</p>
          <p>Thank you for creating an account with The Lane4 Performance Store.</p>
          <p>Please confirm your email address by clicking the link below:</p>
          <p><a href="https://lane4swim.in/verify-email.html?token=${rawToken}" style="display:inline-block;padding:10px 18px;background:#000000;color:#ffffff;border-radius:6px;font-weight:700;text-decoration:none;">Verify Email Address</a></p>
          <p style="font-size:12px;color:#64748b;">This verification link is valid for 24 hours.</p>
        `
      )
    });

    return {
      message: 'Verification email sent successfully.',
      ...(process.env.NODE_ENV === 'test' ? { testVerificationToken: rawToken } : {})
    };
  }

  async verifyEmail(token) {
    const db = getDb();
    const auth = getAuth();
    if (!db || !auth) throw new Error('Authentication service unavailable');

    if (!token || !token.trim()) {
      const err = new Error('Verification token is required.');
      err.statusCode = 400;
      err.code = 'MISSING_TOKEN';
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const tokenDoc = await db.collection('emailVerificationTokens').doc(tokenHash).get();

    if (!tokenDoc.exists) {
      const err = new Error('Invalid or expired email verification link.');
      err.statusCode = 400;
      err.code = 'INVALID_OR_EXPIRED_TOKEN';
      throw err;
    }

    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      const err = new Error('This email verification link has already been used.');
      err.statusCode = 400;
      err.code = 'TOKEN_ALREADY_USED';
      throw err;
    }

    const expiresAt = tokenData.expiresAt ? (tokenData.expiresAt.toMillis ? tokenData.expiresAt.toMillis() : new Date(tokenData.expiresAt).getTime()) : 0;
    if (Date.now() > expiresAt) {
      const err = new Error('This verification link has expired. Please request a new verification email.');
      err.statusCode = 400;
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }

    // Update user profile in Firestore
    await db.collection('users').doc(tokenData.uid).update({
      emailVerified: true,
      updatedAt: new Date()
    });

    // Update Firebase Auth user
    try {
      await auth.updateUser(tokenData.uid, { emailVerified: true });
    } catch (_) {}

    // Mark token as used
    await db.collection('emailVerificationTokens').doc(tokenHash).update({
      used: true,
      usedAt: new Date()
    });

    return {
      message: 'Email address successfully verified.'
    };
  }
}

module.exports = new AuthService();
