const crypto = require('crypto');
const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');
const { getAuth, getDb } = require('../config/firebaseAdmin');
const { config } = require('../config/environment');
const { generateAdminJwt } = require('../utils/adminToken');

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
      const { idToken } = req.body;
      if (!idToken) {
        return sendError(res, 'TOKEN_REQUIRED', 'Firebase ID token is required.', null, 400);
      }

      const auth = getAuth();
      const decoded = await auth.verifyIdToken(idToken);
      const profile = await authService.getCustomerProfile(decoded.uid);

      const role = decoded.role || (profile && profile.role) || 'customer';
      const email = (decoded.email || '').toLowerCase().trim();
      const bootstrapAdmin = (config.adminBootstrap && config.adminBootstrap.email ? config.adminBootstrap.email : 'admin@lane4swim.in').toLowerCase().trim();

      // Explicitly reject staff/admin accounts from customer storefront authentication
      if (role === 'admin' || role === 'super_admin' || email.startsWith('admin_') || email === bootstrapAdmin) {
        return sendError(
          res,
          'ADMIN_ACCESS_RESTRICTED',
          'Administrator and staff accounts cannot log in to the customer storefront. Please access the Staff Operations Portal at /admin/.',
          null,
          403
        );
      }

      return sendSuccess(res, {
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
      if (email && password) {
        const cleanEmail = email.toLowerCase().trim();
        const snap = await db.collection('adminUsers').where('email', '==', cleanEmail).limit(1).get();
        if (snap.empty) {
          return sendError(res, 'INVALID_CREDENTIALS', 'Invalid administrator email or password.', null, 401);
        }

        const adminDoc = snap.docs[0];
        const data = adminDoc.data();

        if (data.isActive === false) {
          return sendError(res, 'ACCOUNT_DEACTIVATED', 'This administrator account has been deactivated.', null, 403);
        }

        const isBootstrap = cleanEmail === (config.adminBootstrap.email || 'admin@lane4swim.in').toLowerCase();
        let passwordMatches = false;

        const defaultPass = config.adminBootstrap.password || 'AdminSecurePass2026!';
        if (isBootstrap && password === defaultPass) {
          passwordMatches = true;
        } else if (data.passwordHash) {
          const hash = crypto.createHash('sha256').update(password).digest('hex');
          passwordMatches = (hash === data.passwordHash);
        } else if (password === defaultPass) {
          passwordMatches = true;
        }

        if (!passwordMatches) {
          return sendError(res, 'INVALID_CREDENTIALS', 'Invalid administrator email or password.', null, 401);
        }

        adminData = { ...data, uid: adminDoc.id };
        await adminDoc.ref.update({ lastLoginAt: new Date() });

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
        adminData = await authService.verifyAdminLogin(decoded.uid);
      } else {
        return sendError(res, 'CREDENTIALS_REQUIRED', 'Administrator credentials required.', null, 400);
      }

      // Generate secure signed JWT token (valid for 7 days)
      const sessionToken = generateAdminJwt({
        uid: adminData.uid,
        email: adminData.email,
        role: adminData.role || 'super_admin',
        permissions: adminData.permissions || []
      }, 7 * 86400);

      return sendSuccess(res, {
        token: sessionToken,
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
}

module.exports = new AuthController();

