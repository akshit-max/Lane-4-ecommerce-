const { body } = require('express-validator');

const registerValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email address is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('displayName').trim().notEmpty().withMessage('Full name is required')
];

const loginValidator = [
  body('idToken').notEmpty().withMessage('Firebase ID token is required')
];

const adminLoginValidator = [
  body().custom((value, { req }) => {
    if (req.body.idToken) return true;
    if (req.body.email && req.body.password) return true;
    throw new Error('Either administrator email and password or valid Firebase ID token is required');
  })
];

module.exports = {
  registerValidator,
  loginValidator,
  adminLoginValidator
};

