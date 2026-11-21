const { getDb } = require('../config/firebaseAdmin');
const productService = require('./productService');
const { formatINR } = require('../utils/currency');
const { logger } = require('../utils/logger');

class CartService {
  _getCartKey(customerId, guestId) {
    if (customerId) return `user_${customerId}`;
    if (guestId) return `guest_${guestId}`;
    throw new Error('Either customerId or guestId must be provided to access cart.');
  }

  async getCart(customerId, guestId) {
    const db = getDb();
    if (!db) return { items: [], subtotalPaise: 0, totalItemsCount: 0 };

    const cartKey = this._getCartKey(customerId, guestId);
    const cartDoc = await db.collection('carts').doc(cartKey).get();

    if (!cartDoc.exists) {
      return {
        cartId: cartKey,
        customerId: customerId || null,
        guestId: guestId || null,
        items: [],
        subtotalPaise: 0,
        subtotalFormatted: formatINR(0),
        totalItemsCount: 0
      };
    }

    const data = cartDoc.data();
    return {
      ...data,
      subtotalFormatted: formatINR(data.subtotalPaise || 0)
    };
  }

  async addItem(customerId, guestId, { productId, variantId, quantity = 1 }) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    let product = await productService.getProductById(productId);
    if (!product) {
      product = await productService.getProductBySlug(productId);
    }
    if (!product) {
      throw new Error('Product not found or is no longer available.');
    }

    // Find requested variant
    let variant = (product.variants || []).find(v => v.variantId === variantId || v.sku === variantId);
    if (!variant && product.variants && product.variants.length > 0) {
      // Default to first variant if not explicitly selected
      variant = product.variants[0];
    }

    if (variant && variant.isActive === false) {
      throw new Error('Selected product variant is inactive.');
    }

    // Check available stock
    const availableStock = variant ? variant.stockQuantity : 999;
    if (availableStock <= 0) {
      throw new Error(`Item "${product.name}" is currently out of stock.`);
    }

    const unitPricePaise = (variant && variant.pricePaise) || product.salePricePaise || product.regularPricePaise;
    const variantLabel = variant ? `${variant.size || ''} ${variant.color || ''}`.trim() : '';
    const itemSku = variant ? variant.sku : product.sku;
    const imageUrl = (product.images && product.images[0] && product.images[0].url) || '';

    const cartKey = this._getCartKey(customerId, guestId);
    const cartRef = db.collection('carts').doc(cartKey);
    const cartDoc = await cartRef.get();

    let items = [];
    if (cartDoc.exists) {
      items = cartDoc.data().items || [];
    }

    const itemId = `${productId}_${variant ? variant.variantId : 'default'}`;
    const existingIndex = items.findIndex(it => it.itemId === itemId);

    if (existingIndex > -1) {
      const newQty = items[existingIndex].quantity + qty;
      if (newQty > availableStock) {
        throw new Error(`Cannot add ${qty} more. Only ${availableStock} units available in stock.`);
      }
      items[existingIndex].quantity = newQty;
      items[existingIndex].pricePaise = unitPricePaise; // refresh price
    } else {
      if (qty > availableStock) {
        throw new Error(`Only ${availableStock} units available in stock.`);
      }
      items.push({
        itemId,
        productId: product.id,
        variantId: variant ? variant.variantId : 'default',
        sku: itemSku,
        name: product.name,
        slug: product.slug,
        size: variant ? variant.size : null,
        color: variant ? variant.color : null,
        variantLabel,
        pricePaise: unitPricePaise,
        quantity: qty,
        imageUrl,
        addedAt: new Date()
      });
    }

    const subtotalPaise = items.reduce((sum, it) => sum + (it.pricePaise * it.quantity), 0);
    const totalItemsCount = items.reduce((sum, it) => sum + it.quantity, 0);

    const updatedCart = {
      cartId: cartKey,
      customerId: customerId || null,
      guestId: guestId || null,
      items,
      subtotalPaise,
      totalItemsCount,
      updatedAt: new Date()
    };

    await cartRef.set(updatedCart);
    return {
      ...updatedCart,
      subtotalFormatted: formatINR(subtotalPaise)
    };
  }

  async updateItemQuantity(customerId, guestId, itemId, quantity) {
    const db = getDb();
    const qty = parseInt(quantity, 10);
    const cartKey = this._getCartKey(customerId, guestId);
    const cartRef = db.collection('carts').doc(cartKey);
    const cartDoc = await cartRef.get();

    if (!cartDoc.exists) {
      throw new Error('Cart not found');
    }

    let items = cartDoc.data().items || [];
    const itemIndex = items.findIndex(it => it.itemId === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }

    if (qty <= 0) {
      // Remove if quantity set to 0 or negative
      items.splice(itemIndex, 1);
    } else {
      // Validate against current stock
      const item = items[itemIndex];
      const product = await productService.getProductById(item.productId);
      if (product) {
        const variant = (product.variants || []).find(v => v.variantId === item.variantId || v.sku === item.sku);
        const availableStock = variant ? variant.stockQuantity : 999;
        if (qty > availableStock) {
          throw new Error(`Requested quantity (${qty}) exceeds available stock (${availableStock}).`);
        }
      }
      items[itemIndex].quantity = qty;
    }

    const subtotalPaise = items.reduce((sum, it) => sum + (it.pricePaise * it.quantity), 0);
    const totalItemsCount = items.reduce((sum, it) => sum + it.quantity, 0);

    const updatedCart = {
      cartId: cartKey,
      customerId: customerId || null,
      guestId: guestId || null,
      items,
      subtotalPaise,
      totalItemsCount,
      updatedAt: new Date()
    };

    await cartRef.set(updatedCart);
    return {
      ...updatedCart,
      subtotalFormatted: formatINR(subtotalPaise)
    };
  }

  async removeItem(customerId, guestId, itemId) {
    return this.updateItemQuantity(customerId, guestId, itemId, 0);
  }

  async clearCart(customerId, guestId) {
    const db = getDb();
    const cartKey = this._getCartKey(customerId, guestId);
    await db.collection('carts').doc(cartKey).set({
      cartId: cartKey,
      customerId: customerId || null,
      guestId: guestId || null,
      items: [],
      subtotalPaise: 0,
      totalItemsCount: 0,
      updatedAt: new Date()
    });
    return { items: [], subtotalPaise: 0, totalItemsCount: 0, subtotalFormatted: formatINR(0) };
  }

  async mergeGuestCart(customerId, guestId) {
    if (!guestId || !customerId) return;
    const db = getDb();

    const guestKey = `guest_${guestId}`;
    const userKey = `user_${customerId}`;

    const guestDoc = await db.collection('carts').doc(guestKey).get();
    if (!guestDoc.exists) return;

    const guestItems = guestDoc.data().items || [];
    if (guestItems.length === 0) return;

    for (const item of guestItems) {
      await this.addItem(customerId, null, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      });
    }

    // Clean up anonymous guest cart
    await db.collection('carts').doc(guestKey).delete();
  }
}

module.exports = new CartService();

