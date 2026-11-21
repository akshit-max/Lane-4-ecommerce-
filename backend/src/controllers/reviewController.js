const reviewService = require('../services/reviewService');
const { sendSuccess } = require('../utils/response');

class ReviewController {
  async getProductReviews(req, res, next) {
    try {
      const reviews = await reviewService.getProductReviews(req.params.id);
      return sendSuccess(res, reviews);
    } catch (err) {
      next(err);
    }
  }

  async submitReview(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const { rating, title, comment, authorName } = req.body;
      const review = await reviewService.submitReview({
        productId: req.params.id,
        rating,
        title,
        comment,
        authorName,
        customerId
      });
      return sendSuccess(res, review, 'Thank you! Your review has been submitted for moderation.', 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReviewController();

