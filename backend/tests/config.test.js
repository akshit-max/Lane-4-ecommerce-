const { config, checkEnvironmentStatus } = require('../src/config/environment');
const { rupeesToPaise, paiseToRupees, formatINR } = require('../src/utils/currency');
const { initFirebase, getDb, isFirebaseConfigured } = require('../src/config/firebaseAdmin');

describe('Configuration & Currency Math Test Suite', () => {
  test('Environment checks return valid status object without throwing', () => {
    const status = checkEnvironmentStatus();
    expect(status).toHaveProperty('firebaseConfigured');
    expect(status).toHaveProperty('cloudinaryConfigured');
    expect(status).toHaveProperty('emailConfigured');
  });

  test('Currency conversion handles integers, decimals, strings, and zero cleanly', () => {
    expect(rupeesToPaise(1499.00)).toBe(149900);
    expect(rupeesToPaise('₹ 1,499.00')).toBe(149900);
    expect(rupeesToPaise(399)).toBe(39900);
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(-10)).toBe(0);

    expect(paiseToRupees(149900)).toBe(1499.00);
    expect(paiseToRupees(39900)).toBe(399.00);
    expect(paiseToRupees(0)).toBe(0);

    const formatted = formatINR(149900);
    expect(formatted).toContain('1,499.00');
  });

  test('Firebase Admin initialization exports valid db and auth objects', () => {
    const { db, auth } = initFirebase();
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
    expect(typeof db.collection).toBe('function');
  });
});

