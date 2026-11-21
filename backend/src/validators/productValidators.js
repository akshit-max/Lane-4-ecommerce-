const { body, param } = require('express-validator');

const submitReviewValidator = [
  param('id').notEmpty().withMessage('Product ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Review comment is required')
];

const moderateReviewValidator = [
  param('id').notEmpty().withMessage('Review ID is required'),
  body('status').isIn(['approved', 'rejected', 'pending']).withMessage('Status must be approved, rejected, or pending')
];

const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('regularPricePaise').isInt({ min: 0 }).withMessage('Regular price in paise must be >= 0')
];

module.exports = {
  submitReviewValidator,
  moderateReviewValidator,
  createProductValidator
};

