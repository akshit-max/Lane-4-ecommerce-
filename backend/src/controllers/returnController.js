const returnService = require('../services/returnService');
const { sendSuccess } = require('../utils/response');

class ReturnController {
  async submitReturn(req, res, next) {
    try {
      const { orderId, items, reason, upiIdForRefund, orderAccessToken } = req.body;
      const token = orderAccessToken || req.headers['x-order-token'] || '';
      const returnRecord = await returnService.submitReturn(
        { orderId, items, reason, upiIdForRefund, orderAccessToken: token },
        req.user
      );
      return sendSuccess(res, returnRecord, 'Return request submitted. Our team will review and contact you.', 201);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || (err.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED'),
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  async getMyReturns(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const returns = await returnService.getMyReturns(req.user.uid);
      return sendSuccess(res, returns);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReturnController();

