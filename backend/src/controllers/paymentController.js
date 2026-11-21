const paymentService = require('../services/paymentService');
const { sendSuccess, sendError } = require('../utils/response');

class PaymentController {
  async getPaymentSettings(req, res, next) {
    try {
      const settings = await paymentService.getPublicPaymentSettings();
      return sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  }

  async submitProof(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const { orderId, upiReferenceNumber } = req.body;

      if (!req.file) {
        return sendError(res, 'SCREENSHOT_REQUIRED', 'Payment proof screenshot file is required.', null, 400);
      }

      const result = await paymentService.submitPaymentProof({
        orderId,
        upiReferenceNumber,
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        customerId
      });

      return sendSuccess(res, result, 'Payment proof submitted. Staff will verify shortly.');
    } catch (err) {
      next(err);
    }
  }

  async getOrderPaymentStatus(req, res, next) {
    try {
      const payment = await paymentService.getPaymentByOrderId(req.params.id);
      if (!payment) {
        return sendSuccess(res, { status: 'awaiting_payment' });
      }
      return sendSuccess(res, {
        paymentId: payment.paymentId,
        status: payment.status,
        upiReferenceNumber: payment.upiReferenceNumber,
        submissionAttempts: payment.submissionAttempts,
        verification: payment.verification || {}
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PaymentController();

