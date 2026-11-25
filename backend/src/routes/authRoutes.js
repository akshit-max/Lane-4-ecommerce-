const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
const { body } = require('express-validator');
const {
  registerValidator,
  loginValidator,
  adminLoginValidator
} = require('../validators');

router.post(
  '/register',
  authLimiter,
  registerValidator,
  validateRequest,
  authController.register
);

router.post(
  '/login',
  authLimiter,
  loginValidator,
  validateRequest,
  authController.login
);

router.get('/me', authenticate, authController.getMe);

router.post(
  '/forgot-password',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail()
  ],
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required').trim(),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
  ],
  validateRequest,
  authController.resetPassword
);

router.post(
  '/send-verification-email',
  authenticate,
  authController.sendVerificationEmail
);

router.post(
  '/verify-email',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Verification token is required').trim()
  ],
  validateRequest,
  authController.verifyEmail
);

router.post(
  '/admin/login',
  authLimiter,
  adminLoginValidator,
  validateRequest,
  authController.adminLogin
);

router.get(
  '/admin/verify',
  authenticate,
  authController.adminVerify
);

module.exports = router;

