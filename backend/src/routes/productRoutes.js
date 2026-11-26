const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const reviewController = require('../controllers/reviewController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validateRequest');
const { submitReviewValidator } = require('../validators');

// Public endpoints
router.get('/', productController.listProducts);
router.get('/:slug', optionalAuthenticate, productController.getProductBySlug);
router.get('/id/:id', productController.getProductById);

// Product reviews sub-resources
router.get('/:id/reviews', reviewController.getProductReviews);
router.post(
  '/:id/reviews',
  optionalAuthenticate,
  submitReviewValidator,
  validateRequest,
  reviewController.submitReview
);

module.exports = router;
