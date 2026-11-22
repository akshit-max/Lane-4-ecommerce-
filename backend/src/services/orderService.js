const { getDb } = require('../config/firebaseAdmin');
const productService = require('./productService');
const couponService = require('./couponService');
const shippingService = require('./shippingService');
const cartService = require('./cartService');
const { formatINR } = require('../utils/currency');
const { sendMail, wrapBrandedTemplate } = require('../config/email');
const { logger } = require('../utils/logger');

function toMillis(d) {
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (d._seconds !== undefined) return d._seconds * 1000 + Math.floor((d._nanoseconds || 0) / 1e6);
  if (d.seconds !== undefined) return d.seconds * 1000;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

class OrderService {
  _generateOrderNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `L4-${year}-${random}`;
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

      const unitPricePaise = (variant && variant.pricePaise) || product.salePricePaise || product.regularPricePaise;
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

    const customerId = customer ? customer.uid : null;
    const customerEmail = data.customerEmail || (customer ? customer.email : null);
    const customerPhone = data.customerPhone || '';

    if (!customerEmail) {
      throw new Error('Customer email is required.');
    }
    if (!data.shippingAddress || !data.shippingAddress.addressLine1 || !data.shippingAddress.postalCode) {
      throw new Error('Complete shipping address and PIN code are required.');
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
    const orderNumber = this._generateOrderNumber();
    const now = new Date();

    // Transaction to reserve inventory and persist immutable order snapshot
    await db.runTransaction(async (transaction) => {
      // 1. Check stock for each variant
      for (const item of quote.items) {
        const invRef = db.collection('inventory').doc(item.sku);
        const invDoc = await transaction.get(invRef);

        if (invDoc.exists) {
          const invData = invDoc.data();
          const currentAvailable = invData.availableQuantity || 0;
          if (currentAvailable < item.quantity) {
            throw new Error(`Insufficient stock for "${item.name} (${item.sku})". Only ${currentAvailable} left.`);
          }

          // Decrement available, increment reserved
          transaction.update(invRef, {
            availableQuantity: currentAvailable - item.quantity,
            reservedQuantity: (invData.reservedQuantity || 0) + item.quantity,
            isOutOfStock: (currentAvailable - item.quantity) <= 0,
            updatedAt: now
          });
        }
      }

      // 2. Write Order Record
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
        shippingAddress: {
          addressee: data.shippingAddress.addressee || customerEmail,
          phone: data.shippingAddress.phone || customerPhone,
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

    return {
      orderId,
      orderNumber,
      status: 'pending_payment',
      orderStatus: 'pending_payment',
      paymentStatus: 'awaiting_payment',
      pricing: quote.pricing,
      items: quote.items
    };
  }

  async getOrderById(orderId, user = null) {
    const db = getDb();
    if (!db) return null;

    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return null;

    const order = doc.data();
    if (order) {
      order.orderStatus = order.orderStatus || order.status;
      order.tracking = order.tracking || order.fulfillment || null;
    }

    // Security check: Customer can only view their own orders
    if (user && user.role === 'customer' && order.customerId && order.customerId !== user.uid) {
      throw new Error('UNAUTHORIZED: Access to requested order is denied.');
    }

    return order;
  }

  async getMyOrders(customerId, customerEmail = null) {
    const db = getDb();
    if (!db || (!customerId && !customerEmail)) return [];

    const orderMap = new Map();

    // 1. Fetch orders tied to registered customerId
    if (customerId) {
      const snap = await db.collection('orders')
        .where('customerId', '==', customerId)
        .get();
      snap.docs.forEach(d => {
        const data = d.data();
        orderMap.set(data.orderNumber || d.id, {
          ...data,
          id: d.id,
          orderId: data.orderId || d.id
        });
      });
    }

    // 2. Also fetch and auto-link any guest orders placed before signup with this email
    if (customerEmail) {
      const cleanEmail = customerEmail.toLowerCase().trim();
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
      throw new Error(`No order found matching reference #${cleanNum}. Please verify your order number and email.`);
    }

    const order = orderDoc.data();
    const recordEmail = (order.customerEmail || '').toLowerCase().trim();

    if (recordEmail !== cleanEmail) {
      throw new Error('The email address provided does not match the customer record for this order.');
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

    const ALLOWED_STATUSES = [
      'pending_payment',
      'payment_verification',
      'confirmed',
      'processing',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
      'refunded'
    ];

    if (!ALLOWED_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid order status "${newStatus}".`);
    }

    // If order is cancelled, restore reserved inventory
    if (newStatus === 'cancelled' && orderData.status !== 'cancelled') {
      for (const item of orderData.items || []) {
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
      }
    }

    await orderRef.update({
      status: newStatus,
      orderStatus: newStatus,
      updatedAt: now
    });

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
      updatedAt: now
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
    const now = new Date();

    const fulfillment = {
      courierName: courierName || 'DTDC / India Post',
      trackingNumber: trackingNumber.trim(),
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
}

module.exports = new OrderService();
