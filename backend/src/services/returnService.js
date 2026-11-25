const { getDb } = require('../config/firebaseAdmin');
const { staffNotificationService } = require('./staffNotificationService');

class ReturnService {
  async submitReturn({ orderId, items, reason, upiIdForRefund, orderAccessToken = '' }, customer = null) {
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

    if (!customer && !orderAccessToken) {
      const err = new Error('Authentication required to submit a return request.');
      err.statusCode = 401;
      throw err;
    }

    const { ADMIN_ROLES } = require('../constants/roles');
    const isAdmin = customer && customer.role && ADMIN_ROLES.includes(customer.role);

    if (!isAdmin) {
      // 1. Registered Customer Orders: strictly enforce customer.uid match
      if (orderData.customerId) {
        if (!customer || !customer.uid || customer.uid !== orderData.customerId) {
          const err = new Error('Unauthorized return request: You can only request returns for your own registered orders.');
          err.statusCode = 403;
          throw err;
        }
      } else {
        // 2. Guest Orders: require verified email or cryptographic orderAccessToken
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
          const err = new Error('Unauthorized return request: For guest orders, a verified email account or valid order verification token is required.');
          err.statusCode = 403;
          throw err;
        }
      }
    }

    const orderDocRef = db.collection('orders').doc(actualOrderId);
    const docRef = db.collection('returns').doc();
    const returnId = `L4-RET-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    let returnRecord;

    // Atomic eligibility validation & return creation transaction
    await db.runTransaction(async (transaction) => {
      const freshOrderDoc = await transaction.get(orderDocRef);
      if (!freshOrderDoc.exists) throw new Error('Order not found');
      const freshOrderData = freshOrderDoc.data();

      // Guard against duplicate active return requests
      if (
        freshOrderData.returnRequested === true ||
        freshOrderData.returnStatus === 'requested' ||
        freshOrderData.returnStatus === 'approved' ||
        freshOrderData.status === 'returned' ||
        freshOrderData.status === 'refunded'
      ) {
        const err = new Error(`A return request has already been submitted for order #${freshOrderData.orderNumber || actualOrderId}.`);
        err.statusCode = 400;
        err.code = 'RETURN_ALREADY_REQUESTED';
        throw err;
      }

      // Guard against returning orders in cancelled status
      const currentStatus = freshOrderData.status || freshOrderData.orderStatus;
      if (currentStatus === 'cancelled') {
        const err = new Error(`Cannot request a return for order in "cancelled" status.`);
        err.statusCode = 400;
        err.code = 'INVALID_RETURN_ORDER_STATUS';
        throw err;
      }

      returnRecord = {
        returnId,
        docId: docRef.id,
        orderId: actualOrderId,
        orderNumber: freshOrderData.orderNumber || orderId,
        customerId: customer ? customer.uid : (freshOrderData.customerId || null),
        customerEmail: freshOrderData.customerEmail,
        items: items || freshOrderData.items || [],
        reason: reason.trim(),
        customerUpiId: upiIdForRefund.trim(),
        status: 'requested',
        createdAt: now,
        updatedAt: now
      };

      transaction.set(docRef, returnRecord);
      transaction.update(orderDocRef, {
        returnRequested: true,
        returnId,
        returnStatus: 'requested',
        updatedAt: now
      });
    });

    await db.collection('notifications').add({
      type: 'return_requested',
      title: 'New Return Request',
      message: `Return request ${returnId} for order ${orderData.orderNumber || orderId}`,
      referenceId: returnId,
      isRead: false,
      createdAt: now
    });

    // Notify staff of return request (non-blocking async)
    staffNotificationService.notifyReturnRequested({
      returnId: returnRecord.returnId,
      orderId: returnRecord.orderId,
      orderNumber: returnRecord.orderNumber,
      customerEmail: returnRecord.customerEmail,
      reason: returnRecord.reason,
      items: returnRecord.items
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

  async updateReturnStatus(docId, { status, adminNotes, refundReference, restock = true, itemsReceived = false, inspectionStatus = null }, adminUser) {
    const db = getDb();
    const docRef = db.collection('returns').doc(docId);
    const returnSnap = await docRef.get();
    if (!returnSnap.exists) {
      throw new Error('Return request not found');
    }
    const returnData = returnSnap.data();
    const now = new Date();
    const adminIdentity = (adminUser && (adminUser.email || adminUser.uid)) || 'system';

    const updates = {
      status,
      adminNotes: adminNotes || returnData.adminNotes || '',
      updatedAt: now
    };

    if (refundReference) {
      updates.refundReference = refundReference;
    }

    // Persist explicit restock restriction if admin disallows restocking
    if (restock === false) {
      updates.restockRestricted = true;
    }

    // Record lifecycle milestone timestamps & staff identities
    if (status === 'authorized' || status === 'approved') {
      updates.authorizedAt = returnData.authorizedAt || now;
      updates.authorizedBy = returnData.authorizedBy || adminIdentity;
    }

    if (status === 'received' || itemsReceived === true) {
      updates.itemsReceived = true;
      updates.receivedAt = returnData.receivedAt || now;
      updates.receivedBy = returnData.receivedBy || adminIdentity;
    }

    if (status === 'accepted' || inspectionStatus === 'passed') {
      updates.itemsReceived = true;
      updates.receivedAt = returnData.receivedAt || now;
      updates.receivedBy = returnData.receivedBy || adminIdentity;
      updates.inspectionStatus = 'passed';
      updates.inspectedAt = returnData.inspectedAt || now;
      updates.inspectedBy = returnData.inspectedBy || adminIdentity;
    } else if (status === 'rejected' || inspectionStatus === 'failed') {
      updates.inspectionStatus = 'failed';
      updates.inspectedAt = returnData.inspectedAt || now;
      updates.inspectedBy = returnData.inspectedBy || adminIdentity;
    }

    // Resolve associated order in orders collection
    const orderId = returnData.orderId;
    let orderDoc = null;
    let orderRef = null;
    let orderData = null;

    if (orderId) {
      try {
        orderRef = db.collection('orders').doc(orderId);
        let snap = await orderRef.get();
        if (!snap.exists && returnData.orderNumber) {
          const numSnap = await db.collection('orders').where('orderNumber', '==', returnData.orderNumber).limit(1).get();
          if (!numSnap.empty) {
            snap = numSnap.docs[0];
            orderRef = snap.ref;
          }
        }
        if (snap.exists) {
          orderDoc = snap;
          orderData = snap.data();
        }
      } catch (err) {
        console.error('Error fetching associated order for return:', err);
      }
    }

    // Restocking eligibility rules:
    // 1. Authorization alone (status === 'authorized' or 'requested') NEVER restores stock.
    // 2. Physical receipt alone (status === 'received') NEVER restores stock.
    // 3. Rejection (status === 'rejected') NEVER restores stock.
    // 4. Restocking occurs ONLY upon explicit acceptance ('accepted' or 'approved' with inspection passed)
    //    and NEVER if restockRestricted is true.
    // 5. Refund completion ('refunded') does NOT independently trigger restocking.
    const isRestockRestricted = updates.restockRestricted === true || returnData.restockRestricted === true || restock === false;
    const isAccepted = status === 'accepted' || (status === 'approved' && !isRestockRestricted);
    const hasPhysicalReceipt = updates.itemsReceived === true || returnData.itemsReceived === true || isAccepted;
    const hasInspectionPassed = updates.inspectionStatus === 'passed' || returnData.inspectionStatus === 'passed' || isAccepted;

    const shouldRestock = isAccepted && hasPhysicalReceipt && hasInspectionPassed && !isRestockRestricted;
    const alreadyRestocked = returnData.stockRestored === true || (orderData && (orderData.returnStockRestored === true || orderData.stockRestored === true));

    if (shouldRestock && !alreadyRestocked) {
      const itemsToRestock = (Array.isArray(returnData.items) && returnData.items.length > 0)
        ? returnData.items
        : (orderData && Array.isArray(orderData.items) ? orderData.items : []);

      for (const item of itemsToRestock) {
        const sku = item.sku;
        const qty = parseInt(item.quantity, 10) || 1;
        if (!sku) continue;

        try {
          // 1. Authoritative inventory document
          const invRef = db.collection('inventory').doc(sku);
          const invDoc = await invRef.get();
          if (invDoc.exists) {
            const inv = invDoc.data();
            const currentAvailable = typeof inv.availableQuantity === 'number' ? inv.availableQuantity : 0;
            const newAvailable = currentAvailable + qty;

            await invRef.update({
              availableQuantity: newAvailable,
              isOutOfStock: newAvailable <= 0,
              updatedAt: now
            });

            // Append restocking ledger entry
            await invRef.collection('ledger').add({
              type: 'return_restock',
              quantityChanged: qty,
              previousQuantity: currentAvailable,
              newBalance: newAvailable,
              reservedQuantity: inv.reservedQuantity || 0,
              returnId: returnData.returnId || docId,
              orderId: returnData.orderId || (orderDoc && orderDoc.id) || '',
              orderNumber: returnData.orderNumber || (orderData && orderData.orderNumber) || '',
              reason: 'Return approved and restocked',
              adjustedByUid: adminIdentity,
              timestamp: now
            });
          }

          // 2. Synchronize physical stock to products collection (currentPhysical + qty)
          let pDoc = null;
          if (item.productId) {
            const pSnap = await db.collection('products').doc(item.productId).get();
            if (pSnap.exists) pDoc = pSnap;
          }
          if (!pDoc && item.slug) {
            const pSnap = await db.collection('products').where('slug', '==', item.slug).limit(1).get();
            if (!pSnap.empty) pDoc = pSnap.docs[0];
          }
          if (!pDoc) {
            const allProductsSnap = await db.collection('products').get();
            for (const d of allProductsSnap.docs) {
              const pd = d.data();
              if (pd.sku === sku || (Array.isArray(pd.variants) && pd.variants.some(v => v.sku === sku))) {
                pDoc = d;
                break;
              }
            }
          }

          if (pDoc) {
            const pData = pDoc.data();
            let matched = false;
            let updatedVariants = [];
            if (Array.isArray(pData.variants) && pData.variants.length > 0) {
              updatedVariants = pData.variants.map(v => {
                if (v.sku === sku || (item.variantId && v.variantId === item.variantId)) {
                  matched = true;
                  const currentVStock = typeof v.stockQuantity === 'number'
                    ? v.stockQuantity
                    : ((invDoc.exists && invDoc.data().availableQuantity) || 0);
                  return { ...v, stockQuantity: currentVStock + qty };
                }
                return v;
              });
            }

            const newTotalStock = matched
              ? updatedVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0)
              : ((typeof pData.stockQuantity === 'number' ? pData.stockQuantity : 0) + qty);

            const pUpdates = {
              stockQuantity: newTotalStock,
              updatedAt: now
            };
            if (matched) {
              pUpdates.variants = updatedVariants;
            } else if (Array.isArray(pData.variants) && pData.variants.length > 0) {
              pUpdates.variants = pData.variants.map((v, i) => i === 0 ? { ...v, stockQuantity: newTotalStock } : v);
            }
            await pDoc.ref.update(pUpdates);
          }
        } catch (restockErr) {
          console.error(`Error restocking SKU ${sku} on return approval:`, restockErr);
        }
      }

      updates.stockRestored = true;
      updates.stockRestoredAt = now;
    }

    await docRef.update(updates);

    // Synchronize with associated order in orders collection
    if (orderRef && orderDoc && orderDoc.exists) {
      try {
        const orderUpdates = { updatedAt: now };

        if (updates.stockRestored) {
          orderUpdates.returnStockRestored = true;
          orderUpdates.returnStockRestoredAt = now;
        }

        if (status === 'authorized') {
          orderUpdates.returnStatus = 'authorized';
        } else if (status === 'received') {
          orderUpdates.returnStatus = 'received';
          orderUpdates.financialStatus = 'returned_inspection_pending';
        } else if (status === 'accepted' || status === 'approved') {
          orderUpdates.status = 'returned';
          orderUpdates.orderStatus = 'returned';
          orderUpdates.returnStatus = status;
          orderUpdates.refundStatus = 'pending_refund';
          orderUpdates.financialStatus = 'returned_refund_pending';
          orderUpdates.refundDetails = {
            refundId: returnData.returnId,
            originalAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
            refundAmountPaise: (orderData.pricing && orderData.pricing.finalPayablePaise) || 0,
            status: 'pending_refund',
            initiatedAt: now,
            initiatedBy: adminIdentity,
            customerUpiId: returnData.customerUpiId || '',
            reason: returnData.reason || 'Return approved'
          };
        } else if (status === 'refunded') {
          orderUpdates.status = 'refunded';
          orderUpdates.orderStatus = 'refunded';
          orderUpdates.returnStatus = 'refunded';
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
            completedBy: adminIdentity,
            notes: adminNotes || 'Refund processed to customer UPI'
          };
        } else if (status === 'rejected') {
          orderUpdates.returnStatus = 'rejected';
          orderUpdates.returnRequested = false;
        }

        await orderRef.update(orderUpdates);
      } catch (err) {
        console.error('Error syncing return update to order:', err);
      }
    }

    // Customer / Admin Notifications
    try {
      if (status === 'approved') {
        await db.collection('notifications').add({
          type: 'return_approved',
          title: 'Return Request Approved',
          message: `Return request ${returnData.returnId || docId} for order ${returnData.orderNumber || orderId} has been approved.`,
          referenceId: returnData.returnId || docId,
          isRead: false,
          createdAt: now
        });
      } else if (status === 'rejected') {
        await db.collection('notifications').add({
          type: 'return_rejected',
          title: 'Return Request Rejected',
          message: `Return request ${returnData.returnId || docId} for order ${returnData.orderNumber || orderId} was rejected. Reason: ${adminNotes || 'Does not meet return criteria.'}`,
          referenceId: returnData.returnId || docId,
          isRead: false,
          createdAt: now
        });
      }
    } catch (_) {}

    // Admin Activity Log
    if (adminUser) {
      try {
        await db.collection('adminActivityLogs').add({
          adminUid: adminUser.uid,
          adminEmail: adminUser.email,
          action: 'return_status_updated',
          resourceType: 'returns',
          resourceId: docId,
          details: {
            returnId: returnData.returnId,
            orderId,
            previousStatus: returnData.status,
            newStatus: status,
            stockRestored: updates.stockRestored || false,
            adminNotes,
            refundReference
          },
          timestamp: now
        });
      } catch (_) {}
    }

    return { docId, ...updates, orderId };
  }
}

module.exports = new ReturnService();

