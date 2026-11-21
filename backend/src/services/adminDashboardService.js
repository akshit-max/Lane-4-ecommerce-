const { getDb } = require('../config/firebaseAdmin');
const { formatINR } = require('../utils/currency');

function toTimestampMillis(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val < 1e11 ? val * 1000 : val;
  if (typeof val === 'object') {
    if (typeof val._seconds === 'number') return val._seconds * 1000 + (val._nanoseconds || 0) / 1e6;
    if (typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1e6;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.getTime === 'function') return val.getTime();
    if (val instanceof Date) return val.getTime();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

class AdminDashboardService {
  async getMetrics() {
    const db = getDb();
    if (!db) {
      return {
        totalOrders: 0,
        totalRevenuePaise: 0,
        totalRevenueFormatted: formatINR(0),
        pendingPaymentsCount: 0,
        pendingOrdersCount: 0,
        processingOrdersCount: 0,
        deliveredOrdersCount: 0,
        totalCustomers: 0,
        totalProducts: 0,
        lowStockCount: 0,
        recentOrders: [],
        recentPayments: []
      };
    }

    // 1. Orders & Revenue
    const ordersSnap = await db.collection('orders').get();
    const allOrders = ordersSnap.docs.map(d => ({ orderId: d.id, ...d.data() }));

    const totalOrders = allOrders.length;
    let totalRevenuePaise = 0;
    let pendingPaymentsCount = 0;
    let pendingOrdersCount = 0;
    let processingOrdersCount = 0;
    let deliveredOrdersCount = 0;

    for (const ord of allOrders) {
      if (ord.paymentStatus === 'verified') {
        totalRevenuePaise += (ord.pricing ? ord.pricing.finalPayablePaise : 0);
      }
      if (ord.paymentStatus === 'verification_pending') {
        pendingPaymentsCount++;
      }
      if (ord.status === 'pending_payment') {
        pendingOrdersCount++;
      } else if (['confirmed', 'processing'].includes(ord.status)) {
        processingOrdersCount++;
      } else if (ord.status === 'delivered') {
        deliveredOrdersCount++;
      }
    }

    // Sort recent orders
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentOrders = allOrders.slice(0, 5);

    // 2. Customers count
    const usersSnap = await db.collection('users').get();
    const totalCustomers = usersSnap.size;

    // 3. Products & Low Stock
    const productsSnap = await db.collection('products').where('isDeleted', '==', false).get();
    const totalProducts = productsSnap.size;

    const inventorySnap = await db.collection('inventory').get();
    const inventoryItems = inventorySnap.docs.map(d => d.data());
    const lowStockCount = inventoryItems.filter(it => it.availableQuantity <= (it.lowStockThreshold || 5)).length;

    // 4. Recent pending payments
    const paymentsSnap = await db.collection('payments').where('status', '==', 'verification_pending').get();
    const pendingPayments = paymentsSnap.docs.map(d => ({ paymentId: d.id, ...d.data() }));
    pendingPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentPayments = pendingPayments.slice(0, 5);

    return {
      totalOrders,
      totalRevenuePaise,
      totalRevenueFormatted: formatINR(totalRevenuePaise),
      pendingPaymentsCount,
      pendingOrdersCount,
      processingOrdersCount,
      deliveredOrdersCount,
      totalCustomers,
      totalProducts,
      lowStockCount,
      recentOrders,
      recentPayments
    };
  }

  async listActivityLogs(page = 1, limit = 50) {
    const db = getDb();
    if (!db) return [];

    const snap = await db.collection('adminActivityLogs').get();
    let logs = snap.docs.map(d => {
      const data = d.data();
      let ts = data.timestamp;
      if (ts && typeof ts === 'object') {
        if (typeof ts.toDate === 'function') ts = ts.toDate().toISOString();
        else if (typeof ts._seconds === 'number') ts = new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6).toISOString();
      } else if (ts instanceof Date) {
        ts = ts.toISOString();
      }
      return { ...data, timestamp: ts };
    });

    logs.sort((a, b) => toTimestampMillis(b.timestamp) - toTimestampMillis(a.timestamp));

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, parseInt(limit, 10) || 50);
    const start = (p - 1) * l;
    return logs.slice(start, start + l);
  }
}

module.exports = new AdminDashboardService();

