const { getDb } = require('../config/firebaseAdmin');

class ReturnService {
  async submitReturn({ orderId, items, reason, upiIdForRefund }, customer) {
    const db = getDb();
    if (!orderId || !reason || !upiIdForRefund) {
      throw new Error('Order ID, return reason, and UPI ID for refund are required.');
    }

    let orderDoc = await db.collection('orders').doc(orderId).get();
    let orderData = orderDoc.exists ? orderDoc.data() : null;
    let actualOrderId = orderId;
    if (!orderData) {
      const snap = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get();
      if (!snap.empty) {
        orderDoc = snap.docs[0];
        orderData = orderDoc.data();
        actualOrderId = orderDoc.id;
      }
    }
    if (!orderData) throw new Error('Order not found');

    if (customer && orderData.customerId && orderData.customerId !== customer.uid) {
      const emailMatches = Boolean(
        customer.email &&
        orderData.customerEmail &&
        customer.email.toLowerCase().trim() === orderData.customerEmail.toLowerCase().trim()
      );
      if (!emailMatches) {
        throw new Error('Unauthorized return request.');
      }
    }

    const docRef = db.collection('returns').doc();
    const returnId = `L4-RET-${Math.floor(1000 + Math.random() * 9000)}`;

    const returnRecord = {
      returnId,
      docId: docRef.id,
      orderId: actualOrderId,
      orderNumber: orderData.orderNumber || orderId,
      customerId: customer ? customer.uid : (orderData.customerId || null),
      customerEmail: orderData.customerEmail,
      items: items || orderData.items || [],
      reason: reason.trim(),
      customerUpiId: upiIdForRefund.trim(),
      status: 'requested',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await docRef.set(returnRecord);

    try {
      await db.collection('orders').doc(actualOrderId).update({
        returnRequested: true,
        returnId,
        returnStatus: 'requested',
        updatedAt: new Date()
      });
    } catch (_) {}

    await db.collection('notifications').add({
      type: 'return_requested',
      title: 'New Return Request',
      message: `Return request ${returnId} for order ${orderData.orderNumber || orderId}`,
      referenceId: returnId,
      isRead: false,
      createdAt: new Date()
    });

    return returnRecord;
  }

  async getMyReturns(customerId) {
    const db = getDb();
    const snap = await db.collection('returns').where('customerId', '==', customerId).get();
    return snap.docs.map(d => d.data());
  }

  async listAdminReturns(filters = {}) {
    const db = getDb();
    let query = db.collection('returns');
    if (filters.status) query = query.where('status', '==', filters.status);

    const snap = await query.get();
    const list = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
      const tb = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    return list;
  }

  async updateReturnStatus(docId, { status, adminNotes, refundReference }, adminUser) {
    const db = getDb();
    const docRef = db.collection('returns').doc(docId);
    const returnSnap = await docRef.get();
    if (!returnSnap.exists) {
      throw new Error('Return request not found');
    }
    const returnData = returnSnap.data();
    const now = new Date();

    const updates = {
      status,
      adminNotes: adminNotes || returnData.adminNotes || '',
      updatedAt: now
    };

    if (refundReference) {
      updates.refundReference = refundReference;
    }

    await docRef.update(updates);

    // Synchronize with associated order in orders collection
    const orderId = returnData.orderId;
    if (orderId) {
      try {
        let orderRef = db.collection('orders').doc(orderId);
        let orderDoc = await orderRef.get();
        if (!orderDoc.exists && returnData.orderNumber) {
          const snap = await db.collection('orders').where('orderNumber', '==', returnData.orderNumber).limit(1).get();
          if (!snap.empty) {
            orderDoc = snap.docs[0];
            orderRef = orderDoc.ref;
          }
        }

        if (orderDoc.exists) {
          const orderData = orderDoc.data();
          const orderUpdates = { updatedAt: now };

          if (status === 'approved') {
            orderUpdates.status = 'returned';
            orderUpdates.orderStatus = 'returned';
            orderUpdates.refundStatus = 'pending_refund';
            orderUpdates.financialStatus = 'returned_refund_pending';
            orderUpdates.refundDetails = {
              refundId: returnData.returnId,
              originalAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
              refundAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
              status: 'pending_refund',
              initiatedAt: now,
              initiatedBy: (adminUser && (adminUser.email || adminUser.uid)) || 'admin',
              customerUpiId: returnData.customerUpiId || '',
              reason: returnData.reason || 'Return approved'
            };
          } else if (status === 'refunded') {
            orderUpdates.status = 'refunded';
            orderUpdates.orderStatus = 'refunded';
            orderUpdates.refundStatus = 'refunded';
            orderUpdates.financialStatus = 'refunded';
            orderUpdates.refundDetails = {
              ...(orderData.refundDetails || {}),
              refundId: returnData.returnId,
              refundReference: refundReference || adminNotes || 'UPI-REFUND',
              refundMethod: 'UPI',
              upiId: returnData.customerUpiId || '',
              amountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
              status: 'refunded',
              completedAt: now,
              completedBy: (adminUser && (adminUser.email || adminUser.uid)) || 'admin',
              notes: adminNotes || 'Refund processed to customer UPI'
            };
          } else if (status === 'rejected') {
            orderUpdates.returnStatus = 'rejected';
            orderUpdates.returnRequested = false;
          }

          await orderRef.update(orderUpdates);
        }
      } catch (err) {
        console.error('Error syncing return update to order:', err);
      }
    }

    return { docId, ...updates, orderId };
  }
}

module.exports = new ReturnService();

