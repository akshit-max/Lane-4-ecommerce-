const { body, param } = require('express-validator');

const submitProofValidator = [
  body('orderId').trim().notEmpty().withMessage('Associated Order ID is required'),
  body('upiReferenceNumber')
    .trim()
    .matches(/^\d{12}$/)
    .withMessage('Please enter a valid 12-digit numeric UPI Reference / UTR Number.')
    .custom((val) => {
      if (/^0{12}$/.test(String(val).trim())) {
        throw new Error('Please enter a valid 12-digit numeric UPI Reference / UTR Number (placeholder 000000000000 is not accepted).');
      }
      return true;
    })
];

const approvePaymentValidator = [
  param('id').notEmpty().withMessage('Payment ID is required'),
  body().custom((b) => {
    const note = (b.internalNote || b.approvalNote || b.note || '').trim();
    if (!note || note.length < 3) {
      throw new Error('A non-empty approval note (at least 3 characters) is required to approve payments.');
    }
    return true;
  })
];

const rejectPaymentValidator = [
  param('id').notEmpty().withMessage('Payment ID is required'),
  body('reason').trim().notEmpty().withMessage('Reason for payment rejection is required')
];

module.exports = {
  submitProofValidator,
  approvePaymentValidator,
  rejectPaymentValidator
};

