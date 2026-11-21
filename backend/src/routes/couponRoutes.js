const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.post(
  '/validate',
  optionalAuthenticate,
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('subtotalPaise').isInt({ min: 0 }).withMessage('Valid subtotal is required')
  ],
  validateRequest,
  couponController.validate
);

module.exports = router;

