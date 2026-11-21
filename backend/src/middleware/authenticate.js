const { getAuth } = require('../config/firebaseAdmin');
const { sendError } = require('../utils/response');
const { logger } = require('../utils/logger');
const { verifyAdminJwt } = require('../utils/adminToken');

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
    req.user = {
      uid: adminPayload.uid,
      email: adminPayload.email,
      role: adminPayload.role || 'super_admin',
      permissions: adminPayload.permissions || [],
      emailVerified: true,
      token: adminPayload
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
    req.user = {
      uid: adminPayload.uid,
      email: adminPayload.email,
      role: adminPayload.role || 'super_admin',
      permissions: adminPayload.permissions || [],
      emailVerified: true,
      token: adminPayload
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

