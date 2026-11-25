const crypto = require('crypto');

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'lane4-customer-signing-key-2026-surge-athletic-secret');
const DEFAULT_EXPIRY_SECONDS = parseInt(process.env.CUSTOMER_JWT_EXPIRY_SECONDS, 10) || (30 * 24 * 3600); // 30 days default

function getCustomerSecret() {
  if (!CUSTOMER_JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: CUSTOMER_JWT_SECRET environment variable is required in production.');
    }
    return 'lane4-customer-signing-key-2026-surge-athletic-secret';
  }
  return CUSTOMER_JWT_SECRET;
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function generateCustomerJwt(payload, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  const secret = getCustomerSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);
  const fullPayload = {
    ...payload,
    role: 'customer',
    iat: now,
    iatMs: nowMs,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

function verifyCustomerJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    const secret = getCustomerSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature.length !== expectedSignature.length) return null;
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    if (payload.role !== 'customer') {
      return null; // Must have customer role
    }
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateCustomerJwt,
  verifyCustomerJwt,
  DEFAULT_EXPIRY_SECONDS
};

