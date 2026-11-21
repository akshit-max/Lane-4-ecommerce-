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
router.get('/:id', optionalAuthenticate, orderController.getOrderById);

module.exports = router;

