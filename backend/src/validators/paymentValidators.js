const { body, param } = require('express-validator');

const submitProofValidator = [
  body('orderId').trim().notEmpty().withMessage('Associated Order ID is required'),
  body('upiReferenceNumber')
    .trim()
    .isLength({ min: 6 })
    .withMessage('Valid UPI Reference / UTR Number (min 6 characters) is required')
];

const rejectPaymentValidator = [
  param('id').notEmpty().withMessage('Payment ID is required'),
  body('reason').trim().notEmpty().withMessage('Reason for payment rejection is required')
];

module.exports = {
  submitProofValidator,
  rejectPaymentValidator
};

