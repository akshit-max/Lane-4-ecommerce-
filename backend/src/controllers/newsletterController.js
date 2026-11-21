const newsletterService = require('../services/newsletterService');
const { sendSuccess } = require('../utils/response');

class NewsletterController {
  async subscribe(req, res, next) {
    try {
      const { email, sourcePage } = req.body;
      const result = await newsletterService.subscribe(email, sourcePage);
      return sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NewsletterController();

