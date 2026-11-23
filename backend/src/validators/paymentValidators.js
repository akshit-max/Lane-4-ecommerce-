const { body, param } = require('express-validator');

const submitProofValidator = [
  body('orderId').trim().notEmpty().withMessage('Associated Order ID is required'),
  body('upiReferenceNumber')
    .trim()
    .matches(/^\d{12}$/)
    .withMessage('Please enter a valid 12-digit numeric UPI Reference / UTR Number.')
];

const rejectPaymentValidator = [
  param('id').notEmpty().withMessage('Payment ID is required'),
  body('reason').trim().notEmpty().withMessage('Reason for payment rejection is required')
];

module.exports = {
  submitProofValidator,
  rejectPaymentValidator
};

