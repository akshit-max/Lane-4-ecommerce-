const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { optionalAuthenticate, authenticate } = require('../middleware/authenticate');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.get('/', optionalAuthenticate, cartController.getCart);

router.post(
  '/items',
  optionalAuthenticate,
  [
    body('productId').notEmpty().withMessage('Product ID is required')
  ],
  validateRequest,
  cartController.addItem
);

router.patch(
  '/items/:itemId',
  optionalAuthenticate,
  [
    body('quantity').isInt().withMessage('Quantity must be an integer')
  ],
  validateRequest,
  cartController.updateItem
);

router.delete('/items/:itemId', optionalAuthenticate, cartController.removeItem);
router.delete('/', optionalAuthenticate, cartController.clearCart);
router.post('/merge', authenticate, cartController.mergeCart);

module.exports = router;

