const { body, param } = require('express-validator');
const { ALLOWED_ORDER_STATUSES } = require('../constants');

const quoteValidator = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required to generate a checkout quote'),
  body('items.*.productId').notEmpty().withMessage('Valid productId required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer >= 1')
];

const createOrderValidator = [
  body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty'),
  body('shippingAddress').isObject().withMessage('Shipping address object is required'),
  body('shippingAddress.addressLine1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.postalCode').trim().notEmpty().withMessage('PIN / Postal code is required')
];

const updateOrderStatusValidator = [
  param('id').notEmpty().withMessage('Order ID is required'),
  body('status').isIn(ALLOWED_ORDER_STATUSES).withMessage('Invalid order status')
];

const addTrackingValidator = [
  param('id').notEmpty().withMessage('Order ID is required'),
  body('courierName').trim().notEmpty().withMessage('Courier partner name is required'),
  body('trackingNumber').trim().notEmpty().withMessage('Tracking / AWB consignment number is required')
];

module.exports = {
  quoteValidator,
  createOrderValidator,
  updateOrderStatusValidator,
  addTrackingValidator
};

