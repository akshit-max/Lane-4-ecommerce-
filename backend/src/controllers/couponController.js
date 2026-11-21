const couponService = require('../services/couponService');
const { sendSuccess } = require('../utils/response');

class CouponController {
  async validate(req, res, next) {
    try {
      const { code, subtotalPaise } = req.body;
      const customerId = req.user ? req.user.uid : null;
      const result = await couponService.validateCoupon({
        code,
        subtotalPaise: parseInt(subtotalPaise, 10) || 0,
        customerId
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CouponController();

