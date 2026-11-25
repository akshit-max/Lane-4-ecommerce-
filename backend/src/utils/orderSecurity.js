const crypto = require('crypto');

function getSecret() {
  return process.env.CUSTOMER_JWT_SECRET || 'lane4-customer-signing-key-2026-surge-athletic-secret';
}

/**
 * Generate a secure, HMAC-SHA256 order-specific credential for guest order verification
 */
function generateOrderAccessToken(orderId, customerEmail) {
  if (!orderId || !customerEmail) return '';
  const cleanId = String(orderId).trim();
  const cleanEmail = String(customerEmail).toLowerCase().trim();
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${cleanId}:${cleanEmail}`)
    .digest('hex');
}

/**
 * Verify order access token in constant time
 */
function verifyOrderAccessToken(orderId, customerEmail, providedToken) {
  if (!orderId || !customerEmail || !providedToken || typeof providedToken !== 'string') {
    return false;
  }
  const expected = generateOrderAccessToken(orderId, customerEmail);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedToken.trim());
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = {
  generateOrderAccessToken,
  verifyOrderAccessToken
};

