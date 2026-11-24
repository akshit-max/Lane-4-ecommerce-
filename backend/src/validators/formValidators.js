const { body } = require('express-validator');

const enquiryValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.')
    .custom((val) => {
      if (/\d/.test(val)) {
        throw new Error('Name must not contain any numbers.');
      }
      if (!/^[a-zA-Z\s\.\'\-]+$/.test(val)) {
        throw new Error('Name must contain only alphabets and spaces.');
      }
      return true;
    }),
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().normalizeEmail().withMessage('Please enter a valid email address.'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .custom((val) => {
      const str = String(val).trim();
      if (/[a-zA-Z]/.test(str)) {
        throw new Error('Phone number must not contain any letters or text.');
      }
      const clean = str.replace(/[\s\-\(\)\+]/g, '');
      if (!/^(?:91)?[6-9]\d{9}$/.test(clean)) {
        throw new Error('Please enter a valid 10-digit Indian mobile number (numbers only).');
      }
      return true;
    }),
  body('message')
    .trim()
    .notEmpty().withMessage('Message / enquiry content is required.')
    .isLength({ min: 5, max: 5000 }).withMessage('Message must be at least 5 characters.')
];

const newsletterValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().normalizeEmail().withMessage('Valid email address is required.')
];

module.exports = {
  enquiryValidator,
  newsletterValidator
};

