const { body } = require('express-validator');

const enquiryValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid contact email is required'),
  body('message').trim().notEmpty().withMessage('Message / enquiry content is required')
];

const newsletterValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email address is required')
];

module.exports = {
  enquiryValidator,
  newsletterValidator
};

