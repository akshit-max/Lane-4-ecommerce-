const { getDb } = require('../config/firebaseAdmin');
const productService = require('./productService');
const { formatINR } = require('../utils/currency');
const { logger } = require('../utils/logger');

function getEffectiveUnitPricePaise(product, variant) {
  if (!product) return 0;
  // 1. Explicit sale price on variant (only if positive and strictly less than regular price)
  if (variant && typeof variant.salePricePaise === 'number' && variant.salePricePaise > 0) {
    const regular = variant.pricePaise || product.regularPricePaise || product.pricePaise;
    if (!regular || variant.salePricePaise < regular) {
      return variant.salePricePaise;
    }
  }
  // 2. Global product sale price (only if positive and strictly less than regular price)
  if (typeof product.salePricePaise === 'number' && product.salePricePaise > 0) {
    const regular = (variant && variant.pricePaise) || product.regularPricePaise || product.pricePaise;
    if (!regular || product.salePricePaise < regular) {
      return product.salePricePaise;
    }
  }
  // 3. Variant price
  if (variant && typeof variant.pricePaise === 'number' && variant.pricePaise > 0) {
    return variant.pricePaise;
  }
  // 4. Regular product price
  if (typeof product.regularPricePaise === 'number' && product.regularPricePaise > 0) {
    return product.regularPricePaise;
  }
  return product.pricePaise || 0;
}

class CartService {
  _httpError(message, statusCode = 400, code = 'CART_ERROR') {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
  }

  _getCartKey(customerId, guestId) {
    if (customerId) return `user_${customerId}`;
    if (guestId) return `guest_${guestId}`;
    throw this._httpError('Either customerId or guestId must be provided to access cart.', 400, 'CART_IDENTITY_REQUIRED');
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
    let items = data.items || [];
    let hasChanges = false;

    // Live catalog synchronization: ensure prices match current sale / catalog price
    if (items.length > 0) {
      for (const it of items) {
        try {
          let product = await productService.getProductById(it.productId);
          if (!product) {
            product = await productService.getProductBySlug(it.productId);
          }
          if (product) {
            const variant = (product.variants || []).find(v => v.variantId === it.variantId || v.sku === it.variantId) || (product.variants && product.variants[0]);
            const liveUnitPrice = getEffectiveUnitPricePaise(product, variant);
            if (it.pricePaise !== liveUnitPrice) {
              it.pricePaise = liveUnitPrice;
              hasChanges = true;
            }
            if (it.name !== product.name) {
              it.name = product.name;
              hasChanges = true;
            }
            if (product.images && product.images[0] && product.images[0].url && it.imageUrl !== product.images[0].url) {
              it.imageUrl = product.images[0].url;
              hasChanges = true;
            }
          }
        } catch (_) {}
      }

      const recalculatedSubtotal = items.reduce((sum, it) => sum + (it.pricePaise * it.quantity), 0);
      const recalculatedCount = items.reduce((sum, it) => sum + it.quantity, 0);

      if (hasChanges || data.subtotalPaise !== recalculatedSubtotal || data.totalItemsCount !== recalculatedCount) {
        data.subtotalPaise = recalculatedSubtotal;
        data.totalItemsCount = recalculatedCount;
        data.items = items;
        data.updatedAt = new Date();
        try {
          await db.collection('carts').doc(cartKey).set(data, { merge: true });
        } catch (_) {}
      }
    }

    return {
      ...data,
      subtotalFormatted: formatINR(data.subtotalPaise || 0)
    };
  }

  async addItem(customerId, guestId, { productId, variantId, quantity = 1 }) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const rawQty = Number(quantity);
    if (!Number.isInteger(rawQty) || rawQty < 1) {
      throw this._httpError('Quantity must be an integer of at least 1.', 400, 'INVALID_QUANTITY');
    }
    const qty = rawQty;
    let product = await productService.getProductById(productId);
    if (!product) {
      product = await productService.getProductBySlug(productId);
    }
    if (!product) {
      throw this._httpError('Product not found or is no longer available.', 404, 'PRODUCT_NOT_FOUND');
    }

    // Find requested variant
    let variant = (product.variants || []).find(v => v.variantId === variantId || v.sku === variantId);
    if (!variant && product.variants && product.variants.length > 0) {
      // Default to first variant if not explicitly selected
      variant = product.variants[0];
    }

    if (variant && variant.isActive === false) {
      throw this._httpError('Selected product variant is inactive.', 400, 'INACTIVE_VARIANT');
    }

    const itemSku = variant ? variant.sku : product.sku;
    let availableStock = variant ? variant.stockQuantity : (typeof product.stockQuantity === 'number' ? product.stockQuantity : 999);
    if (itemSku) {
      try {
        const invDoc = await db.collection('inventory').doc(itemSku).get();
        if (invDoc.exists && typeof invDoc.data().availableQuantity === 'number') {
          availableStock = invDoc.data().availableQuantity;
        }
      } catch (_) {}
    }

    if (availableStock <= 0) {
      throw this._httpError(`Item "${product.name}" is out of stock (0 left in stock).`, 409, 'INSUFFICIENT_STOCK');
    }

    const unitPricePaise = getEffectiveUnitPricePaise(product, variant);
    const variantLabel = variant ? `${variant.size || ''} ${variant.color || ''}`.trim() : '';
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
        throw this._httpError(`Only ${availableStock} left in stock.`, 409, 'INSUFFICIENT_STOCK');
      }
      items[existingIndex].quantity = newQty;
      items[existingIndex].pricePaise = unitPricePaise; // refresh price
    } else {
      if (qty > availableStock) {
        throw this._httpError(`Only ${availableStock} left in stock.`, 409, 'INSUFFICIENT_STOCK');
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
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw this._httpError('Quantity must be an integer of at least 1.', 400, 'INVALID_QUANTITY');
    }
    const cartKey = this._getCartKey(customerId, guestId);
    const cartRef = db.collection('carts').doc(cartKey);
    const cartDoc = await cartRef.get();

    if (!cartDoc.exists) {
      throw this._httpError('Cart not found', 404, 'CART_NOT_FOUND');
    }

    let items = cartDoc.data().items || [];
    const itemIndex = items.findIndex(it => it.itemId === itemId);
    if (itemIndex === -1) {
      throw this._httpError('Item not found in cart', 404, 'CART_ITEM_NOT_FOUND');
    }

    // Validate against current stock (inventory as single source of truth)
    const item = items[itemIndex];
    const product = await productService.getProductById(item.productId);
    if (product) {
      const variant = (product.variants || []).find(v => v.variantId === item.variantId || v.sku === item.sku);
      const skuToCheck = item.sku || (variant && variant.sku) || product.sku;
      let availableStock = variant ? variant.stockQuantity : (typeof product.stockQuantity === 'number' ? product.stockQuantity : 999);
      if (skuToCheck) {
        try {
          const invDoc = await db.collection('inventory').doc(skuToCheck).get();
          if (invDoc.exists && typeof invDoc.data().availableQuantity === 'number') {
            availableStock = invDoc.data().availableQuantity;
          }
        } catch (_) {}
      }
      if (qty > availableStock) {
        throw this._httpError(`Only ${availableStock} left in stock.`, 409, 'INSUFFICIENT_STOCK');
      }
      item.pricePaise = getEffectiveUnitPricePaise(product, variant);
    }
    items[itemIndex].quantity = qty;

    return this._persistCartItems(cartRef, cartKey, customerId, guestId, items);
  }

  async _persistCartItems(cartRef, cartKey, customerId, guestId, items) {
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
    const db = getDb();
    const cartKey = this._getCartKey(customerId, guestId);
    const cartRef = db.collection('carts').doc(cartKey);
    const cartDoc = await cartRef.get();

    if (!cartDoc.exists) {
      throw this._httpError('Cart not found', 404, 'CART_NOT_FOUND');
    }

    const items = cartDoc.data().items || [];
    const itemIndex = items.findIndex(it => it.itemId === itemId);
    if (itemIndex === -1) {
      throw this._httpError('Item not found in cart', 404, 'CART_ITEM_NOT_FOUND');
    }

    items.splice(itemIndex, 1);
    return this._persistCartItems(cartRef, cartKey, customerId, guestId, items);
  }

  async clearCart(customerId, guestId) {
    const db = getDb();
    const tasks = [];

    if (customerId) {
      const userKey = `user_${customerId}`;
      tasks.push(
        db.collection('carts').doc(userKey).set({
          cartId: userKey,
          customerId,
          guestId: guestId || null,
          items: [],
          subtotalPaise: 0,
          totalItemsCount: 0,
          updatedAt: new Date()
        })
      );
    }

    if (guestId) {
      const guestKey = `guest_${guestId}`;
      tasks.push(
        db.collection('carts').doc(guestKey).set({
          cartId: guestKey,
          customerId: customerId || null,
          guestId,
          items: [],
          subtotalPaise: 0,
          totalItemsCount: 0,
          updatedAt: new Date()
        })
      );
    }

    if (tasks.length === 0) {
      throw new Error('Either customerId or guestId must be provided to access cart.');
    }

    await Promise.all(tasks);
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

