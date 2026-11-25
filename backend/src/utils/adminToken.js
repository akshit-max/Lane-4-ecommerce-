const crypto = require('crypto');
const { config } = require('../config/environment');

function getAdminSecret() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET === 'lane4-admin-super-secure-key-2026-athletic-secret') {
      throw new Error('FATAL: Insecure or missing ADMIN_JWT_SECRET in production. Set a unique secret in environment variables.');
    }
  }
  return process.env.ADMIN_JWT_SECRET || 'lane4-admin-super-secure-key-2026-athletic-secret';
}

const DEFAULT_EXPIRY_SECONDS = parseInt(process.env.ADMIN_JWT_EXPIRY_SECONDS, 10) || (2 * 3600); // 2 hours default

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

function generateAdminJwt(payload, expiresInSeconds = DEFAULT_EXPIRY_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getAdminSecret())
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

function verifyAdminJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', getAdminSecret())
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
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateAdminJwt,
  verifyAdminJwt,
  DEFAULT_EXPIRY_SECONDS
};

