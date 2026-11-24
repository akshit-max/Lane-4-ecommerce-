/**
 * Production Data Reconciliation Script
 * Reconciles historical data anomalies for Bugs 2, 4, 7, 8, 11, 17, 28
 */

const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

async function runReconciliation() {
  const db = getDb();
  if (!db) {
    console.error('Firebase DB connection not available.');
    process.exit(1);
  }

  console.log('--- STARTING LANE4 PRODUCTION DATA RECONCILIATION ---');
  const now = new Date();

  // 1. RECONCILE ORDERS WITH TRACKING NOT MARKED SHIPPED (BUG 11)
  const trackingOrders = ['L4-26-9784', 'L4-26-7553'];
  for (const orderNum of trackingOrders) {
    const snap = await db.collection('orders').where('orderNumber', '==', orderNum).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      if (data.status !== 'shipped' || data.orderStatus !== 'shipped') {
        await doc.ref.update({
          status: 'shipped',
          orderStatus: 'shipped',
          updatedAt: now,
          reconciled: {
            reason: 'Migrated from confirmed to shipped as valid courier tracking is attached',
            reconciledAt: now
          }
        });
        console.log(`[BUG 11] Reconciled Order #${orderNum}: status set to "shipped"`);
      } else {
        console.log(`[BUG 11] Order #${orderNum} is already "shipped"`);
      }
    }
  }

  // 2. RECONCILE REJECTED PAYMENTS SHOWING WRONG ORDER STATUS (BUG 8)
  const rejectedOrders = ['L4-26-4959', 'L4-26-9084'];
  for (const orderNum of rejectedOrders) {
    const snap = await db.collection('orders').where('orderNumber', '==', orderNum).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      if (data.paymentStatus === 'rejected' && (data.status !== 'payment_rejected' || data.orderStatus !== 'payment_rejected')) {
        await doc.ref.update({
          status: 'payment_rejected',
          orderStatus: 'payment_rejected',
          updatedAt: now,
          reconciled: {
            reason: 'Synchronized orderStatus with rejected paymentStatus to block fulfillment',
            reconciledAt: now
          }
        });
        console.log(`[BUG 8] Reconciled Order #${orderNum}: status set to "payment_rejected"`);
      } else {
        console.log(`[BUG 8] Order #${orderNum} status is already consistent with paymentStatus`);
      }
    }
  }

  // 3. RECONCILE CANCELLED ORDER REFUND STATE (BUG 7)
  const cancelSnap = await db.collection('orders').where('orderNumber', '==', 'L4-26-1006').limit(1).get();
  if (!cancelSnap.empty) {
    const doc = cancelSnap.docs[0];
    const data = doc.data();
    if (data.status === 'cancelled') {
      const payablePaise = (data.pricing && data.pricing.finalPayablePaise) || 299800;
      await doc.ref.update({
        refundStatus: data.refundStatus || 'pending_refund',
        financialStatus: data.financialStatus || 'cancelled_refund_pending',
        refundDetails: data.refundDetails || {
          refundId: 'ref_L4-26-1006',
          originalAmountPaise: payablePaise,
          refundAmountPaise: payablePaise,
          status: 'pending_refund',
          initiatedAt: now,
          initiatedBy: 'system_reconciliation',
          reason: 'Customer requested order cancellation - refund pending processing'
        },
        updatedAt: now
      });
      console.log(`[BUG 7] Reconciled Order #L4-26-1006: structured refund tracking details attached`);
    }
  }

  // 4. RECONCILE UTR LEDGER FOR DUPLICATE UTR (BUG 4)
  const utr = '123456789123';
  const utrRef = db.collection('utrLedger').doc(utr);
  const utrDoc = await utrRef.get();
  if (!utrDoc.exists) {
    await utrRef.set({
      utr,
      orderNumber: 'L4-26-1001',
      orderId: 'L4-26-1001',
      verifiedAt: now,
      verifiedByUid: 'admin_reconciliation',
      verifiedByName: 'System Audit'
    });
    console.log(`[BUG 4] Reconciled UTR ${utr}: locked to authorized verified Order #L4-26-1001`);
  } else {
    console.log(`[BUG 4] UTR ${utr} ledger already exists`);
  }

  // 5. AUDIT AND FLAG HISTORICAL OVERCHARGED ORDER #L4-26-1507 (BUG 2)
  const overchargeSnap = await db.collection('orders').where('orderNumber', '==', 'L4-26-1507').limit(1).get();
  if (!overchargeSnap.empty) {
    const doc = overchargeSnap.docs[0];
    const data = doc.data();
    await doc.ref.update({
      financialAdjustmentAudit: {
        chargedPaise: 480000,
        expectedPaise: 451000,
        overchargePaise: 29000,
        overchargeFormatted: '₹290.00',
        adjustmentStatus: 'refund_recommended',
        flaggedAt: now,
        reason: 'Customer charged regular unit price instead of discounted promotional sale price'
      },
      updatedAt: now
    });
    console.log(`[BUG 2] Flagged Order #L4-26-1507 for financial reconciliation (₹290.00 overcharge refund owed)`);
  }

  // 6. UNPUBLISH TEST PRODUCT 'TEST C' (BUG 17)
  const testProductSnap = await db.collection('products').where('sku', '==', 'L4-TEST').get();
  testProductSnap.forEach(async (doc) => {
    await doc.ref.update({
      isPublished: false,
      status: 'draft',
      updatedAt: now
    });
    console.log(`[BUG 17] Unshared/Unpublished test product "${doc.data().name}" (SKU: ${doc.data().sku})`);
  });

  // 7. FIX PRO KICKBOARD BROKEN IMAGE (BUG 28)
  const kickboardSnap = await db.collection('products').where('slug', '==', 'pro-kickboard-hydro-flow').get();
  kickboardSnap.forEach(async (doc) => {
    const images = [
      {
        url: '6424266ea05809dff501d86e/lane4-X8RgOcqugtQ-640x960.jpg',
        alt: 'Pro Kickboard Hydro Flow',
        isPrimary: true,
        order: 0
      },
      {
        url: '6424266ea05809dff501d86e/lane4-fCM6ZvTgD9A-1080x1080.jpg',
        alt: 'Pro Kickboard Sprint Training',
        isPrimary: false,
        order: 1
      }
    ];
    await doc.ref.update({
      images,
      updatedAt: now
    });
    console.log(`[BUG 28] Replaced broken Cloudinary image for Pro Kickboard Hydro Flow with verified local asset`);
  });

  console.log('--- RECONCILIATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runReconciliation().catch(err => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
