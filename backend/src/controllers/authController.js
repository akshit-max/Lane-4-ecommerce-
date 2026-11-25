const crypto = require('crypto');
const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');
const { getAuth, getDb } = require('../config/firebaseAdmin');
const { config } = require('../config/environment');
const { generateAdminJwt } = require('../utils/adminToken');
const { generateCustomerJwt } = require('../utils/customerToken');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, displayName, phone } = req.body;
      const user = await authService.registerCustomer({ email, password, displayName, phone });
      return sendSuccess(res, user, 'Account created successfully. Please sign in.', 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { idToken, email, password } = req.body;
      const auth = getAuth();
      const db = getDb();

      // 1. Password-based Customer Sign-In
      if (email && password) {
        const cleanEmail = email.toLowerCase().trim();
        const bootstrapAdmin = (config.adminBootstrap && config.adminBootstrap.email ? config.adminBootstrap.email : 'admin@lane4swim.in').toLowerCase().trim();

        if (cleanEmail === bootstrapAdmin || cleanEmail.startsWith('admin_') || cleanEmail.startsWith('admin@')) {
          return sendError(
            res,
            'ADMIN_ACCESS_RESTRICTED',
            'Administrator accounts cannot sign in to the customer storefront.',
            null,
            403
          );
        }

        if (db) {
          const adminSnap = await db.collection('adminUsers').where('email', '==', cleanEmail).limit(1).get();
          if (!adminSnap.empty) {
            return sendError(
              res,
              'ADMIN_ACCESS_RESTRICTED',
              'Administrator accounts cannot sign in to the customer storefront.',
              null,
              403
            );
          }

          const userSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
          if (userSnap.empty) {
            return sendError(res, 'USER_NOT_FOUND', 'No customer account found with this email. Please create an account.', null, 401);
          }

          const userDoc = userSnap.docs[0];
          const userData = userDoc.data();

          if (userData.status === 'suspended' || userData.status === 'deactivated') {
            return sendError(res, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated. Please contact support.', null, 403);
          }

          const inputHash = crypto.createHash('sha256').update(password).digest('hex');
          if (userData.passwordHash && userData.passwordHash !== inputHash) {
            return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email address or password. Please try again.', null, 401);
          }

          const custToken = generateCustomerJwt({
            uid: userDoc.id,
            email: cleanEmail,
            displayName: userData.displayName || '',
            phoneNumber: userData.phoneNumber || '',
            emailVerified: Boolean(userData.emailVerified)
          });
          return sendSuccess(res, {
            token: custToken,
            user: {
              uid: userDoc.id,
              email: cleanEmail,
              displayName: userData.displayName || '',
              phoneNumber: userData.phoneNumber || '',
              emailVerified: Boolean(userData.emailVerified),
              role: 'customer'
            }
          }, 'Signed in successfully.');
        }
      }

      if (!idToken) {
        return sendError(res, 'TOKEN_REQUIRED', 'Email/password or Firebase ID token is required.', null, 400);
      }

      const decoded = await auth.verifyIdToken(idToken);
      let profile = await authService.getCustomerProfile(decoded.uid);
      if (!profile && db && email) {
        // Try looking up by email in users collection
        const existingSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!existingSnap.empty) {
          profile = existingSnap.docs[0].data();
        }
      }

      // If user document does not exist yet in users collection, create it immediately
      if (!profile && db && email) {
        profile = {
          uid: decoded.uid,
          email,
          displayName: decoded.name || decoded.displayName || (email.split('@')[0] ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'Swimmer'),
          phoneNumber: decoded.phoneNumber || '',
          emailVerified: Boolean(decoded.email_verified),
          role: 'customer',
          status: 'active',
          totalOrdersCount: 0,
          totalSpendPaise: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await db.collection('users').doc(decoded.uid).set(profile, { merge: true });
      }

      const role = decoded.role || (profile && profile.role) || 'customer';
      const userEmail = (decoded.email || email || '').toLowerCase().trim();
      const bootstrapAdmin = (config.adminBootstrap && config.adminBootstrap.email ? config.adminBootstrap.email : 'admin@lane4swim.in').toLowerCase().trim();

      // Check if user is an administrator
      let isAdminAccount = role === 'admin' || role === 'super_admin' || role === 'order_manager' || role === 'product_manager' || role === 'inventory_manager' || userEmail.startsWith('admin_') || userEmail === bootstrapAdmin;
      if (!isAdminAccount && db && userEmail) {
        const adminSnap = await db.collection('adminUsers').where('email', '==', userEmail).limit(1).get();
        if (!adminSnap.empty) {
          isAdminAccount = true;
        }
      }

      // Explicitly reject staff/admin accounts from customer storefront authentication
      if (isAdminAccount) {
        return sendError(
          res,
          'ADMIN_ACCESS_RESTRICTED',
          'Administrator accounts cannot sign in to the customer storefront.',
          null,
          403
        );
      }

      const custToken = generateCustomerJwt({
        uid: decoded.uid,
        email: userEmail,
        displayName: (profile && profile.displayName) || decoded.name || '',
        phoneNumber: decoded.phoneNumber || (profile && profile.phoneNumber) || ''
      });

      return sendSuccess(res, {
        token: custToken,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          displayName: (profile && profile.displayName) || decoded.name || '',
          role: 'customer'
        }
      }, 'Signed in successfully.');
    } catch (err) {
      return sendError(res, 'INVALID_CREDENTIALS', err.message || 'Authentication failed.', null, 401);
    }
  }

  async getMe(req, res, next) {
    try {
      const profile = await authService.getCustomerProfile(req.user.uid);
      return sendSuccess(res, {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        profile: profile || {}
      });
    } catch (err) {
      next(err);
    }
  }

  async adminLogin(req, res, next) {
    try {
      const { idToken, email, password } = req.body;
      const db = getDb();
      const auth = getAuth();

      let adminData = null;

      // 1. Password-based Administrator Authentication
      if (email !== undefined || password !== undefined) {
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
          return sendError(res, 'INVALID_CREDENTIALS', 'Administrator email and password are required and cannot be empty.', null, 401);
        }

        const cleanEmail = email.toLowerCase().trim();
        const snap = await db.collection('adminUsers').where('email', '==', cleanEmail).limit(1).get();
        if (snap.empty) {
          // Reject normal customer accounts attempting to sign in to the admin console
          if (db) {
            const customerSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
            if (!customerSnap.empty) {
              return sendError(
                res,
                'CUSTOMER_ACCESS_DENIED',
                'Customer accounts cannot access the Admin Portal. Please use authorized administrator credentials.',
                null,
                403
              );
            }
          }
          return sendError(res, 'INVALID_CREDENTIALS', 'Invalid administrator email or password.', null, 401);
        }

        const adminDoc = snap.docs[0];
        const data = adminDoc.data();

        if (data.isActive === false) {
          return sendError(res, 'ACCOUNT_DEACTIVATED', 'This administrator account has been deactivated.', null, 403);
        }

        const submittedHash = crypto.createHash('sha256').update(password).digest('hex');
        const defaultPass = config.adminBootstrap.password || 'AdminSecurePass2026!';
        const defaultHash = crypto.createHash('sha256').update(defaultPass).digest('hex');

        let passwordMatches = false;
        if (data.passwordHash) {
          // Strictly verify against the hashed password stored in the database document
          passwordMatches = (submittedHash === data.passwordHash);
        } else if (password === defaultPass || submittedHash === defaultHash) {
          // Migrate legacy record to store hashed password directly in Firestore
          passwordMatches = true;
          await adminDoc.ref.update({ passwordHash: submittedHash, updatedAt: new Date() });
        }

        if (!passwordMatches) {
          return sendError(res, 'INVALID_CREDENTIALS', 'Invalid administrator email or password.', null, 401);
        }

        adminData = { ...data, uid: adminDoc.id };
        if (adminDoc.ref && typeof adminDoc.ref.update === 'function') {
          try { await adminDoc.ref.update({ lastLoginAt: new Date() }); } catch (_) {}
        } else if (db && db.collection) {
          try { await db.collection('adminUsers').doc(adminDoc.id).update({ lastLoginAt: new Date() }); } catch (_) {}
        }

        // Record successful admin login in audit log
        try {
          await db.collection('adminActivityLogs').add({
            action: 'admin_login',
            adminEmail: adminData.email,
            adminUid: adminData.uid,
            resourceType: 'adminUsers',
            resourceId: adminDoc.id,
            details: {
              ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
              userAgent: req.headers['user-agent'] || 'Browser'
            },
            timestamp: new Date()
          });
        } catch (_) {}
      } else if (idToken) {
        // 2. Firebase ID Token Authentication
        if (!auth) {
          return sendError(res, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.', null, 503);
        }
        const decoded = await auth.verifyIdToken(idToken);
        if (db) {
          const customerDoc = await db.collection('users').doc(decoded.uid).get();
          if (customerDoc.exists && customerDoc.data().role !== 'admin' && customerDoc.data().role !== 'super_admin') {
            return sendError(
              res,
              'CUSTOMER_ACCESS_DENIED',
              'Customer accounts cannot access the Admin Portal. Please use authorized administrator credentials.',
              null,
              403
            );
          }
        }
        adminData = await authService.verifyAdminLogin(decoded.uid);
      } else {
        return sendError(res, 'CREDENTIALS_REQUIRED', 'Administrator credentials required.', null, 400);
      }

      // Generate secure signed JWT token (valid for appropriate interval: 2 hours default)
      const expirySeconds = parseInt(process.env.ADMIN_JWT_EXPIRY_SECONDS, 10) || 7200;
      const sessionToken = generateAdminJwt({
        uid: adminData.uid,
        email: adminData.email,
        role: adminData.role || 'super_admin',
        permissions: adminData.permissions || []
      }, expirySeconds);

      return sendSuccess(res, {
        token: sessionToken,
        expiresIn: expirySeconds,
        expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
        admin: {
          uid: adminData.uid,
          email: adminData.email,
          displayName: adminData.displayName || 'Chief Administrator',
          role: adminData.role || 'super_admin',
          permissions: adminData.permissions || []
        }
      }, 'Administrator authenticated successfully.');
    } catch (err) {
      return sendError(res, 'FORBIDDEN', err.message || 'Administrator access denied.', null, 403);
    }
  }

  async adminVerify(req, res, next) {
    try {
      if (!req.user || !['super_admin', 'admin', 'order_manager', 'product_manager', 'inventory_manager'].includes(req.user.role)) {
        return sendError(res, 'FORBIDDEN', 'Access restricted to authorized store staff.', null, 403);
      }

      // Query database to ensure admin user still exists and isActive !== false
      const db = getDb();
      if (db && req.user.uid) {
        const adminDoc = await db.collection('adminUsers').doc(req.user.uid).get();
        if (!adminDoc.exists) {
          return sendError(res, 'FORBIDDEN', 'Administrator account not found in database.', null, 403);
        }
        const adminData = adminDoc.data();
        if (adminData.isActive === false) {
          return sendError(res, 'ACCOUNT_DEACTIVATED', 'This administrator account has been deactivated.', null, 403);
        }
      }

      return sendSuccess(res, {
        valid: true,
        admin: {
          uid: req.user.uid,
          email: req.user.email,
          role: req.user.role,
          permissions: req.user.permissions || []
        }
      }, 'Administrator session is valid.');
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.requestPasswordReset(email);
      return sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword({ token, newPassword });
      return sendSuccess(res, result, result.message);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'RESET_PASSWORD_ERROR',
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  async sendVerificationEmail(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }
      const result = await authService.sendVerificationEmail(req.user);
      return sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      return sendSuccess(res, result, result.message);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'VERIFY_EMAIL_ERROR',
            message: err.message
          }
        });
      }
      next(err);
    }
  }
}

module.exports = new AuthController();

