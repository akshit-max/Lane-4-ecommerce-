const cartService = require('../services/cartService');
const { sendSuccess } = require('../utils/response');

class CartController {
  async getCart(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const guestId = req.query.guestId || req.headers['x-guest-id'] || null;
      const cart = await cartService.getCart(customerId, guestId);
      return sendSuccess(res, cart);
    } catch (err) {
      next(err);
    }
  }

  async addItem(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const guestId = req.body.guestId || req.headers['x-guest-id'] || null;
      const { productId, variantId, quantity } = req.body;

      const cart = await cartService.addItem(customerId, guestId, { productId, variantId, quantity });
      return sendSuccess(res, cart, 'Item added to cart.');
    } catch (err) {
      next(err);
    }
  }

  async updateItem(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const guestId = req.body.guestId || req.headers['x-guest-id'] || null;
      const { itemId } = req.params;
      const { quantity } = req.body;

      const cart = await cartService.updateItemQuantity(customerId, guestId, itemId, quantity);
      return sendSuccess(res, cart, 'Cart updated.');
    } catch (err) {
      next(err);
    }
  }

  async removeItem(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const guestId = req.query.guestId || req.headers['x-guest-id'] || null;
      const { itemId } = req.params;

      const cart = await cartService.removeItem(customerId, guestId, itemId);
      return sendSuccess(res, cart, 'Item removed from cart.');
    } catch (err) {
      next(err);
    }
  }

  async clearCart(req, res, next) {
    try {
      const customerId = req.user ? req.user.uid : null;
      const guestId = req.query.guestId || req.headers['x-guest-id'] || null;

      const cart = await cartService.clearCart(customerId, guestId);
      return sendSuccess(res, cart, 'Cart cleared.');
    } catch (err) {
      next(err);
    }
  }

  async mergeCart(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const { guestId } = req.body;
      await cartService.mergeGuestCart(req.user.uid, guestId);
      const cart = await cartService.getCart(req.user.uid, null);
      return sendSuccess(res, cart, 'Guest cart merged.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CartController();

