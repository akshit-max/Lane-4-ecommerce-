const orderService = require('../services/orderService');
const { sendSuccess } = require('../utils/response');

class OrderController {
  async calculateQuote(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const { items, couponCode, guestId } = req.body;
      const quote = await orderService.calculateQuote({
        items,
        couponCode,
        guestId,
        customerId
      });
      return sendSuccess(res, quote);
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req, res, next) {
    try {
      const customer = req.user || null;
      const order = await orderService.createOrder(req.body, customer);
      return sendSuccess(res, order, 'Order created successfully. Please complete payment.', 201);
    } catch (err) {
      next(err);
    }
  }

  async getMyOrders(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const orders = await orderService.getMyOrders(req.user.uid);
      return sendSuccess(res, orders);
    } catch (err) {
      next(err);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const order = await orderService.getOrderById(req.params.id, req.user);
      if (!order) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      }
      return sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrderController();

