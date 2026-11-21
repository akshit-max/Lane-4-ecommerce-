const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validateRequest');
const { submitReviewValidator } = require('../validators');

router.get('/:id/reviews', reviewController.getProductReviews);

router.post(
  '/:id/reviews',
  optionalAuthenticate,
  submitReviewValidator,
  validateRequest,
  reviewController.submitReview
);

module.exports = router;

