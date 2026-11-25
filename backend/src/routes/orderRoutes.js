const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { optionalAuthenticate, authenticate } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validateRequest');
const { createOrderValidator } = require('../validators');

router.post('/quote', optionalAuthenticate, orderController.calculateQuote);

router.post(
  '/',
  optionalAuthenticate,
  createOrderValidator,
  validateRequest,
  orderController.createOrder
);

router.get('/my-orders', authenticate, orderController.getMyOrders);
router.post('/track', orderController.trackOrder);
router.post('/:id/cancel', optionalAuthenticate, orderController.cancelMyOrder);
router.get('/:id/invoice', optionalAuthenticate, orderController.getOrderInvoice);
router.get('/:id', authenticate, orderController.getOrderById);

module.exports = router;

