/**
 * Safe Logger with Credential Sanitization
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'idtoken',
  'refreshtoken',
  'privatekey',
  'private_key',
  'apisecret',
  'api_secret',
  'secret',
  'smtp_password',
  'authorization'
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const logger = {
  info: (msg, meta = {}) => {
    if (process.env.VERBOSE === 'true' || process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug') {
      console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
    }
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },
  error: (msg, err = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err instanceof Error ? err.stack : JSON.stringify(sanitize(err)));
  }
};

module.exports = {
  logger,
  sanitize
};

