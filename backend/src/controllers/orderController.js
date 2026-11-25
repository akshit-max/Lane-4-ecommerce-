const orderService = require('../services/orderService');
const gstInvoiceService = require('../services/gstInvoiceService');
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
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return sendSuccess(res, []);
      }
      const orders = await orderService.getMyOrders(req.user.uid, req.user.email);
      return sendSuccess(res, orders);
    } catch (err) {
      next(err);
    }
  }

  async trackOrder(req, res, next) {
    try {
      const { orderNumber, email } = req.body;
      const tracking = await orderService.trackOrder(orderNumber, email);
      return sendSuccess(res, tracking, 'Order tracking details retrieved.');
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRACKING_NOT_FOUND',
          message: err.message || 'No order found matching the provided reference number and email.'
        }
      });
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
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'UNAUTHORIZED',
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  async cancelMyOrder(req, res, next) {
    try {
      const orderId = req.params.id;
      const customer = req.user || null;
      const { reason } = req.body || {};
      const orderAccessToken = (req.body && req.body.orderAccessToken) || req.headers['x-order-token'] || '';

      const cancelled = await orderService.cancelCustomerOrder(orderId, customer, {
        reason,
        orderAccessToken
      });
      return sendSuccess(res, cancelled, 'Order cancelled successfully.');
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'CANCEL_ORDER_ERROR',
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  async getOrderInvoice(req, res, next) {
    try {
      const orderId = req.params.id;
      const callerUser = req.user || null;
      const orderAccessToken = (req.query && req.query.token) || (req.headers && req.headers['x-order-token']) || '';
      const invoice = await gstInvoiceService.getOrCreateInvoice(orderId, callerUser, orderAccessToken);
      return sendSuccess(res, invoice, 'GST tax invoice retrieved successfully.');
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'INVOICE_ERROR',
            message: err.message
          }
        });
      }
      next(err);
    }
  }
}

module.exports = new OrderController();

