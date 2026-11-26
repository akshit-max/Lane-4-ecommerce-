const { getDb } = require('../config/firebaseAdmin');
const productService = require('./productService');
const couponService = require('./couponService');
const shippingService = require('./shippingService');
const cartService = require('./cartService');
const { formatINR } = require('../utils/currency');
const { sendMail, wrapBrandedTemplate } = require('../config/email');
const { staffNotificationService } = require('./staffNotificationService');
const { logger } = require('../utils/logger');
const { generateOrderAccessToken } = require('../utils/orderSecurity');

function toMillis(d) {
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (d._seconds !== undefined) return d._seconds * 1000 + Math.floor((d._nanoseconds || 0) / 1e6);
  if (d.seconds !== undefined) return d.seconds * 1000;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

const ORDER_STATUS_TRANSITIONS = {
  pending_payment: ['payment_verification', 'confirmed', 'cancelled'],
  payment_verification: ['confirmed', 'payment_rejected', 'pending_payment', 'cancelled'],
  payment_rejected: ['payment_verification', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'out_for_delivery', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'returned'],
  out_for_delivery: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: ['refunded'],
  cancelled: [],
  refunded: []
};

function getEffectiveUnitPricePaise(product, variant) {
  if (!product) return 0;
  // 1. Variant sale price: valid only if positive and strictly less than regular price
  if (variant && typeof variant.salePricePaise === 'number' && variant.salePricePaise > 0) {
    const regular = variant.pricePaise || product.regularPricePaise || product.pricePaise;
    if (!regular || variant.salePricePaise < regular) {
      return variant.salePricePaise;
    }
  }
  // 2. Global product sale price: valid only if positive and strictly less than regular price
  if (typeof product.salePricePaise === 'number' && product.salePricePaise > 0) {
    const regular = (variant && variant.pricePaise) || product.regularPricePaise || product.pricePaise;
    if (!regular || product.salePricePaise < regular) {
      return product.salePricePaise;
    }
  }
  // 3. Variant regular price
  if (variant && typeof variant.pricePaise === 'number' && variant.pricePaise > 0) {
    return variant.pricePaise;
  }
  // 4. Regular product price
  if (typeof product.regularPricePaise === 'number' && product.regularPricePaise > 0) {
    return product.regularPricePaise;
  }
  return product.pricePaise || 0;
}

function normalizeIndianPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

class OrderService {
  _generateOrderNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    this._memSeq = (this._memSeq || 1000) + 1;
    return `L4-${year}-${this._memSeq}`;
  }

  async _generateSequentialOrderNumber(db) {
    const year = new Date().getFullYear().toString().slice(-2);
    if (!db) {
      return this._generateOrderNumber();
    }
    try {
      const counterRef = db.collection('counters').doc('orders');
      let orderNum;
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);
        let seq = 1001;
        if (doc && doc.exists && typeof doc.data().currentSequence === 'number') {
          seq = doc.data().currentSequence + 1;
        }
        transaction.set(counterRef, { currentSequence: seq, updatedAt: new Date() }, { merge: true });
        orderNum = `L4-${year}-${seq}`;
      });
      return orderNum;
    } catch (e) {
      try {
        const snap = await db.collection('orders').get();
        const count = snap && snap.docs ? snap.docs.length : 0;
        return `L4-${year}-${1001 + count}`;
      } catch (_) {
        return this._generateOrderNumber();
      }
    }
  }

  async calculateQuote({ items, couponCode = null, guestId = null, customerId = null }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided for calculation.');
    }

    let subtotalPaise = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await productService.getProductById(item.productId);
      if (!product) {
        throw new Error(`Product "${item.productId}" no longer exists.`);
      }

      let variant = (product.variants || []).find(v => v.variantId === item.variantId || v.sku === item.variantId);
      if (!variant && product.variants && product.variants.length > 0) {
        variant = product.variants[0];
      }

      const unitPricePaise = getEffectiveUnitPricePaise(product, variant);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const lineTotalPaise = unitPricePaise * qty;

      subtotalPaise += lineTotalPaise;
      validatedItems.push({
        productId: product.id,
        variantId: variant ? variant.variantId : 'default',
        sku: variant ? variant.sku : product.sku,
        name: product.name,
        slug: product.slug,
        size: variant ? variant.size : null,
        color: variant ? variant.color : null,
        quantity: qty,
        unitPricePaise,
        unitPriceFormatted: formatINR(unitPricePaise),
        totalPricePaise: lineTotalPaise,
        totalPriceFormatted: formatINR(lineTotalPaise),
        imageUrl: (product.images && product.images[0] && product.images[0].url) || ''
      });
    }

    // Apply coupon if provided
    let couponDiscountPaise = 0;
    let couponDetails = null;

    if (couponCode) {
      try {
        couponDetails = await couponService.validateCoupon({
          code: couponCode,
          subtotalPaise,
          customerId
        });
        couponDiscountPaise = couponDetails.discountPaise;
      } catch (err) {
        // Return error message for coupon without failing entire quote
        couponDetails = { isValid: false, error: err.message };
      }
    }

    // Calculate shipping
    const shipping = await shippingService.calculateShipping(subtotalPaise);
    const shippingChargesPaise = shipping.shippingChargesPaise;

    // Taxes: All consumer prices in India are GST-inclusive
    const taxChargesPaise = 0;

    const finalPayablePaise = Math.max(0, subtotalPaise - couponDiscountPaise + shippingChargesPaise + taxChargesPaise);

    return {
      items: validatedItems,
      pricing: {
        subtotalPaise,
        subtotalFormatted: formatINR(subtotalPaise),
        couponCode: couponDetails && couponDetails.isValid ? couponDetails.code : null,
        couponDiscountPaise,
        couponDiscountFormatted: formatINR(couponDiscountPaise),
        shippingChargesPaise,
        shippingPaise: shippingChargesPaise,
        shippingFormatted: shipping.shippingFormatted,
        isFreeShipping: shipping.isFreeShipping,
        taxChargesPaise,
        taxFormatted: formatINR(taxChargesPaise),
        finalPayablePaise,
        finalPayableFormatted: formatINR(finalPayablePaise),
        currency: 'INR'
      },
      coupon: couponDetails
    };
  }

  async createOrder(data, customer = null) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const isCustomerUser = customer && (customer.role === 'customer' || !customer.role);
    let customerId = isCustomerUser ? customer.uid : null;
    const customerEmail = data.customerEmail || (isCustomerUser ? customer.email : null);
    const rawCustomerPhone = data.customerPhone || (data.shippingAddress && data.shippingAddress.phone) || '';
    const rawShipPhone = (data.shippingAddress && data.shippingAddress.phone) || rawCustomerPhone;
    const customerPhone = rawCustomerPhone ? normalizeIndianPhone(rawCustomerPhone) : '';
    const shipPhone = rawShipPhone ? normalizeIndianPhone(rawShipPhone) : '';

    if (rawCustomerPhone && (!/^[6-9]\d{9}$/.test(customerPhone) || /[a-zA-Z]/.test(String(rawCustomerPhone)))) {
      const err = new Error('Please enter a valid 10-digit Indian mobile number.');
      err.statusCode = 400;
      throw err;
    }
    if (rawShipPhone && (!/^[6-9]\d{9}$/.test(shipPhone) || /[a-zA-Z]/.test(String(rawShipPhone)))) {
      const err = new Error('Please enter a valid 10-digit Indian mobile number.');
      err.statusCode = 400;
      throw err;
    }

    if (!customerEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(customerEmail)) {
      throw new Error('Please provide a valid standard email address.');
    }
    const cleanPin = (data.shippingAddress && data.shippingAddress.postalCode ? data.shippingAddress.postalCode.toString().trim() : '');
    if (!/^[1-9][0-9]{5}$/.test(cleanPin) || /^(.)\1{5}$/.test(cleanPin) || cleanPin === '123456') {
      throw new Error('Please provide a correct postal code.');
    }
    if (!data.shippingAddress || !data.shippingAddress.addressLine1) {
      throw new Error('Complete shipping address is required.');
    }

    // Auto-link customerId if an account already exists with this email
    if (!customerId && customerEmail) {
      try {
        const existingUserSnap = await db.collection('users')
          .where('email', '==', customerEmail.toLowerCase().trim())
          .limit(1)
          .get();
        if (!existingUserSnap.empty) {
          customerId = existingUserSnap.docs[0].id;
        }
      } catch (_) {}
    }

    // Server-side recalculation & validation
    const quote = await this.calculateQuote({
      items: data.items,
      couponCode: data.couponCode,
      customerId,
      guestId: data.guestId
    });

    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;
    const orderNumber = await this._generateSequentialOrderNumber(db);
    const now = new Date();

    const couponData = (quote.pricing && quote.pricing.couponCode) ? {
      code: quote.pricing.couponCode,
      discountPaise: quote.pricing.couponDiscountPaise,
      discountFormatted: quote.pricing.couponDiscountFormatted
    } : null;

    // Transaction to reserve inventory and persist immutable order snapshot
    // CRITICAL: Firestore transactions strictly require ALL reads before ANY writes
    const reservedInventoryItems = [];
    await db.runTransaction(async (transaction) => {
      // 1. Read and validate all inventory records first
      const inventoryUpdates = [];
      for (const item of quote.items) {
        const invRef = db.collection('inventory').doc(item.sku);
        const invDoc = await transaction.get(invRef);

        if (invDoc.exists) {
          const invData = invDoc.data();
          const currentAvailable = invData.availableQuantity || 0;
          if (currentAvailable < item.quantity) {
            throw new Error(`Insufficient stock for "${item.name} (${item.sku})". Only ${currentAvailable} left.`);
          }

          const newAvailable = currentAvailable - item.quantity;
          const newReserved = (invData.reservedQuantity || 0) + item.quantity;

          reservedInventoryItems.push({
            sku: item.sku,
            name: item.name || item.title || 'Product',
            remainingAvailable: newAvailable,
            reservedQuantity: newReserved
          });

          inventoryUpdates.push({
            ref: invRef,
            update: {
              availableQuantity: newAvailable,
              reservedQuantity: newReserved,
              isOutOfStock: newAvailable <= 0,
              updatedAt: now
            }
          });
        }
      }

      // 2. Execute all inventory writes after reads are complete
      for (const { ref, update } of inventoryUpdates) {
        transaction.update(ref, update);
      }

      // 3. Write Order Record
      const orderDocument = {
        orderId,
        orderNumber,
        customerId,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerPhone: customerPhone.trim(),
        guestId: data.guestId || null,
        status: 'pending_payment',
        orderStatus: 'pending_payment',
        paymentStatus: 'awaiting_payment',
        items: quote.items,
        pricing: quote.pricing,
        coupon: couponData,
        shippingAddress: {
          addressee: data.shippingAddress.addressee || customerEmail,
          phone: shipPhone || customerPhone,
          addressLine1: data.shippingAddress.addressLine1,
          addressLine2: data.shippingAddress.addressLine2 || '',
          city: data.shippingAddress.city || 'Nagpur',
          state: data.shippingAddress.state || 'Maharashtra',
          postalCode: data.shippingAddress.postalCode,
          country: 'India'
        },
        billingAddress: data.billingAddress || data.shippingAddress,
        fulfillment: {},
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now
      };

      transaction.set(orderRef, orderDocument);
    });

    // Record coupon redemption if applicable
    if (quote.pricing.couponCode) {
      await couponService.recordCouponRedemption(quote.pricing.couponCode, customerId);
    }

    // Clear cart
    try {
      await cartService.clearCart(customerId, data.guestId);
    } catch (e) {
      // Non-blocking
    }

    // Send order confirmation email with payment instructions
    sendMail({
      to: customerEmail,
      subject: `Order #${orderNumber} Placed — Next: Complete UPI Payment`,
      templateName: 'order_created',
      html: wrapBrandedTemplate(
        `Order #${orderNumber} Placed!`,
        `
          <p>Hi ${data.shippingAddress.addressee || 'Swimmer'},</p>
          <p>Thank you for choosing The Lane4 Performance Store! We have received your order.</p>
          <p><strong>Order Number:</strong> #${orderNumber}</p>
          <p><strong>Final Payable Amount:</strong> ${quote.pricing.finalPayableFormatted}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <h3 style="font-size: 16px; margin-bottom: 8px;">To Complete Your Order:</h3>
          <ol style="padding-left: 20px; line-height: 1.8;">
            <li>Scan our store UPI QR code on the checkout screen or pay to UPI ID: <strong>lane4swim@upi</strong></li>
            <li>Transfer the exact amount: <strong>${quote.pricing.finalPayableFormatted}</strong></li>
            <li>Upload your payment screenshot and enter your 12-digit UTR reference.</li>
          </ol>
          <p>Once submitted, our team in Nagpur will verify the credit and confirm dispatch.</p>
        `
      )
    });

    // Notify staff of new order (non-blocking async)
    staffNotificationService.notifyNewOrderPlaced({
      orderId,
      orderNumber,
      customerEmail,
      customerPhone,
      shippingAddress: data.shippingAddress,
      pricing: quote.pricing,
      items: quote.items,
      paymentMethod: data.paymentMethod || 'UPI_QR'
    });

    // Check for any inventory items that reached low-stock threshold during reservation
    for (const resv of reservedInventoryItems) {
      if (typeof resv.remainingAvailable === 'number') {
        staffNotificationService.notifyLowStockAlert({
          sku: resv.sku,
          productName: resv.name,
          availableQuantity: resv.remainingAvailable,
          reservedQuantity: resv.reservedQuantity,
          lowStockThreshold: 5
        });
      }
    }

    return {
      orderId,
      orderNumber,
      status: 'pending_payment',
      orderStatus: 'pending_payment',
      paymentStatus: 'awaiting_payment',
      customerEmail: customerEmail.toLowerCase().trim(),
      customerPhone: customerPhone || '',
      shippingAddress: { ...data.shippingAddress },
      pricing: quote.pricing,
      items: quote.items,
      coupon: couponData,
      orderAccessToken: generateOrderAccessToken(orderId, customerEmail)
    };
  }

  async getOrderById(orderId, user = null) {
    const db = getDb();
    if (!db) return null;

    let doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) {
      const cleanNum = orderId.toString().trim().replace(/^#/, '');
      const snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
      if (!snap.empty) {
        doc = snap.docs[0];
      } else {
        return null;
      }
    }

    const order = doc.data();
    if (order) {
      order.id = doc.id;
      order.orderId = order.orderId || doc.id;
      order.orderStatus = order.orderStatus || order.status;
      order.tracking = order.tracking || order.fulfillment || null;
    }

    // Security check: Order details require authentication and ownership verification
    if (!user) {
      const err = new Error('Authentication required to access order details.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const { ADMIN_ROLES } = require('../constants/roles');
    const isAdmin = user.role && ADMIN_ROLES.includes(user.role);

    if (!isAdmin) {
      const userEmail = (user.email || '').toLowerCase().trim();
      const ordEmail = (order.customerEmail || '').toLowerCase().trim();
      const matchUid = order.customerId && order.customerId === user.uid;
      const matchEmail = userEmail && ordEmail && userEmail === ordEmail;
      if (!matchUid && !matchEmail) {
        const err = new Error('UNAUTHORIZED: Access to requested order is denied.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    return order;
  }

  async getMyOrders(customerId, customerEmail = null) {
    const db = getDb();
    if (!db || (!customerId && !customerEmail)) return [];

    const orderMap = new Map();
    const cleanEmail = customerEmail ? customerEmail.toLowerCase().trim() : null;

    // 1. Fetch orders tied to registered customerId
    if (customerId) {
      const snap = await db.collection('orders')
        .where('customerId', '==', customerId)
        .get();
      snap.docs.forEach(d => {
        const data = d.data();
        const ordEmail = data.customerEmail ? data.customerEmail.toLowerCase().trim() : '';
        // Strict customer privacy isolation: only include orders matching this customer's email
        if (!cleanEmail || !ordEmail || ordEmail === cleanEmail) {
          orderMap.set(data.orderNumber || d.id, {
            ...data,
            id: d.id,
            orderId: data.orderId || d.id
          });
        }
      });
    }

    // 2. Also fetch and auto-link any guest orders placed before signup with this email
    if (cleanEmail) {
      const snap = await db.collection('orders')
        .where('customerEmail', '==', cleanEmail)
        .get();
      snap.docs.forEach(d => {
        const data = d.data();
        const key = data.orderNumber || d.id;
        if (!orderMap.has(key)) {
          if (customerId && !data.customerId) {
            d.ref.update({ customerId, updatedAt: new Date() }).catch(() => {});
          }
          orderMap.set(key, {
            ...data,
            id: d.id,
            orderId: data.orderId || d.id,
            customerId: customerId || data.customerId
          });
        }
      });
    }

    const orders = Array.from(orderMap.values());
    orders.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return orders;
  }

  async listAllOrders(filters = {}) {
    const db = getDb();
    if (!db) return [];

    let query = db.collection('orders');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.paymentStatus) {
      query = query.where('paymentStatus', '==', filters.paymentStatus);
    }

    const snap = await query.get();
    let orders = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        orderId: data.orderId || d.id
      };
    });

    // Ensure newest orders are ALWAYS at index 0 (top of table)
    orders.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return orders;
  }

  async trackOrder(orderNumber, email) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    if (!orderNumber || !email) {
      throw new Error('Both order number and customer email address are required to track an order.');
    }

    const cleanNum = orderNumber.toString().trim().replace(/^#/, '').toUpperCase();
    const cleanEmail = email.toString().trim().toLowerCase();

    // 1. Locate order by orderNumber or document ID
    let snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
    let orderDoc = !snap.empty ? snap.docs[0] : null;

    if (!orderDoc) {
      // Check document ID
      const directDoc = await db.collection('orders').doc(cleanNum).get();
      if (directDoc.exists) {
        orderDoc = directDoc;
      }
    }

    if (!orderDoc) {
      const err = new Error('No order found matching those details. Please verify your order number and email.');
      err.statusCode = 404;
      throw err;
    }

    const order = orderDoc.data();
    const recordEmail = (order.customerEmail || '').toLowerCase().trim();

    if (recordEmail !== cleanEmail) {
      const err = new Error('No order found matching those details. Please verify your order number and email.');
      err.statusCode = 404;
      throw err;
    }

    return {
      orderId: orderDoc.id,
      orderNumber: order.orderNumber || orderDoc.id,
      status: order.status || order.orderStatus || 'pending_payment',
      paymentStatus: order.paymentStatus || 'awaiting_payment',
      items: (order.items || []).map(it => ({
        name: it.name,
        quantity: it.quantity,
        size: it.size || null,
        variantLabel: it.variantLabel || null,
        unitPriceFormatted: it.unitPriceFormatted || '',
        totalPriceFormatted: it.totalPriceFormatted || ''
      })),
      pricing: {
        finalPayableFormatted: order.pricing ? order.pricing.finalPayableFormatted : '',
        subtotalFormatted: order.pricing ? order.pricing.subtotalFormatted : '',
        shippingFormatted: order.pricing ? order.pricing.shippingFormatted : 'FREE'
      },
      shippingAddress: {
        addressee: order.shippingAddress ? order.shippingAddress.addressee : 'Customer',
        city: order.shippingAddress ? order.shippingAddress.city : '',
        state: order.shippingAddress ? order.shippingAddress.state : '',
        postalCode: order.shippingAddress ? order.shippingAddress.postalCode : ''
      },
      fulfillment: order.fulfillment || order.tracking || {},
      tracking: order.tracking || order.fulfillment || null,
      orderAccessToken: generateOrderAccessToken(orderDoc.id, recordEmail),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  async updateOrderStatus(orderId, newStatus, adminUser) {
    const db = getDb();
    let orderRef = db.collection('orders').doc(orderId);
    let orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      const cleanNum = orderId.toString().trim().replace(/^#/, '');
      const snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderRef = orderDoc.ref;
      } else {
        throw new Error('Order not found');
      }
    }

    const orderData = orderDoc.data();
    const now = new Date();

    const currentStatus = orderData.status || 'pending_payment';
    if (currentStatus === newStatus) {
      return {
        orderId,
        status: newStatus,
        orderStatus: newStatus,
        updatedAt: orderData.updatedAt || now
      };
    }

    const validNextStatuses = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
    if (!validNextStatuses.includes(newStatus)) {
      const err = new Error(`Invalid order status transition from "${currentStatus}" to "${newStatus}". Allowed next statuses: ${validNextStatuses.length ? validNextStatuses.join(', ') : 'None (terminal state)'}.`);
      err.statusCode = 400;
      throw err;
    }

    const orderUpdates = {
      status: newStatus,
      orderStatus: newStatus,
      updatedAt: now
    };

    if (['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(newStatus)) {
      if (orderData.paymentStatus !== 'verified') {
        orderUpdates.paymentStatus = 'verified';
      }
      try {
        const pSnap = await db.collection('payments').where('orderId', '==', orderDoc.id).get();
        for (const pDoc of pSnap.docs) {
          if (pDoc.data().status !== 'verified') {
            await pDoc.ref.update({
              status: 'verified',
              verifiedAt: now,
              verifiedBy: adminUser.email || adminUser.uid,
              internalNote: 'Automatically verified upon order confirmation by admin staff',
              updatedAt: now
            });
          }
        }
      } catch (_) {}
    } else if (newStatus === 'payment_rejected') {
      orderUpdates.paymentStatus = 'rejected';
      try {
        const pSnap = await db.collection('payments').where('orderId', '==', orderDoc.id).get();
        for (const pDoc of pSnap.docs) {
          if (pDoc.data().status !== 'rejected') {
            await pDoc.ref.update({
              status: 'rejected',
              rejectionReason: 'Order marked as payment rejected by admin staff',
              rejectedAt: now,
              rejectedBy: adminUser.email || adminUser.uid,
              updatedAt: now
            });
          }
        }
      } catch (_) {}
    }

    // If order is returned, track financial & refund state
    if (newStatus === 'returned' && currentStatus !== 'returned') {
      orderUpdates.returnedAt = now;
      orderUpdates.returnedBy = adminUser.email || adminUser.uid;
      if (orderData.paymentStatus === 'verified' && orderData.refundStatus !== 'refunded') {
        orderUpdates.refundStatus = 'pending_refund';
        orderUpdates.financialStatus = 'returned_refund_pending';
        orderUpdates.refundDetails = {
          refundId: 'ref_ret_' + Date.now(),
          originalAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
          refundAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
          status: 'pending_refund',
          initiatedAt: now,
          initiatedBy: adminUser.email || adminUser.uid,
          reason: 'Order marked returned by administrator - refund pending'
        };
      }
    }

    // If order is cancelled, restore stock across inventory and product catalogs
    if (newStatus === 'cancelled' && currentStatus !== 'cancelled') {
      orderUpdates.cancelledAt = now;
      orderUpdates.cancelledBy = adminUser.email || adminUser.uid;

      // Track financial & refund state if already paid
      if (orderData.paymentStatus === 'verified') {
        orderUpdates.refundStatus = 'pending_refund';
        orderUpdates.financialStatus = 'cancelled_refund_pending';
        orderUpdates.refundDetails = {
          refundId: 'ref_' + Date.now(),
          originalAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
          refundAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
          status: 'pending_refund',
          initiatedAt: now,
          initiatedBy: adminUser.email || adminUser.uid,
          reason: 'Order cancelled by administrator'
        };
      }

      // Revert coupon redemption usage count
      const couponCode = (orderData.coupon && orderData.coupon.code) || (orderData.pricing && orderData.pricing.couponCode);
      if (couponCode) {
        try {
          await couponService.revertCouponRedemption(couponCode);
        } catch (_) {}
      }

      for (const item of orderData.items || []) {
        try {
          // 1. Restore inventory collection
          const invRef = db.collection('inventory').doc(item.sku);
          const invDoc = await invRef.get();
          if (invDoc.exists) {
            const inv = invDoc.data();
            await invRef.update({
              availableQuantity: (inv.availableQuantity || 0) + item.quantity,
              reservedQuantity: Math.max(0, (inv.reservedQuantity || 0) - item.quantity),
              isOutOfStock: false,
              updatedAt: now
            });
          }

          // 2. Restore products collection variants & total stock if physical stock was deducted
          if (orderData.stockDeducted) {
            let pSnap = await db.collection('products').where('slug', '==', item.slug || item.productId).limit(1).get();
            if (pSnap.empty && item.productId) {
              const pDocDirect = await db.collection('products').doc(item.productId).get();
              if (pDocDirect.exists) pSnap = { empty: false, docs: [pDocDirect] };
            }
            if (!pSnap.empty) {
              const pDoc = pSnap.docs[0];
              const pData = pDoc.data();
              const variants = (pData.variants || []).map(v => {
                if (v.sku === item.sku || v.variantId === item.variantId) {
                  return { ...v, stockQuantity: (v.stockQuantity || 0) + item.quantity };
                }
                return v;
              });
              const totalStock = variants.length > 0
                ? variants.reduce((s, v) => s + (v.stockQuantity || 0), 0)
                : (pData.stockQuantity || 0) + item.quantity;
              await pDoc.ref.update({
                variants,
                stockQuantity: totalStock,
                updatedAt: now
              });
            }
          }
        } catch (_) {}
      }
    }

    // If order is returned, restore stock and update inspection status (restores stock exactly once)
    if (newStatus === 'returned' && currentStatus !== 'returned' && !orderData.returnStockRestored && !orderData.stockRestored) {
      orderUpdates.returnedAt = now;
      orderUpdates.returnedBy = adminUser.email || adminUser.uid;
      if (!orderUpdates.financialStatus) {
        orderUpdates.financialStatus = 'returned_inspection_pending';
      }
      orderUpdates.returnStockRestored = true;
      orderUpdates.returnStockRestoredAt = now;

      for (const item of orderData.items || []) {
        try {
          const invRef = db.collection('inventory').doc(item.sku);
          const invDoc = await invRef.get();
          if (invDoc.exists) {
            const inv = invDoc.data();
            const currentAvailable = typeof inv.availableQuantity === 'number' ? inv.availableQuantity : 0;
            const newAvailable = currentAvailable + item.quantity;
            await invRef.update({
              availableQuantity: newAvailable,
              isOutOfStock: newAvailable <= 0,
              updatedAt: now
            });

            await invRef.collection('ledger').add({
              type: 'return_restock',
              quantityChanged: item.quantity,
              previousQuantity: currentAvailable,
              newBalance: newAvailable,
              reservedQuantity: inv.reservedQuantity || 0,
              orderId: orderId,
              orderNumber: orderData.orderNumber || '',
              reason: 'Order status changed to returned',
              adjustedByUid: adminUser.email || adminUser.uid,
              timestamp: now
            });
          }

          let pSnap = await db.collection('products').where('slug', '==', item.slug || item.productId).limit(1).get();
          if (pSnap.empty && item.productId) {
            const pDocDirect = await db.collection('products').doc(item.productId).get();
            if (pDocDirect.exists) pSnap = { empty: false, docs: [pDocDirect] };
          }
          if (!pSnap.empty) {
            const pDoc = pSnap.docs[0];
            const pData = pDoc.data();
            const variants = (pData.variants || []).map(v => {
              if (v.sku === item.sku || v.variantId === item.variantId) {
                return { ...v, stockQuantity: (v.stockQuantity || 0) + item.quantity };
              }
              return v;
            });
            const totalStock = variants.length > 0
              ? variants.reduce((s, v) => s + (v.stockQuantity || 0), 0)
              : (pData.stockQuantity || 0) + item.quantity;
            await pDoc.ref.update({
              variants,
              stockQuantity: totalStock,
              updatedAt: now
            });
          }
        } catch (_) {}
      }
    }

    // Ensure returned orders always appear in the Returns & Refunds queue
    if (newStatus === 'returned' && currentStatus !== 'returned') {
      try {
        const existingRet = await db.collection('returns').where('orderId', '==', orderId).limit(1).get();
        if (existingRet.empty) {
          const retRef = db.collection('returns').doc();
          const returnId = `L4-RET-${Math.floor(1000 + Math.random() * 9000)}`;
          await retRef.set({
            returnId,
            docId: retRef.id,
            orderId,
            orderNumber: orderData.orderNumber || orderId,
            customerId: orderData.customerId || null,
            customerEmail: orderData.customerEmail || '',
            items: orderData.items || [],
            reason: 'Order marked returned by Admin',
            customerUpiId: '',
            status: 'received',
            createdAt: now,
            updatedAt: now
          });
          orderUpdates.returnRequested = true;
          orderUpdates.returnId = returnId;
          orderUpdates.returnStatus = 'received';
        }
      } catch (_) {}
    }

    await orderRef.update(orderUpdates);

    // Audit log
    await db.collection('adminActivityLogs').add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: 'order_status_updated',
      resourceType: 'orders',
      resourceId: orderId,
      details: { previousStatus: orderData.status, newStatus },
      timestamp: now
    });

    // Dispatch status update email to customer
    if (['processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(newStatus)) {
      sendMail({
        to: orderData.customerEmail,
        subject: `Order #${orderData.orderNumber || orderId} Update: ${newStatus.replace(/_/g, ' ').toUpperCase()}`,
        templateName: 'order_status_update',
        html: wrapBrandedTemplate(
          `Order Status: ${newStatus.replace(/_/g, ' ').toUpperCase()}`,
          `
            <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Swimmer'},</p>
            <p>Your order <strong>#${orderData.orderNumber || orderId}</strong> has been updated to: <strong>${newStatus.replace(/_/g, ' ').toUpperCase()}</strong>.</p>
            ${orderData.fulfillment && orderData.fulfillment.trackingNumber ? `
              <p><strong>Courier:</strong> ${orderData.fulfillment.courierName || 'Standard Speed Post'}</p>
              <p><strong>Tracking Number:</strong> ${orderData.fulfillment.trackingNumber}</p>
            ` : ''}
          `
        )
      });
    }

    return {
      orderId,
      status: newStatus,
      orderStatus: newStatus,
      updatedAt: now,
      ...orderUpdates
    };
  }

  async addTrackingInfo(orderId, { courierName, trackingNumber, trackingUrl }, adminUser) {
    const db = getDb();
    let orderRef = db.collection('orders').doc(orderId);
    let orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      const cleanNum = orderId.toString().trim().replace(/^#/, '');
      const snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderRef = orderDoc.ref;
      } else {
        throw new Error('Order not found');
      }
    }

    const orderData = orderDoc.data();
    if (['pending_payment', 'payment_verification', 'cancelled', 'refunded', 'payment_rejected'].includes(orderData.status)) {
      const err = new Error(`Cannot dispatch order #${orderData.orderNumber || orderId} because payment has not been verified or order is cancelled (current status: "${orderData.status}").`);
      err.statusCode = 400;
      throw err;
    }

    const cleanTracking = (trackingNumber || '').trim();
    if (!cleanTracking || cleanTracking.length < 6 || cleanTracking.length > 35 || !/^[A-Za-z0-9\-_]+$/.test(cleanTracking) || /^(.)\1+$/.test(cleanTracking)) {
      const err = new Error('Please provide a valid courier tracking / AWB consignment number (6-35 alphanumeric characters, not repeated dummy characters).');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();

    const fulfillment = {
      courierName: courierName || 'DTDC / India Post',
      trackingNumber: cleanTracking,
      trackingUrl: trackingUrl ? trackingUrl.trim() : null,
      shippedAt: now
    };

    await orderRef.update({
      fulfillment,
      tracking: fulfillment,
      status: 'shipped',
      orderStatus: 'shipped',
      updatedAt: now
    });

    // Audit log
    await db.collection('adminActivityLogs').add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: 'tracking_added',
      resourceType: 'orders',
      resourceId: orderId,
      details: fulfillment,
      timestamp: now
    });

    // Send shipment email
    sendMail({
      to: orderData.customerEmail,
      subject: `Your LANE4 Order #${orderData.orderNumber || orderId} Has Shipped!`,
      templateName: 'order_shipped',
      html: wrapBrandedTemplate(
        'Your Order Is On Its Way!',
        `
          <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Swimmer'},</p>
          <p>Your items have left our Nagpur specialty store and are in transit!</p>
          <p><strong>Courier Partner:</strong> ${fulfillment.courierName}</p>
          <p><strong>Tracking / AWB Number:</strong> ${fulfillment.trackingNumber}</p>
          ${fulfillment.trackingUrl ? `<p><a href="${fulfillment.trackingUrl}" target="_blank" class="btn">Track Shipment</a></p>` : ''}
        `
      )
    });

    return {
      orderId,
      fulfillment,
      tracking: fulfillment,
      status: 'shipped',
      orderStatus: 'shipped'
    };
  }

  async processRefund(orderId, adminUser, { refundReference, notes = '' } = {}) {
    const db = getDb();
    let orderRef = db.collection('orders').doc(orderId);
    let orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      const cleanNum = orderId.toString().trim().replace(/^#/, '');
      const snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderRef = orderDoc.ref;
      } else {
        throw new Error('Order not found');
      }
    }

    const orderData = orderDoc.data();
    if (orderData.refundStatus === 'refunded') {
      return { orderId, status: orderData.status, refundStatus: 'refunded', alreadyRefunded: true };
    }

    const cleanRef = (refundReference || '').trim();
    if (!cleanRef || cleanRef.length < 3) {
      const err = new Error('A valid bank/gateway refund transaction reference is required.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const refundDetails = {
      ...(orderData.refundDetails || {}),
      refundReference: cleanRef,
      status: 'refunded',
      completedAt: now,
      completedBy: adminUser.email || adminUser.uid,
      notes: notes.trim()
    };

    await orderRef.update({
      refundStatus: 'refunded',
      financialStatus: 'refunded',
      refundDetails,
      updatedAt: now
    });

    // Also update any matching returns request in returns collection
    try {
      const retSnap = await db.collection('returns').where('orderId', '==', orderDoc.id).get();
      for (const rDoc of retSnap.docs) {
        if (rDoc.data().status !== 'refunded') {
          await rDoc.ref.update({
            status: 'refunded',
            refundReference: cleanRef,
            adminNotes: notes.trim() || 'Refund processed via admin portal',
            updatedAt: now
          });
        }
      }
    } catch (_) {}

    await db.collection('adminActivityLogs').add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: 'refund_processed',
      resourceType: 'orders',
      resourceId: orderId,
      details: refundDetails,
      timestamp: now
    });

    return {
      orderId,
      orderNumber: orderData.orderNumber || orderId,
      refundStatus: 'refunded',
      refundDetails
    };
  }

  async cancelCustomerOrder(orderId, customer = null, { reason = '', orderAccessToken = '' } = {}) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    let orderDoc = await db.collection('orders').doc(orderId).get();
    let orderData = orderDoc.exists ? orderDoc.data() : null;
    let actualOrderId = orderId;

    if (!orderData) {
      const cleanNum = orderId.toString().trim().replace(/^#/, '');
      const snap = await db.collection('orders').where('orderNumber', '==', cleanNum).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderData = orderDoc.data();
        actualOrderId = orderDoc.id;
      }
    }

    if (!orderData) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Ownership check
    const { ADMIN_ROLES } = require('../constants/roles');
    const isAdmin = customer && customer.role && ADMIN_ROLES.includes(customer.role);

    if (!isAdmin) {
      if (orderData.customerId) {
        if (!customer || !customer.uid || customer.uid !== orderData.customerId) {
          const err = new Error('UNAUTHORIZED: You can only cancel your own orders.');
          err.statusCode = 403;
          err.code = 'FORBIDDEN';
          throw err;
        }
      } else {
        // Guest order: verify orderAccessToken or verified email match
        const { verifyOrderAccessToken } = require('../utils/orderSecurity');
        const tokenValid = verifyOrderAccessToken(actualOrderId, orderData.customerEmail, orderAccessToken);
        const verifiedEmailMatches = Boolean(
          customer &&
          customer.email &&
          customer.emailVerified === true &&
          orderData.customerEmail &&
          customer.email.toLowerCase().trim() === orderData.customerEmail.toLowerCase().trim()
        );

        if (!tokenValid && !verifiedEmailMatches) {
          const err = new Error('UNAUTHORIZED: Invalid verification credential for guest order cancellation.');
          err.statusCode = 403;
          err.code = 'FORBIDDEN';
          throw err;
        }
      }
    }

    // Check cancellation eligibility & transition state atomically within transaction
    const now = new Date();
    const orderDocRef = db.collection('orders').doc(actualOrderId);
    let orderUpdates;

    await db.runTransaction(async (transaction) => {
      const freshOrderDoc = await transaction.get(orderDocRef);
      if (!freshOrderDoc.exists) throw new Error('Order not found');
      const freshOrderData = freshOrderDoc.data();

      const currentStatus = freshOrderData.status || freshOrderData.orderStatus || 'pending_payment';
      if (currentStatus === 'cancelled') {
        const err = new Error('Order is already cancelled.');
        err.statusCode = 400;
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }
      if (['shipped', 'out_for_delivery', 'delivered'].includes(currentStatus)) {
        const err = new Error(`Cannot cancel order in "${currentStatus}" status. Once dispatched, orders must follow the return process.`);
        err.statusCode = 400;
        err.code = 'CANNOT_CANCEL_DISPATCHED_ORDER';
        throw err;
      }
      if (currentStatus === 'returned') {
        const err = new Error('Cannot cancel an order that has already been returned.');
        err.statusCode = 400;
        err.code = 'ORDER_ALREADY_RETURNED';
        throw err;
      }

      const eligibleStatuses = ['pending_payment', 'payment_verification', 'payment_rejected', 'confirmed'];
      if (!eligibleStatuses.includes(currentStatus)) {
        const err = new Error(`Order cannot be cancelled in status "${currentStatus}".`);
        err.statusCode = 400;
        err.code = 'INVALID_CANCELLATION_STATUS';
        throw err;
      }

      orderUpdates = {
        status: 'cancelled',
        orderStatus: 'cancelled',
        cancelledAt: now,
        cancelledBy: customer ? customer.uid : 'guest_customer',
        cancellationReason: (reason || 'Cancelled by customer').trim(),
        updatedAt: now
      };

      if (freshOrderData.paymentStatus === 'verified') {
        orderUpdates.refundStatus = 'pending_refund';
        orderUpdates.financialStatus = 'cancelled_refund_pending';
        orderUpdates.refundDetails = {
          refundId: 'ref_cust_' + Date.now(),
          originalAmountPaise: (freshOrderData.pricing && freshOrderData.pricing.finalPayablePaise) || 0,
          refundAmountPaise: (freshOrderData.pricing && freshOrderData.pricing.finalPayablePaise) || 0,
          status: 'pending_refund',
          initiatedAt: now,
          initiatedBy: customer ? customer.uid : 'customer',
          reason: (reason || 'Order cancelled by customer - refund pending').trim()
        };
      }

      transaction.update(orderDocRef, orderUpdates);
    });

    // Revert coupon if applied
    const couponCode = (orderData.coupon && orderData.coupon.code) || (orderData.pricing && orderData.pricing.couponCode);
    if (couponCode) {
      try {
        const couponService = require('./couponService');
        await couponService.revertCouponRedemption(couponCode);
      } catch (_) {}
    }

    // Inventory restoration (Restores stock exactly once)
    for (const item of orderData.items || []) {
      try {
        // 1. Inventory collection
        const invRef = db.collection('inventory').doc(item.sku);
        const invDoc = await invRef.get();
        if (invDoc.exists) {
          const inv = invDoc.data();
          await invRef.update({
            availableQuantity: (inv.availableQuantity || 0) + item.quantity,
            reservedQuantity: Math.max(0, (inv.reservedQuantity || 0) - item.quantity),
            isOutOfStock: false,
            updatedAt: now
          });
        }

        // 2. Product variants if physical stock was deducted
        if (orderData.stockDeducted) {
          let pSnap = await db.collection('products').where('slug', '==', item.slug || item.productId).limit(1).get();
          if (pSnap.empty && item.productId) {
            const pDocDirect = await db.collection('products').doc(item.productId).get();
            if (pDocDirect.exists) pSnap = { empty: false, docs: [pDocDirect] };
          }
          if (!pSnap.empty) {
            const pDoc = pSnap.docs[0];
            const pData = pDoc.data();
            const variants = (pData.variants || []).map(v => {
              if (v.sku === item.sku || v.variantId === item.variantId) {
                return { ...v, stockQuantity: (v.stockQuantity || 0) + item.quantity };
              }
              return v;
            });
            const totalStock = variants.length > 0
              ? variants.reduce((s, v) => s + (v.stockQuantity || 0), 0)
              : (pData.stockQuantity || 0) + item.quantity;
            await pDoc.ref.update({
              variants,
              stockQuantity: totalStock,
              updatedAt: now
            });
          }
        }
      } catch (_) {}
    }

    // Send customer email notification
    sendMail({
      to: orderData.customerEmail,
      subject: `Order #${orderData.orderNumber || actualOrderId} Cancelled`,
      templateName: 'order_cancelled',
      html: wrapBrandedTemplate(
        `Order #${orderData.orderNumber || actualOrderId} Cancelled`,
        `
          <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Customer'},</p>
          <p>Your order #${orderData.orderNumber || actualOrderId} has been successfully cancelled as requested.</p>
          ${orderData.paymentStatus === 'verified' ? '<p><strong>Refund Notice:</strong> Since your payment was received, our finance team has initiated your refund. You will receive the credit to your source payment method within 3-5 business days.</p>' : ''}
          <p>If you have any questions or wish to place a new order, please visit us at lane4swim.in.</p>
        `
      )
    });

    return {
      orderId: actualOrderId,
      orderNumber: orderData.orderNumber || actualOrderId,
      status: 'cancelled',
      orderStatus: 'cancelled',
      refundStatus: orderUpdates.refundStatus || null,
      updatedAt: now
    };
  }
}

module.exports = new OrderService();
