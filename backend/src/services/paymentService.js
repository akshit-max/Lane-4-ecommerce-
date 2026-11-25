const { getDb } = require('../config/firebaseAdmin');
const { uploadImageBuffer } = require('../config/cloudinary');
const { sendMail, wrapBrandedTemplate } = require('../config/email');
const { staffNotificationService } = require('./staffNotificationService');
const { formatINR } = require('../utils/currency');
const { logger } = require('../utils/logger');

const DEFAULT_PAYMENT_SETTINGS = {
  enabled: true,
  upiId: 'lane4swim@upi',
  upiAccountName: 'THE LANE4 PERFORMANCE STORE',
  paymentInstructions: '1. Scan the store QR code using any UPI app (GPay, PhonePe, Paytm, BHIM).\n2. Pay the exact final payable order amount.\n3. Copy the 12-digit UPI Reference / UTR Number.\n4. Upload the payment confirmation screenshot and click Submit Proof.',
  qrCodeImage: {
    publicId: 'lane4-qr-default',
    url: '6424266ea05809dff501d86e/lane4-share.png'
  }
};

class PaymentService {
  async seedInitialPaymentSettings() {
    const db = getDb();
    if (!db) return;

    try {
      const doc = await db.collection('paymentSettings').doc('upi_qr').get();
      if (!doc.exists) {
        await db.collection('paymentSettings').doc('upi_qr').set({
          ...DEFAULT_PAYMENT_SETTINGS,
          updatedAt: new Date()
        });
        logger.info('Initialized store manual UPI QR payment configuration.');
      }
    } catch (err) {
      logger.error('Error seeding payment settings', err);
    }
  }

  async getPublicPaymentSettings() {
    const db = getDb();
    if (!db) {
      return {
        enabled: DEFAULT_PAYMENT_SETTINGS.enabled,
        upiId: DEFAULT_PAYMENT_SETTINGS.upiId,
        upiAccountName: DEFAULT_PAYMENT_SETTINGS.upiAccountName,
        merchantName: DEFAULT_PAYMENT_SETTINGS.upiAccountName,
        paymentInstructions: DEFAULT_PAYMENT_SETTINGS.paymentInstructions,
        instructions: DEFAULT_PAYMENT_SETTINGS.paymentInstructions,
        verificationWindowMinutes: 30,
        qrCodeUrl: DEFAULT_PAYMENT_SETTINGS.qrCodeImage.url,
        qrCodeImage: DEFAULT_PAYMENT_SETTINGS.qrCodeImage
      };
    }

    const doc = await db.collection('paymentSettings').doc('upi_qr').get();
    if (!doc.exists) {
      return {
        enabled: DEFAULT_PAYMENT_SETTINGS.enabled,
        upiId: DEFAULT_PAYMENT_SETTINGS.upiId,
        upiAccountName: DEFAULT_PAYMENT_SETTINGS.upiAccountName,
        merchantName: DEFAULT_PAYMENT_SETTINGS.upiAccountName,
        paymentInstructions: DEFAULT_PAYMENT_SETTINGS.paymentInstructions,
        instructions: DEFAULT_PAYMENT_SETTINGS.paymentInstructions,
        verificationWindowMinutes: 30,
        qrCodeUrl: DEFAULT_PAYMENT_SETTINGS.qrCodeImage.url,
        qrCodeImage: DEFAULT_PAYMENT_SETTINGS.qrCodeImage
      };
    }

    const data = doc.data() || {};
    let qrUrl = '';
    if (data.qrCodeUrl) {
      qrUrl = data.qrCodeUrl;
    } else if (data.qrCodeImage) {
      qrUrl = typeof data.qrCodeImage === 'string' ? data.qrCodeImage : (data.qrCodeImage.url || '');
    }
    if (!qrUrl && DEFAULT_PAYMENT_SETTINGS.qrCodeImage) {
      qrUrl = DEFAULT_PAYMENT_SETTINGS.qrCodeImage.url;
    }

    const accountName = data.upiAccountName || data.merchantName || DEFAULT_PAYMENT_SETTINGS.upiAccountName;
    const instructions = data.paymentInstructions || data.instructions || DEFAULT_PAYMENT_SETTINGS.paymentInstructions;

    return {
      enabled: data.enabled !== false,
      upiId: data.upiId || DEFAULT_PAYMENT_SETTINGS.upiId,
      upiAccountName: accountName,
      merchantName: accountName,
      paymentInstructions: instructions,
      instructions: instructions,
      verificationWindowMinutes: Number(data.verificationWindowMinutes) || 30,
      qrCodeUrl: qrUrl,
      qrCodeImage: data.qrCodeImage || { url: qrUrl }
    };
  }

  async updatePaymentSettings(data, adminUser) {
    const db = getDb();
    const docRef = db.collection('paymentSettings').doc('upi_qr');

    const updates = {
      updatedAt: new Date()
    };

    if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
    if (data.upiId !== undefined) updates.upiId = data.upiId.trim();
    if (data.upiAccountName !== undefined) updates.upiAccountName = data.upiAccountName.trim();
    if (data.merchantName !== undefined) {
      updates.merchantName = data.merchantName.trim();
      if (!updates.upiAccountName) updates.upiAccountName = data.merchantName.trim();
    }
    if (data.paymentInstructions !== undefined) updates.paymentInstructions = data.paymentInstructions.trim();
    if (data.instructions !== undefined) {
      updates.instructions = data.instructions.trim();
      if (!updates.paymentInstructions) updates.paymentInstructions = data.instructions.trim();
    }
    if (data.verificationWindowMinutes !== undefined) {
      updates.verificationWindowMinutes = Number(data.verificationWindowMinutes) || 30;
    }
    if (data.qrCodeImage !== undefined) {
      updates.qrCodeImage = data.qrCodeImage;
      if (typeof data.qrCodeImage === 'object' && data.qrCodeImage.url) {
        updates.qrCodeUrl = data.qrCodeImage.url;
      } else if (typeof data.qrCodeImage === 'string') {
        updates.qrCodeUrl = data.qrCodeImage;
      }
    }
    if (data.qrCodeUrl !== undefined) {
      updates.qrCodeUrl = data.qrCodeUrl.trim();
      if (!updates.qrCodeImage) {
        updates.qrCodeImage = { url: data.qrCodeUrl.trim() };
      }
    }

    await docRef.set(updates, { merge: true });

    // Audit log
    if (adminUser) {
      await db.collection('adminActivityLogs').add({
        adminUid: adminUser.uid || 'admin',
        adminEmail: adminUser.email || 'staff@lane4.in',
        action: 'settings_updated',
        resourceType: 'settings',
        resourceId: 'upi_qr',
        details: updates,
        timestamp: new Date()
      });
    }

    return this.getPublicPaymentSettings();
  }

  async submitPaymentProof({ orderId, upiReferenceNumber, fileBuffer, mimeType, customerId = null }) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      throw err;
    }
    const cleanUtr = (upiReferenceNumber || '').trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      const err = new Error('Please enter a valid 12-digit numeric UPI Reference / UTR Number.');
      err.statusCode = 400;
      throw err;
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      const err = new Error('Please upload your payment confirmation screenshot.');
      err.statusCode = 400;
      throw err;
    }

    // Check for duplicate UTR submitted or verified for another active order
    const dupCheckSnap = await db.collection('payments')
      .where('upiReferenceNumber', '==', cleanUtr)
      .get();
    const dupOther = dupCheckSnap.docs.find(d => {
      const p = d.data();
      return p.orderId !== orderId && (p.status === 'verified' || p.status === 'verification_pending');
    });
    if (dupOther) {
      const err = new Error(`This UPI Reference / UTR Number (${cleanUtr}) has already been submitted or verified for another order.`);
      err.statusCode = 400;
      throw err;
    }

    // Check UTR ledger to prevent re-use of previously verified UTR
    const ledgerDoc = await db.collection('utrLedger').doc(cleanUtr).get();
    if (ledgerDoc.exists) {
      const ledgerData = ledgerDoc.data();
      if (ledgerData.orderId && ledgerData.orderId !== orderId) {
        const err = new Error(`This UPI Reference / UTR Number (${cleanUtr}) has already been verified for order #${ledgerData.orderNumber || ledgerData.orderId}. Duplicate submissions are not accepted.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Locate order
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      throw new Error(`Order "${orderId}" not found.`);
    }

    const orderData = orderDoc.data();

    // Verify ownership if authenticated
    if (customerId && orderData.customerId && orderData.customerId !== customerId) {
      throw new Error('Unauthorized: You cannot submit payment proof for another customer order.');
    }

    // Verify order is in an acceptable state for payment submission
    if (orderData.paymentStatus === 'verified') {
      throw new Error('This order has already been verified and paid.');
    }

    // Upload screenshot to Cloudinary
    const uploadResult = await uploadImageBuffer(fileBuffer, {
      folder: 'payment_proofs',
      mimeType,
      isPrivate: false
    });

    // Check if an existing payment document exists
    const existingPaymentSnap = await db.collection('payments')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    let paymentId;
    let attempts = 1;

    if (!existingPaymentSnap.empty) {
      const existingDoc = existingPaymentSnap.docs[0];
      paymentId = existingDoc.id;
      const existingData = existingDoc.data();
      attempts = (existingData.submissionAttempts || 1) + 1;

      // Preserve superseded screenshot in proofHistory
      const priorHistory = Array.isArray(existingData.proofHistory) ? [...existingData.proofHistory] : [];
      if (existingData.proofScreenshot && (existingData.proofScreenshot.secureUrl || existingData.proofScreenshot.url)) {
        const oldUrl = existingData.proofScreenshot.secureUrl || existingData.proofScreenshot.url;
        const oldPublicId = existingData.proofScreenshot.publicId || null;
        const isDuplicate = priorHistory.some(h =>
          (h.secureUrl && h.secureUrl === oldUrl) ||
          (oldPublicId && h.publicId && h.publicId === oldPublicId)
        );

        if (!isDuplicate) {
          priorHistory.push({
            publicId: oldPublicId,
            secureUrl: oldUrl,
            upiReferenceNumber: existingData.upiReferenceNumber || null,
            uploadedAt: existingData.proofScreenshot.uploadedAt || existingData.updatedAt || existingData.createdAt || new Date(),
            supersededAt: new Date(),
            submissionAttempt: existingData.submissionAttempts || 1,
            rejectionReason: existingData.rejection?.reason || existingData.verification?.rejectionReason || null,
            internalNotes: existingData.rejection?.internalNotes || existingData.verification?.internalNotes || null
          });
        }
      }

      await db.collection('payments').doc(paymentId).update({
        upiReferenceNumber: cleanUtr,
        status: 'verification_pending',
        proofScreenshot: {
          publicId: uploadResult.publicId,
          secureUrl: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
        proofHistory: priorHistory,
        submissionAttempts: attempts,
        updatedAt: new Date()
      });
    } else {
      const newPaymentRef = db.collection('payments').doc();
      paymentId = newPaymentRef.id;

      await newPaymentRef.set({
        paymentId,
        orderId,
        orderNumber: orderData.orderNumber || orderId,
        amountPaise: orderData.pricing ? orderData.pricing.finalPayablePaise : 0,
        upiReferenceNumber: cleanUtr,
        status: 'verification_pending',
        proofScreenshot: {
          publicId: uploadResult.publicId,
          secureUrl: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
        proofHistory: [],
        verification: {},
        submissionAttempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Transition order state
    await orderRef.update({
      paymentStatus: 'verification_pending',
      status: 'payment_verification',
      updatedAt: new Date()
    });

    // Ensure cart is cleared upon payment proof submission
    try {
      const cartService = require('./cartService');
      await cartService.clearCart(orderData.customerId, orderData.guestId);
    } catch (_) {}

    // Create admin notification
    await db.collection('notifications').add({
      type: 'payment_submitted',
      title: 'New UPI Payment Proof Submitted',
      message: `Payment proof submitted for order ${orderData.orderNumber || orderId} (UTR: ********${cleanUtr.slice(-4)})`,
      referenceId: orderId,
      isRead: false,
      createdAt: new Date()
    });

    const payableFormatted = formatINR(orderData.pricing ? orderData.pricing.finalPayablePaise : 0);

    // Notify staff of payment proof submission (non-blocking async)
    staffNotificationService.notifyPaymentProofSubmitted({
      orderId,
      orderNumber: orderData.orderNumber || orderId,
      customerEmail: orderData.customerEmail,
      amountFormatted: payableFormatted,
      amountPaise: orderData.pricing ? orderData.pricing.finalPayablePaise : 0,
      upiReferenceNumber: cleanUtr
    });

    // Send customer notification email
    sendMail({
      to: orderData.customerEmail,
      subject: `Payment Received — Awaiting Verification (Order #${orderData.orderNumber || orderId})`,
      templateName: 'payment_pending',
      html: wrapBrandedTemplate(
        'Payment Proof Received',
        `
          <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Swimmer'},</p>
          <p>We have successfully received your payment proof for Order <strong>#${orderData.orderNumber || orderId}</strong>.</p>
          <p><strong>Amount:</strong> ${payableFormatted}</p>
          <p><strong>UPI Ref (UTR):</strong> ${cleanUtr}</p>
          <p>Our store team is verifying the transaction against our account records. Once verified, your order will be confirmed and processed for shipment.</p>
          <p>You can check your order status at any time from your account.</p>
        `
      )
    });

    return {
      paymentId,
      orderId,
      paymentStatus: 'verification_pending',
      orderStatus: 'payment_verification',
      upiReferenceNumber: cleanUtr,
      screenshotUrl: uploadResult.secureUrl
    };
  }

  async getPaymentByOrderId(orderId) {
    const db = getDb();
    const snap = await db.collection('payments')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { paymentId: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async getPaymentById(paymentId) {
    const db = getDb();
    const doc = await db.collection('payments').doc(paymentId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      paymentId: doc.id,
      ...data,
      createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString()
    };
  }

  async listPayments(filters = {}) {
    const db = getDb();
    if (!db) return [];

    let query = db.collection('payments');
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    const snap = await query.get();
    const parseDate = (val) => {
      if (!val) return new Date().toISOString();
      if (typeof val === 'string') return val;
      if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString();
      if (val._seconds) return new Date(val._seconds * 1000).toISOString();
      if (val.seconds) return new Date(val.seconds * 1000).toISOString();
      if (val instanceof Date) return val.toISOString();
      return new Date(val).toISOString();
    };

    let payments = snap.docs.map(d => {
      const data = d.data();
      return {
        paymentId: d.id,
        ...data,
        createdAt: parseDate(data.createdAt),
        updatedAt: parseDate(data.updatedAt)
      };
    });
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return payments;
  }

  async approvePayment(paymentId, adminUser, internalNote = '') {
    const db = getDb();
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) throw new Error('Payment record not found.');

    const paymentData = paymentDoc.data();
    if (paymentData.status === 'verified') {
      return {
        paymentId,
        status: 'verified',
        orderStatus: 'confirmed',
        alreadyVerified: true
      };
    }

    const cleanNote = (internalNote || '').trim();
    if (!cleanNote || cleanNote.length < 3) {
      const err = new Error('A mandatory verification note (at least 3 characters) is required to approve payments.');
      err.statusCode = 400;
      throw err;
    }
    if (cleanNote.length > 500) {
      const err = new Error('Approval note cannot exceed 500 characters.');
      err.statusCode = 400;
      throw err;
    }

    const cleanUtr = (paymentData.upiReferenceNumber || '').replace(/[^0-9]/g, '').trim();

    // Atomic server-side duplicate UTR check and ledger locking across all orders
    if (cleanUtr) {
      // 1. Check existing verified payments
      const existingVerifiedSnap = await db.collection('payments')
        .where('upiReferenceNumber', '==', cleanUtr)
        .where('status', '==', 'verified')
        .get();
      const conflict = existingVerifiedSnap.docs.find(d => d.id !== paymentId && d.data().orderId !== paymentData.orderId);
      if (conflict) {
        const conflictData = conflict.data();
        const err = new Error(`Duplicate UTR: This UPI reference number (${cleanUtr}) has already been verified for order #${conflictData.orderNumber || conflictData.orderId}. Cannot approve duplicate.`);
        err.statusCode = 409;
        throw err;
      }

      // 2. Atomic lock in utrLedger collection
      const utrRef = db.collection('utrLedger').doc(cleanUtr);
      await db.runTransaction(async (transaction) => {
        const utrDoc = await transaction.get(utrRef);
        if (utrDoc.exists) {
          const ledgerData = utrDoc.data();
          if (ledgerData.orderId && ledgerData.orderId !== paymentData.orderId) {
            const err = new Error(`Duplicate UTR: UPI Reference Number ${cleanUtr} is already approved for order #${ledgerData.orderNumber || ledgerData.orderId}. Duplicate payment approval rejected.`);
            err.statusCode = 409;
            throw err;
          }
        }
        transaction.set(utrRef, {
          utr: cleanUtr,
          orderId: paymentData.orderId,
          orderNumber: paymentData.orderNumber || paymentData.orderId,
          paymentId,
          verifiedAt: new Date(),
          verifiedByUid: adminUser.uid,
          verifiedByName: adminUser.displayName || adminUser.email
        });
      });
    }

    const orderRef = db.collection('orders').doc(paymentData.orderId);
    const now = new Date();
    let orderData;

    // Atomic transactional order validation & payment approval
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) throw new Error('Associated order record not found.');
      orderData = orderDoc.data();

      const currentStatus = orderData.status || orderData.orderStatus;
      if (currentStatus === 'cancelled') {
        const err = new Error(`Cannot approve payment: Order #${orderData.orderNumber || paymentData.orderId} has already been cancelled.`);
        err.statusCode = 400;
        err.code = 'ORDER_ALREADY_CANCELLED';
        throw err;
      }

      if (currentStatus === 'returned' || currentStatus === 'refunded') {
        const err = new Error(`Cannot approve payment: Order #${orderData.orderNumber || paymentData.orderId} is in "${currentStatus}" status.`);
        err.statusCode = 400;
        err.code = 'INVALID_ORDER_STATUS';
        throw err;
      }

      const freshPaymentDoc = await transaction.get(paymentRef);
      if (!freshPaymentDoc.exists) throw new Error('Payment record not found.');
      const freshPaymentData = freshPaymentDoc.data();
      if (freshPaymentData.status === 'verified') {
        return; // Already verified
      }

      // Update payment within transaction
      transaction.update(paymentRef, {
        status: 'verified',
        verification: {
          verifiedAt: now,
          verifiedByUid: adminUser.uid,
          verifiedByName: adminUser.displayName || adminUser.email,
          internalNotes: cleanNote
        },
        updatedAt: now
      });

      // Update order within transaction
      transaction.update(orderRef, {
        paymentStatus: 'verified',
        status: 'confirmed',
        orderStatus: 'confirmed',
        stockDeducted: true,
        updatedAt: now
      });
    });

    // Deduct physical inventory & product variants stock if not already deducted
    if (!orderData.stockDeducted && orderData.items && orderData.items.length > 0) {
      for (const item of orderData.items) {
        try {
          // 1. Update inventory collection document (fulfill reserved quantity)
          const invRef = db.collection('inventory').doc(item.sku);
          const invDoc = await invRef.get();
          if (invDoc.exists) {
            const inv = invDoc.data();
            const newReserved = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
            await invRef.update({
              reservedQuantity: newReserved,
              updatedAt: now
            });
          }

          // 2. Update products collection document (variants + total stock)
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
                return { ...v, stockQuantity: Math.max(0, (v.stockQuantity || 0) - item.quantity) };
              }
              return v;
            });
            const totalStock = variants.length > 0
              ? variants.reduce((s, v) => s + (v.stockQuantity || 0), 0)
              : Math.max(0, (pData.stockQuantity || 0) - item.quantity);
            await pDoc.ref.update({
              variants,
              stockQuantity: totalStock,
              updatedAt: now
            });
          }
        } catch (_) {}
      }
    }

    // Audit log
    await db.collection('adminActivityLogs').add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: 'payment_approved',
      resourceType: 'payments',
      resourceId: paymentId,
      details: {
        orderId: paymentData.orderId,
        orderNumber: paymentData.orderNumber,
        amountPaise: paymentData.amountPaise,
        internalNote
      },
      timestamp: now
    });

    // Send confirmation email
    sendMail({
      to: orderData.customerEmail,
      subject: `Payment Verified! Order #${orderData.orderNumber || orderData.orderId} Confirmed`,
      templateName: 'payment_approved',
      html: wrapBrandedTemplate(
        'Payment Verified & Order Confirmed',
        `
          <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Swimmer'},</p>
          <p>Great news! Your payment of <strong>${formatINR(paymentData.amountPaise)}</strong> for Order <strong>#${orderData.orderNumber || orderData.orderId}</strong> has been verified by our team.</p>
          <p>Your items are now being prepared for dispatch at our Nagpur specialty store. We will send you courier tracking information as soon as your package ships.</p>
        `
      )
    });

    return {
      paymentId,
      status: 'verified',
      orderStatus: 'confirmed'
    };
  }

  async rejectPayment(paymentId, adminUser, rejectionReason = '') {
    const db = getDb();
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) throw new Error('Payment record not found.');

    const paymentData = paymentDoc.data();
    const orderRef = db.collection('orders').doc(paymentData.orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) throw new Error('Associated order record not found.');
    const orderData = orderDoc.data();

    const now = new Date();
    const reasonText = rejectionReason.trim() || 'Payment could not be verified with the provided transaction reference.';

    // Update payment audit trail: store under rejection, never under verification
    await paymentRef.update({
      status: 'rejected',
      rejection: {
        rejectedAt: now,
        rejectedByUid: adminUser.uid,
        rejectedByName: adminUser.displayName || adminUser.email,
        reason: reasonText
      },
      updatedAt: now
    });

    // Update order status so it reflects payment rejection and cannot proceed to shipping
    await orderRef.update({
      paymentStatus: 'rejected',
      status: 'payment_rejected',
      orderStatus: 'payment_rejected',
      updatedAt: now
    });

    // Revert coupon redemption if applied so coupon usage limit is not wasted
    const couponCode = (orderData.coupon && orderData.coupon.code) || (orderData.pricing && orderData.pricing.couponCode);
    if (couponCode) {
      try {
        const couponService = require('./couponService');
        await couponService.revertCouponRedemption(couponCode);
      } catch (_) {}
    }

    // Audit log
    await db.collection('adminActivityLogs').add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: 'payment_rejected',
      resourceType: 'payments',
      resourceId: paymentId,
      details: {
        orderId: paymentData.orderId,
        orderNumber: paymentData.orderNumber,
        reason: reasonText
      },
      timestamp: now
    });

    // Send customer notification with resubmission instructions
    sendMail({
      to: orderData.customerEmail,
      subject: `Payment Verification Update for Order #${orderData.orderNumber || orderData.orderId}`,
      templateName: 'payment_rejected',
      html: wrapBrandedTemplate(
        'Payment Verification Unsuccessful',
        `
          <p>Hi ${orderData.shippingAddress ? orderData.shippingAddress.addressee : 'Swimmer'},</p>
          <p>We reviewed your submitted payment proof for Order <strong>#${orderData.orderNumber || orderData.orderId}</strong>, but our team was unable to verify the transaction.</p>
          <p><strong>Reason provided by staff:</strong> ${reasonText}</p>
          <p>Please double check your bank/UPI transaction details and resubmit a clear screenshot and correct 12-digit UTR reference ID.</p>
        `
      )
    });

    return {
      paymentId,
      status: 'rejected',
      orderStatus: orderData.status,
      rejectionReason: reasonText
    };
  }
}

module.exports = new PaymentService();
