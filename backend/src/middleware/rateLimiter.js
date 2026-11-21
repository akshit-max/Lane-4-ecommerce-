const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', null, 429);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many login attempts. Please wait 15 minutes.', null, 429);
  }
});

const paymentProofLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // max 20 uploads per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many proof uploads. Please wait a few minutes.', null, 429);
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentProofLimiter
};

