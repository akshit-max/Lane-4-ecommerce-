const shippingService = require('../services/shippingService');
const { sendSuccess } = require('../utils/response');

class ShippingController {
  async getSettings(req, res, next) {
    try {
      const settings = await shippingService.getShippingSettings();
      return sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  }

  async calculate(req, res, next) {
    try {
      const { subtotalPaise, postalCode } = req.query;
      const quote = await shippingService.calculateShipping(parseInt(subtotalPaise, 10) || 0, postalCode);
      return sendSuccess(res, quote);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShippingController();

