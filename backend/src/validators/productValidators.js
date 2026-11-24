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
  body('name').trim().isLength({ min: 3 }).withMessage('Product name must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('A detailed product description (at least 10 characters) is required'),
  body('regularPricePaise').optional().isInt({ min: 1 }).withMessage('Regular price in paise must be > 0'),
  body('salePricePaise').optional().isInt({ min: 1 }).withMessage('Sale price in paise must be > 0'),
  body('regularPrice').optional().isFloat({ min: 0.01 }).withMessage('Regular price must be > 0'),
  body('salePrice').optional().isFloat({ min: 0.01 }).withMessage('Sale price must be > 0')
];

module.exports = {
  submitReviewValidator,
  moderateReviewValidator,
  createProductValidator
};

