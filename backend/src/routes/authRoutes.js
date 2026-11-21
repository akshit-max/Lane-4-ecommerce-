const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
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

