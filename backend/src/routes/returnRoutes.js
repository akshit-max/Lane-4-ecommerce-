const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.post(
  '/',
  optionalAuthenticate,
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('reason').notEmpty().withMessage('Return reason is required'),
    body('upiIdForRefund').notEmpty().withMessage('UPI ID for refund is required')
  ],
  validateRequest,
  returnController.submitReturn
);

router.get('/my-returns', authenticate, returnController.getMyReturns);

module.exports = router;

