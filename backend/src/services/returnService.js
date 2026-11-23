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
      throw new Error('Unauthorized return request.');
    }

    const docRef = db.collection('returns').doc();
    const returnId = `L4-RET-${Math.floor(1000 + Math.random() * 9000)}`;

    const returnRecord = {
      returnId,
      docId: docRef.id,
      orderId: actualOrderId,
      orderNumber: orderData.orderNumber || orderId,
      customerId: customer ? customer.uid : null,
      customerEmail: orderData.customerEmail,
      items: items || orderData.items || [],
      reason: reason.trim(),
      customerUpiId: upiIdForRefund.trim(),
      status: 'requested',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await docRef.set(returnRecord);

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
    return snap.docs.map(d => d.data());
  }

  async updateReturnStatus(docId, { status, adminNotes }, adminUser) {
    const db = getDb();
    const docRef = db.collection('returns').doc(docId);
    const updates = {
      status,
      adminNotes: adminNotes || '',
      updatedAt: new Date()
    };
    await docRef.update(updates);
    return { docId, ...updates };
  }
}

module.exports = new ReturnService();

