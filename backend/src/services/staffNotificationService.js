const emailConfig = require('../config/email');
const { wrapBrandedTemplate } = emailConfig;
const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

/**
 * Mask 12-digit UPI UTR for safe logging and email subject lines
 * e.g., '123456789012' -> '********9012'
 */
function maskUtr(utr) {
  if (!utr) return 'N/A';
  const s = String(utr).trim();
  if (s.length <= 4) return s;
  return '********' + s.slice(-4);
}

class StaffNotificationService {
  constructor() {
    this.DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour suppression
    this.lowStockAlertCache = new Map(); // local fast cache
    this._isProcessing = false; // overlap guard to prevent concurrent outbox runs
    this._workerTimer = null; // timer handle for standalone periodic worker
  }

  /**
   * Reset in-memory and local test cache
   */
  clearDeduplicationCache() {
    this.lowStockAlertCache.clear();
  }

  /**
   * Resolve configured staff notification email recipient(s)
   */
  async getStaffRecipients() {
    if (process.env.STAFF_NOTIFICATION_EMAIL) {
      return process.env.STAFF_NOTIFICATION_EMAIL.trim();
    }
    if (process.env.ADMIN_EMAIL) {
      return process.env.ADMIN_EMAIL.trim();
    }

    try {
      const db = getDb();
      if (db) {
        const snap = await db.collection('storeSettings').doc('profile').get();
        if (snap.exists) {
          const profile = snap.data();
          if (profile.supportEmail || profile.contactEmail) {
            return (profile.supportEmail || profile.contactEmail).trim();
          }
        }
      }
    } catch (_) {}

    return 'Lane4performancestore@gmail.com';
  }

  /**
   * Durable outbox enqueue: persists notification to Firestore before attempting dispatch
   */
  async enqueueNotification({ idempotencyKey, eventType, to, subject, html, text = '', templateName }) {
    const db = getDb();
    const now = new Date();
    const outboxId = `outbox_${idempotencyKey}`;

    if (db) {
      const outboxRef = db.collection('emailOutbox').doc(outboxId);
      const existingSnap = await outboxRef.get();

      if (existingSnap.exists) {
        const data = existingSnap.data();
        if (data.status === 'sent' || data.status === 'pending') {
          return { skipped: true, reason: 'idempotent_duplicate', outboxId };
        }
      }

      await outboxRef.set({
        outboxId,
        idempotencyKey,
        eventType,
        to,
        subject,
        html,
        text,
        templateName,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        createdAt: now,
        updatedAt: now,
        sentAt: null
      });
    }

    // Trigger immediate background processing (non-blocking)
    this._triggerDispatcher();

    return { enqueued: true, outboxId };
  }

  /**
   * Outbox Worker / Dispatcher: processes pending messages from emailOutbox
   * Features concurrency lock (_isProcessing) to prevent overlapping execution
   * and enforces exponential backoff via nextAttemptAt.
   */
  async processPendingOutbox(limit = 10) {
    if (this._isProcessing) {
      return { processed: 0, skipped: true, reason: 'already_processing' };
    }
    this._isProcessing = true;

    const db = getDb();
    if (!db) {
      this._isProcessing = false;
      return { processed: 0 };
    }

    try {
      // Prioritize pending items so fresh events are not starved by future-backoff retries
      const pendingSnap = await db.collection('emailOutbox')
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

      let docsToProcess = [...(pendingSnap.docs || [])];
      if (docsToProcess.length < limit) {
        const retrySnap = await db.collection('emailOutbox')
          .where('status', '==', 'retry')
          .limit(limit - docsToProcess.length)
          .get();
        docsToProcess.push(...(retrySnap.docs || []));
      }

      if (docsToProcess.length === 0) return { processed: 0 };

      let processedCount = 0;

      for (const doc of docsToProcess) {
        const item = doc.data();
        const docRef = doc.ref;

        // Skip if scheduled for future retry attempt under exponential backoff
        if (item.nextAttemptAt) {
          const attemptTime = item.nextAttemptAt.toMillis
            ? item.nextAttemptAt.toMillis()
            : new Date(item.nextAttemptAt).getTime();
          if (attemptTime > Date.now()) {
            continue;
          }
        }

        try {
          const result = await emailConfig.sendMail({
            to: item.to,
            subject: item.subject,
            html: item.html,
            text: item.text,
            templateName: item.templateName
          });

          await docRef.update({
            status: 'sent',
            attempts: (item.attempts || 0) + 1,
            sentAt: new Date(),
            updatedAt: new Date(),
            deliveryResult: result?.status || 'sent'
          });

          processedCount++;
        } catch (dispatchErr) {
          const newAttempts = (item.attempts || 0) + 1;
          const maxAttempts = item.maxAttempts || 3;
          const newStatus = newAttempts >= maxAttempts ? 'failed' : 'retry';
          // Exponential backoff: 2 min, 4 min, 8 min
          const backoffMinutes = Math.pow(2, newAttempts);
          const nextAttemptAt = newStatus === 'retry' ? new Date(Date.now() + backoffMinutes * 60 * 1000) : null;

          await docRef.update({
            status: newStatus,
            attempts: newAttempts,
            nextAttemptAt,
            lastError: dispatchErr.message,
            updatedAt: new Date()
          });

          logger.warn(`Outbox item ${item.outboxId} dispatch failed (attempt ${newAttempts}):`, {
            error: dispatchErr.message
          });
        }
      }

      return { processed: processedCount };
    } catch (err) {
      logger.warn('Error in outbox dispatcher:', { error: err.message });
      return { processed: 0, error: err.message };
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Start standing periodic worker for standalone / container environments
   */
  startWorker(intervalMs = 60000) {
    if (this._workerTimer) return;
    this._workerTimer = setInterval(() => {
      this.processPendingOutbox().catch(err => {
        logger.warn('Periodic outbox worker error:', { error: err.message });
      });
    }, intervalMs);
    if (this._workerTimer && typeof this._workerTimer.unref === 'function') {
      this._workerTimer.unref();
    }
    logger.info(`Outbox periodic worker started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop standing periodic worker
   */
  stopWorker() {
    if (this._workerTimer) {
      clearInterval(this._workerTimer);
      this._workerTimer = null;
      logger.info('Outbox periodic worker stopped');
    }
  }

  /**
   * Background dispatcher trigger (non-blocking)
   */
  _triggerDispatcher() {
    setImmediate(() => {
      this.processPendingOutbox().catch(err => {
        logger.warn('Background outbox dispatch error:', { error: err.message });
      });
    });
  }

  // ==========================================
  // 1. NEW ORDER PLACED NOTIFICATION
  // ==========================================
  notifyNewOrderPlaced(orderData) {
    const orderNumber = orderData.orderNumber || orderData.orderId || 'UNKNOWN';
    const idempotencyKey = `order_placed_${orderData.orderId || orderNumber}`;

    setImmediate(async () => {
      try {
        const to = await this.getStaffRecipients();
        const amount = orderData.pricing?.finalPayableFormatted || (orderData.pricing?.finalPayablePaise ? `₹${(orderData.pricing.finalPayablePaise / 100).toFixed(2)}` : 'N/A');
        const customer = orderData.customerEmail || orderData.shippingAddress?.addressee || 'Customer';
        const itemCount = (orderData.items || []).reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);
        const method = orderData.paymentMethod || 'UPI_QR';

        const subject = `[Action Required] New Order #${orderNumber} Placed (${amount})`;
        const html = wrapBrandedTemplate(
          `New Order Placed — #${orderNumber}`,
          `
            <p>A new customer order has been placed on the Lane4 storefront.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Order Number:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${customer}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Items Count:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${itemCount}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Total Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Payment Method:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${method}</td></tr>
            </table>
            <p>The order is awaiting customer UPI payment verification.</p>
          `
        );

        await this.enqueueNotification({
          idempotencyKey,
          eventType: 'new_order',
          to,
          subject,
          html,
          templateName: 'staff_new_order'
        });
      } catch (err) {
        logger.warn('Failed to enqueue new order staff notification:', { error: err.message });
      }
    });
  }

  async sendNewOrderPlacedNow(orderData) {
    const to = await this.getStaffRecipients();
    const orderNumber = orderData.orderNumber || orderData.orderId || 'UNKNOWN';
    const amount = orderData.pricing?.finalPayableFormatted || (orderData.pricing?.finalPayablePaise ? `₹${(orderData.pricing.finalPayablePaise / 100).toFixed(2)}` : 'N/A');
    const customer = orderData.customerEmail || orderData.shippingAddress?.addressee || 'Customer';
    const itemCount = (orderData.items || []).reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);
    const method = orderData.paymentMethod || 'UPI_QR';

    const subject = `[Action Required] New Order #${orderNumber} Placed (${amount})`;
    const html = wrapBrandedTemplate(
      `New Order Placed — #${orderNumber}`,
      `
        <p>A new customer order has been placed on the Lane4 storefront.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Order Number:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${customer}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Items Count:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${itemCount}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Total Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Payment Method:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${method}</td></tr>
        </table>
        <p>The order is awaiting customer UPI payment verification.</p>
      `
    );

    return emailConfig.sendMail({ to, subject, html, templateName: 'staff_new_order' });
  }

  // ==========================================
  // 2. PAYMENT PROOF SUBMITTED NOTIFICATION
  // ==========================================
  notifyPaymentProofSubmitted(paymentData) {
    const orderNumber = paymentData.orderNumber || paymentData.orderId || 'UNKNOWN';
    const cleanUtr = String(paymentData.upiReferenceNumber || '').trim();
    const masked = maskUtr(cleanUtr);
    const idempotencyKey = `payment_proof_${paymentData.orderId || orderNumber}_${cleanUtr}`;

    setImmediate(async () => {
      try {
        const to = await this.getStaffRecipients();
        const amount = paymentData.amountFormatted || (paymentData.amountPaise ? `₹${(paymentData.amountPaise / 100).toFixed(2)}` : 'N/A');

        // Security: Mask UTR in email subject and log statements
        const subject = `[Action Required] Payment Proof Submitted for Order #${orderNumber} (UTR: ${masked})`;
        const html = wrapBrandedTemplate(
          `Payment Verification Pending — Order #${orderNumber}`,
          `
            <p>A customer has uploaded UPI payment proof and reference number for manual admin verification.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Order Number:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">UPI UTR / Reference:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0284c7;">${cleanUtr}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer Email:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${paymentData.customerEmail || 'N/A'}</td></tr>
            </table>
            <p>Please log in to the Lane4 Admin Portal to inspect the screenshot and approve or reject the payment.</p>
          `
        );

        await this.enqueueNotification({
          idempotencyKey,
          eventType: 'payment_proof',
          to,
          subject,
          html,
          templateName: 'staff_payment_proof'
        });
      } catch (err) {
        logger.warn('Failed to enqueue payment proof staff notification:', { error: err.message });
      }
    });
  }

  async sendPaymentProofSubmittedNow(paymentData) {
    const to = await this.getStaffRecipients();
    const orderNumber = paymentData.orderNumber || paymentData.orderId || 'UNKNOWN';
    const cleanUtr = String(paymentData.upiReferenceNumber || '').trim();
    const masked = maskUtr(cleanUtr);
    const amount = paymentData.amountFormatted || (paymentData.amountPaise ? `₹${(paymentData.amountPaise / 100).toFixed(2)}` : 'N/A');

    const subject = `[Action Required] Payment Proof Submitted for Order #${orderNumber} (UTR: ${masked})`;
    const html = wrapBrandedTemplate(
      `Payment Verification Pending — Order #${orderNumber}`,
      `
        <p>A customer has uploaded UPI payment proof and reference number for manual admin verification.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Order Number:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">UPI UTR / Reference:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0284c7;">${cleanUtr}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer Email:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${paymentData.customerEmail || 'N/A'}</td></tr>
        </table>
        <p>Please log in to the Lane4 Admin Portal to inspect the screenshot and approve or reject the payment.</p>
      `
    );

    return emailConfig.sendMail({ to, subject, html, templateName: 'staff_payment_proof' });
  }

  // ==========================================
  // 3. RETURN REQUESTED NOTIFICATION
  // ==========================================
  notifyReturnRequested(returnData) {
    const returnId = returnData.returnId || 'UNKNOWN';
    const idempotencyKey = `return_req_${returnId}`;

    setImmediate(async () => {
      try {
        const to = await this.getStaffRecipients();
        const orderNumber = returnData.orderNumber || returnData.orderId || 'UNKNOWN';
        const reason = returnData.reason || 'No reason provided';
        const customer = returnData.customerEmail || 'Customer';

        const subject = `[Action Required] New Return Request ${returnId} for Order #${orderNumber}`;
        const html = wrapBrandedTemplate(
          `New Return Request — ${returnId}`,
          `
            <p>A customer has submitted a return/exchange request.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Return ID:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${returnId}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Order Reference:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer Email:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${customer}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Reason:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${reason}</td></tr>
            </table>
            <p>Please review the request details in the Admin Returns dashboard to authorize or decline.</p>
          `
        );

        await this.enqueueNotification({
          idempotencyKey,
          eventType: 'return_requested',
          to,
          subject,
          html,
          templateName: 'staff_return_requested'
        });
      } catch (err) {
        logger.warn('Failed to enqueue return staff notification:', { error: err.message });
      }
    });
  }

  async sendReturnRequestedNow(returnData) {
    const to = await this.getStaffRecipients();
    const returnId = returnData.returnId || 'UNKNOWN';
    const orderNumber = returnData.orderNumber || returnData.orderId || 'UNKNOWN';
    const reason = returnData.reason || 'No reason provided';
    const customer = returnData.customerEmail || 'Customer';

    const subject = `[Action Required] New Return Request ${returnId} for Order #${orderNumber}`;
    const html = wrapBrandedTemplate(
      `New Return Request — ${returnId}`,
      `
        <p>A customer has submitted a return/exchange request.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Return ID:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${returnId}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Order Reference:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">#${orderNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Customer Email:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${customer}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Reason:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${reason}</td></tr>
        </table>
        <p>Please review the request details in the Admin Returns dashboard to authorize or decline.</p>
      `
    );

    return emailConfig.sendMail({ to, subject, html, templateName: 'staff_return_requested' });
  }

  // ==========================================
  // 4. LOW / OUT-OF-STOCK ALERT NOTIFICATION
  // ==========================================
  notifyLowStockAlert(stockData) {
    setImmediate(async () => {
      try {
        await this.sendLowStockAlertNow(stockData);
      } catch (err) {
        logger.warn('Failed to process low stock alert:', { error: err.message });
      }
    });
  }

  async sendLowStockAlertNow(stockData) {
    const sku = stockData.sku;
    if (!sku) return { skipped: true, reason: 'missing_sku' };

    const avail = typeof stockData.availableQuantity === 'number' ? stockData.availableQuantity : 0;
    const threshold = typeof stockData.lowStockThreshold === 'number' ? stockData.lowStockThreshold : 5;

    const db = getDb();

    // Check if stock is healthy
    if (avail > threshold) {
      this.lowStockAlertCache.delete(sku);
      if (db) {
        try {
          await db.collection('inventoryAlerts').doc(sku).set({
            sku,
            lastStockLevel: avail,
            lastAlertAt: null,
            isReplenished: true,
            updatedAt: new Date()
          }, { merge: true });
        } catch (_) {}
      }
      return { skipped: true, reason: 'stock_healthy' };
    }

    // Cross-instance and local deduplication
    const now = Date.now();
    const localCached = this.lowStockAlertCache.get(sku);
    if (localCached && (now - localCached.lastAlertAt < this.DEDUP_WINDOW_MS) && localCached.lastStockLevel === avail) {
      return { skipped: true, reason: 'deduplicated_recent_alert' };
    }

    if (db) {
      try {
        const alertRef = db.collection('inventoryAlerts').doc(sku);
        const alertSnap = await alertRef.get();
        if (alertSnap.exists) {
          const d = alertSnap.data();
          const lastTime = d.lastAlertAt ? (typeof d.lastAlertAt.toMillis === 'function' ? d.lastAlertAt.toMillis() : new Date(d.lastAlertAt).getTime()) : 0;
          if (now - lastTime < this.DEDUP_WINDOW_MS && d.lastStockLevel === avail) {
            return { skipped: true, reason: 'deduplicated_cross_instance' };
          }
        }

        await alertRef.set({
          sku,
          lastStockLevel: avail,
          lastAlertAt: new Date(),
          isReplenished: false,
          updatedAt: new Date()
        }, { merge: true });
      } catch (_) {}
    }

    // Update local cache
    this.lowStockAlertCache.set(sku, {
      lastAlertAt: now,
      lastStockLevel: avail
    });

    const to = await this.getStaffRecipients();
    const isOut = avail <= 0;
    const subject = isOut
      ? `[URGENT] Out of Stock Alert: ${sku} (${stockData.productName || 'Product'})`
      : `[Alert] Low Stock Warning: ${sku} (${avail} units remaining)`;

    const html = wrapBrandedTemplate(
      isOut ? 'Out of Stock Warning' : 'Low Stock Alert',
      `
        <p style="color: ${isOut ? '#dc2626' : '#d97706'}; font-weight: bold;">
          ${isOut ? 'CRITICAL: An inventory SKU has reached 0 units available.' : 'WARNING: An inventory SKU has reached low stock levels.'}
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">SKU:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${sku}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Product Name:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${stockData.productName || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Available Units:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${isOut ? '#dc2626' : '#b45309'};">${avail}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Active Reservations:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${stockData.reservedQuantity || 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Reorder Threshold:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${threshold}</td></tr>
        </table>
        <p>Please arrange replenishment with suppliers or update warehouse inventory.</p>
      `
    );

    return emailConfig.sendMail({ to, subject, html, templateName: 'staff_stock_alert' });
  }
}

const staffNotificationServiceInstance = new StaffNotificationService();
staffNotificationServiceInstance.StaffNotificationService = StaffNotificationService;
staffNotificationServiceInstance.staffNotificationService = staffNotificationServiceInstance;
staffNotificationServiceInstance.maskUtr = maskUtr;

module.exports = staffNotificationServiceInstance;
