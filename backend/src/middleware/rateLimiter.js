const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');
const { verifyAdminJwt } = require('../utils/adminToken');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 3000, // Generous 3,000 requests per 15 min per IP (~200 req/min)
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 1. Skip pre-flight CORS OPTIONS requests
    if (req.method === 'OPTIONS') return true;

    // 2. Skip health & prewarm checks
    const path = req.path || '';
    const url = req.originalUrl || '';
    if (path === '/health' || path === '/health/' || url.includes('/api/health')) {
      return true;
    }

    // 3. Skip authenticated admin requests (admin console operations & background sync)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      if (verifyAdminJwt(token)) {
        return true;
      }
    }

    // 4. In development, testing, or localhost/loopback, never rate limit
    if (process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost') {
      return true;
    }

    return false;
  },
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', null, 429);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 40, // 40 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1',
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many login attempts. Please wait 15 minutes.', null, 429);
  }
});

const paymentProofLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 50, // 50 uploads per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1',
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many proof uploads. Please wait a few minutes.', null, 429);
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentProofLimiter
};

