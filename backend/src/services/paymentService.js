const { getDb } = require('../config/firebaseAdmin');
const { uploadImageBuffer } = require('../config/cloudinary');
const { sendMail, wrapBrandedTemplate } = require('../config/email');
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

    if (!orderId) throw new Error('Order ID is required');
    if (!upiReferenceNumber || upiReferenceNumber.trim().length < 6) {
      throw new Error('Please enter a valid UPI / UTR Transaction Reference Number (min 6 characters).');
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Please upload your payment confirmation screenshot.');
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
      attempts = (existingDoc.data().submissionAttempts || 1) + 1;

      await db.collection('payments').doc(paymentId).update({
        upiReferenceNumber: upiReferenceNumber.trim(),
        status: 'verification_pending',
        proofScreenshot: {
          publicId: uploadResult.publicId,
          secureUrl: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
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
        upiReferenceNumber: upiReferenceNumber.trim(),
        status: 'verification_pending',
        proofScreenshot: {
          publicId: uploadResult.publicId,
          secureUrl: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
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

    // Create admin notification
    await db.collection('notifications').add({
      type: 'payment_submitted',
      title: 'New UPI Payment Proof Submitted',
      message: `Payment proof submitted for order ${orderData.orderNumber || orderId} (UTR: ${upiReferenceNumber.trim()})`,
      referenceId: orderId,
      isRead: false,
      createdAt: new Date()
    });

    // Send customer notification email
    const payableFormatted = formatINR(orderData.pricing ? orderData.pricing.finalPayablePaise : 0);
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
          <p><strong>UPI Ref (UTR):</strong> ${upiReferenceNumber.trim()}</p>
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
      upiReferenceNumber: upiReferenceNumber.trim(),
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

    const orderRef = db.collection('orders').doc(paymentData.orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) throw new Error('Associated order record not found.');
    const orderData = orderDoc.data();

    const now = new Date();

    // Update payment
    await paymentRef.update({
      status: 'verified',
      verification: {
        verifiedAt: now,
        verifiedByUid: adminUser.uid,
        verifiedByName: adminUser.displayName || adminUser.email,
        internalNotes: internalNote || 'Manually confirmed against bank UPI credit.'
      },
      updatedAt: now
    });

    // Update order
    await orderRef.update({
      paymentStatus: 'verified',
      status: 'confirmed',
      orderStatus: 'confirmed',
      updatedAt: now
    });

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

    // Update payment
    await paymentRef.update({
      status: 'rejected',
      verification: {
        verifiedAt: now,
        verifiedByUid: adminUser.uid,
        verifiedByName: adminUser.displayName || adminUser.email,
        rejectionReason: reasonText
      },
      updatedAt: now
    });

    // Update order: allow customer to resubmit payment proof
    await orderRef.update({
      paymentStatus: 'rejected',
      updatedAt: now
    });

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
