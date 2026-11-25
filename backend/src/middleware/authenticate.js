const { getAuth, getDb } = require('../config/firebaseAdmin');
const { sendError } = require('../utils/response');
const { logger } = require('../utils/logger');
const { verifyAdminJwt } = require('../utils/adminToken');
const { verifyCustomerJwt } = require('../utils/customerToken');

/**
 * Authentication Middleware:
 * Verifies Bearer ID token with Signed Admin JWT or Firebase Admin SDK.
 * Attaches decoded token and user profile to req.user.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication token required.', null, 401);
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // 1. Verify cryptographic Admin Session JWT
  const adminPayload = verifyAdminJwt(token);
  if (adminPayload) {
    const { ROLE_PERMISSIONS } = require('../constants/roles');
    const role = adminPayload.role || 'super_admin';
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    const permissions = (Array.isArray(adminPayload.permissions) && adminPayload.permissions.length > 0)
      ? adminPayload.permissions
      : rolePerms;

    req.user = {
      uid: adminPayload.uid,
      email: adminPayload.email,
      role,
      permissions,
      emailVerified: true,
      token: adminPayload
    };
    return next();
  }

  // 1b. Cryptographically Verified Customer Session JWT
  const customerPayload = verifyCustomerJwt(token);
  if (customerPayload) {
    // Invalidate session if password was reset after token issuance
    try {
      const db = getDb();
      if (db) {
        const userDoc = await db.collection('users').doc(customerPayload.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.passwordChangedAt) {
            const changedAtMs = userData.passwordChangedAt.toMillis
              ? userData.passwordChangedAt.toMillis()
              : new Date(userData.passwordChangedAt).getTime();
            const tokenIssuedMs = typeof customerPayload.iatMs === 'number'
              ? customerPayload.iatMs
              : (customerPayload.iat * 1000);

            if (tokenIssuedMs < changedAtMs) {
              return sendError(res, 'INVALID_TOKEN', 'Session has expired or token is invalid due to a recent password reset.', null, 401);
            }
          }
        }
      }
    } catch (authErr) {
      logger.warn('Failed session revocation check', { message: authErr.message });
    }

    req.user = {
      uid: customerPayload.uid,
      email: customerPayload.email,
      displayName: customerPayload.displayName || '',
      role: 'customer',
      permissions: [],
      emailVerified: Boolean(customerPayload.emailVerified),
      token: customerPayload
    };
    return next();
  }

  // 2. Fall back to Firebase Admin SDK ID token verification
  try {
    const auth = getAuth();
    if (!auth) {
      return sendError(res, 'AUTH_UNAVAILABLE', 'Authentication service is currently unavailable.', null, 503);
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'customer',
      permissions: decodedToken.permissions || [],
      emailVerified: decodedToken.email_verified || false,
      token: decodedToken
    };

    return next();
  } catch (error) {
    logger.warn('Failed token verification', { message: error.message });
    return sendError(res, 'INVALID_TOKEN', 'Session has expired or token is invalid.', null, 401);
  }
}

/**
 * Optional Authentication:
 * Attaches req.user if valid token present, but does not block guests.
 */
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // Check Admin JWT first
  const adminPayload = verifyAdminJwt(token);
  if (adminPayload) {
    const { ROLE_PERMISSIONS } = require('../constants/roles');
    const role = adminPayload.role || 'super_admin';
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    const permissions = (Array.isArray(adminPayload.permissions) && adminPayload.permissions.length > 0)
      ? adminPayload.permissions
      : rolePerms;

    req.user = {
      uid: adminPayload.uid,
      email: adminPayload.email,
      role,
      permissions,
      emailVerified: true,
      token: adminPayload
    };
    return next();
  }

  // Check Customer JWT
  const customerPayload = verifyCustomerJwt(token);
  if (customerPayload) {
    try {
      const db = getDb();
      if (db) {
        const userDoc = await db.collection('users').doc(customerPayload.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.passwordChangedAt) {
            const changedAtMs = userData.passwordChangedAt.toMillis
              ? userData.passwordChangedAt.toMillis()
              : new Date(userData.passwordChangedAt).getTime();
            const tokenIssuedMs = typeof customerPayload.iatMs === 'number'
              ? customerPayload.iatMs
              : (customerPayload.iat * 1000);

            if (tokenIssuedMs < changedAtMs) {
              req.user = null;
              return next();
            }
          }
        }
      }
    } catch (_) {}

    req.user = {
      uid: customerPayload.uid,
      email: customerPayload.email,
      displayName: customerPayload.displayName || '',
      role: 'customer',
      permissions: [],
      emailVerified: Boolean(customerPayload.emailVerified),
      token: customerPayload
    };
    return next();
  }

  try {
    const auth = getAuth();
    if (auth) {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || 'customer',
        permissions: decodedToken.permissions || [],
        emailVerified: decodedToken.email_verified || false
      };
    }
  } catch (e) {
    req.user = null;
  }

  return next();
}

module.exports = {
  authenticate,
  optionalAuthenticate
};

