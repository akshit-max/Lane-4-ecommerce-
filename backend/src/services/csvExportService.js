const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

/**
 * Neutralize CSV Formula Injection (CWE-1236 / OWASP)
 * If a cell value starts with '=', '+', '-', '@', '\t', or '\r',
 * it is prepended with a single quote "'" to force spreadsheet software
 * (Excel, Google Sheets, LibreOffice) to treat it as plain text.
 * Values containing quotes, commas, or newlines are quoted and escaped per RFC 4180.
 */
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // Prepend single quote if first character is a formula trigger
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // RFC 4180 CSV escaping for quotes, commas, and linebreaks
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a row of values into a sanitized CSV line
 */
function toCsvRow(values) {
  return values.map(sanitizeCsvValue).join(',') + '\r\n';
}

/**
 * Format timestamp into standard readable ISO-like timestamp (YYYY-MM-DD HH:mm:ss UTC)
 */
function formatCsvDate(ts) {
  if (!ts) return '';
  try {
    let d;
    if (typeof ts.toDate === 'function') d = ts.toDate();
    else if (typeof ts._seconds === 'number') d = new Date(ts._seconds * 1000);
    else if (typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
    else if (ts instanceof Date) d = ts;
    else d = new Date(ts);
    if (!d || isNaN(d.getTime())) return String(ts);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch (_) {
    return String(ts);
  }
}

/**
 * Format monetary amount strictly as plain numeric INR decimal (e.g. "2499.00")
 * so Excel/Sheets never suffers currency symbol mojibake and can sum columns natively.
 */
function formatPlainInr(paiseVal, fallbackFormatted) {
  if (typeof paiseVal === 'number' && Number.isFinite(paiseVal)) {
    return (paiseVal / 100).toFixed(2);
  }
  if (fallbackFormatted !== undefined && fallbackFormatted !== null && fallbackFormatted !== '') {
    const cleaned = String(fallbackFormatted).replace(/[^0-9.-]/g, '');
    if (cleaned && !isNaN(Number(cleaned))) {
      return Number(cleaned).toFixed(2);
    }
  }
  return '0.00';
}

/**
 * Normalize Indian phone numbers to clean 10 digits for CSV consistency
 */
function normalizeCsvPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[=@\t\r]/.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return s;
}

const BATCH_SIZE = 250;

class CsvExportService {
  /**
   * Export Orders as a genuine streaming CSV with cursor-based pagination
   */
  async exportOrders(res, filters = {}) {
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableFinished) {
        clientDisconnected = true;
        logger.info('Orders CSV export stream aborted by client disconnect');
      }
    });

    try {
      const db = getDb();
      if (!db) throw new Error('Database unavailable');

      const filename = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      if (res.flushHeaders) res.flushHeaders();

      // Lookup UTRs from payments collection so UTR column is populated accurately
      const utrByOrderId = new Map();
      try {
        const paySnap = await db.collection('payments').get();
        for (const pDoc of paySnap.docs) {
          const pData = pDoc.data() || {};
          if (pData.orderId && pData.upiReferenceNumber) {
            utrByOrderId.set(pData.orderId, pData.upiReferenceNumber);
          }
        }
      } catch (_) {}

      // CSV Headers
      const headers = [
        'Order ID',
        'Order Number',
        'Date Placed',
        'Customer Email',
        'Customer Name',
        'Customer Phone',
        'Order Status',
        'Payment Status',
        'Payment Method',
        'Items Subtotal (INR)',
        'Shipping Charges (INR)',
        'Discount (INR)',
        'Total Payable (INR)',
        'Total Items Count',
        'Shipping Addressee',
        'Shipping City',
        'Shipping State',
        'Postal Code',
        'Tracking Carrier',
        'Tracking Number',
        'UTR / Ref Number'
      ];

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.write('\uFEFF' + toCsvRow(headers));
      }

      // Cursor-based bounded pagination
      let baseQuery = db.collection('orders');
      if (filters.status) {
        baseQuery = baseQuery.where('status', '==', filters.status);
      }
      if (filters.paymentStatus) {
        baseQuery = baseQuery.where('paymentStatus', '==', filters.paymentStatus);
      }

      let lastDoc = null;
      let hasMore = true;

      while (hasMore) {
        if (clientDisconnected || res.writableEnded || res.destroyed) break;

        let batchQuery = baseQuery.limit(BATCH_SIZE);
        if (lastDoc) {
          batchQuery = batchQuery.startAfter(lastDoc);
        }

        const snap = await batchQuery.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
          if (clientDisconnected || res.writableEnded || res.destroyed) break;

          const ord = doc.data();
          const ordId = ord.orderId || doc.id || '';
          const pricing = ord.pricing || {};
          const ship = ord.shippingAddress || {};
          const tracking = ord.tracking || ord.fulfillment || {};
          const items = ord.items || [];
          const totalItemsCount = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);

          const computedItemsPaise = items.reduce((sum, it) => {
            const qty = parseInt(it.quantity, 10) || 1;
            const linePaise = it.totalPricePaise ?? it.lineTotalPaise ?? ((it.unitPricePaise ?? it.pricePaise ?? 0) * qty);
            return sum + (Number(linePaise) || 0);
          }, 0);

          const itemsSubtotalPaise = pricing.subtotalPaise ?? pricing.itemsSubtotalPaise ?? pricing.itemsTotalPaise ?? computedItemsPaise;
          const shippingPaise = pricing.shippingChargesPaise ?? pricing.shippingPaise ?? pricing.shippingFeePaise ?? 0;
          const discountPaise = pricing.couponDiscountPaise ?? pricing.discountPaise ?? 0;
          const finalPayablePaise = pricing.finalPayablePaise ?? pricing.totalPaise ?? (itemsSubtotalPaise + shippingPaise - discountPaise);

          const rawPhone = ship.phone || ord.customerPhone || '';
          const utrVal = ord.paymentDetails?.utr || ord.upiReferenceNumber || utrByOrderId.get(ordId) || '';

          const row = [
            ordId,
            ord.orderNumber || '',
            formatCsvDate(ord.createdAt),
            ord.customerEmail || '',
            ship.addressee || ord.customerName || '',
            normalizeCsvPhone(rawPhone),
            ord.status || ord.orderStatus || '',
            ord.paymentStatus || '',
            ord.paymentMethod || 'UPI_QR',
            formatPlainInr(itemsSubtotalPaise, pricing.subtotalFormatted || pricing.itemsSubtotalFormatted),
            formatPlainInr(shippingPaise, pricing.shippingChargesFormatted),
            formatPlainInr(discountPaise, pricing.couponDiscountFormatted),
            formatPlainInr(finalPayablePaise, pricing.finalPayableFormatted),
            totalItemsCount,
            ship.addressee || '',
            ship.city || '',
            ship.state || '',
            ship.postalCode || '',
            tracking.courierName || tracking.carrier || '',
            tracking.trackingNumber || '',
            utrVal
          ];

          res.write(toCsvRow(row));
        }

        if (snap.docs.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    } catch (err) {
      logger.error('Error streaming orders CSV export', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Failed to export orders CSV' } });
      } else if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }

  /**
   * Export Inventory catalog as a genuine streaming CSV with cursor-based pagination
   */
  async exportInventory(res, filters = {}) {
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableFinished) {
        clientDisconnected = true;
        logger.info('Inventory CSV export stream aborted by client disconnect');
      }
    });

    try {
      const db = getDb();
      if (!db) throw new Error('Database unavailable');

      const filename = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      if (res.flushHeaders) res.flushHeaders();

      // Lookup variant prices from products collection so Price (INR) is populated accurately
      const priceBySku = new Map();
      try {
        const prodSnap = await db.collection('products').get();
        for (const pDoc of prodSnap.docs) {
          const pData = pDoc.data() || {};
          const fallbackPrice = pData.salePricePaise || pData.regularPricePaise || 0;
          for (const v of (pData.variants || [])) {
            if (v && v.sku) {
              priceBySku.set(v.sku, v.salePricePaise || v.regularPricePaise || v.pricePaise || fallbackPrice);
            }
          }
        }
      } catch (_) {}

      // CSV Headers
      const headers = [
        'SKU',
        'Product ID',
        'Product Name',
        'Variant / Size',
        'Available Stock',
        'Reserved Stock',
        'Physical Stock',
        'Low Stock Threshold',
        'Stock Status',
        'Price (INR)',
        'Last Updated'
      ];

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.write('\uFEFF' + toCsvRow(headers));
      }

      let baseQuery = db.collection('inventory');
      let lastDoc = null;
      let hasMore = true;

      while (hasMore) {
        if (clientDisconnected || res.writableEnded || res.destroyed) break;

        let batchQuery = baseQuery.limit(BATCH_SIZE);
        if (lastDoc) {
          batchQuery = batchQuery.startAfter(lastDoc);
        }

        const snap = await batchQuery.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
          if (clientDisconnected || res.writableEnded || res.destroyed) break;

          const item = doc.data();

          // Filtering
          if (filters.lowStockOnly === true || filters.lowStockOnly === 'true') {
            if (item.availableQuantity > (item.lowStockThreshold || 5)) continue;
          }
          if (filters.outOfStockOnly === true || filters.outOfStockOnly === 'true') {
            if (item.availableQuantity > 0) continue;
          }
          if (filters.search) {
            const s = filters.search.toLowerCase().trim();
            const skuMatch = item.sku && item.sku.toLowerCase().includes(s);
            const nameMatch = (item.productName || item.title || '').toLowerCase().includes(s);
            if (!skuMatch && !nameMatch) continue;
          }

          const avail = typeof item.availableQuantity === 'number' ? item.availableQuantity : 0;
          const resv = typeof item.reservedQuantity === 'number' ? item.reservedQuantity : 0;
          const physical = avail + resv;
          const threshold = typeof item.lowStockThreshold === 'number' ? item.lowStockThreshold : 5;

          let status = 'IN_STOCK';
          if (avail <= 0) {
            status = 'OUT_OF_STOCK';
          } else if (avail <= threshold) {
            status = 'LOW_STOCK';
          }

          const skuKey = item.sku || doc.id || '';
          const effectivePricePaise = item.pricePaise ?? priceBySku.get(skuKey);

          const row = [
            skuKey,
            item.productId || '',
            item.productName || item.title || '',
            item.variantLabel || item.variant || item.size || 'Default',
            avail,
            resv,
            physical,
            threshold,
            status,
            formatPlainInr(effectivePricePaise, item.priceFormatted || item.price),
            formatCsvDate(item.updatedAt || item.createdAt)
          ];

          res.write(toCsvRow(row));
        }

        if (snap.docs.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    } catch (err) {
      logger.error('Error streaming inventory CSV export', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Failed to export inventory CSV' } });
      } else if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }

  /**
   * Export Customers as a genuine streaming CSV with cursor-based pagination
   * Strictly filters out administrative accounts and strips sensitive credentials
   */
  async exportCustomers(res, filters = {}) {
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableFinished) {
        clientDisconnected = true;
        logger.info('Customers CSV export stream aborted by client disconnect');
      }
    });

    try {
      const db = getDb();
      if (!db) throw new Error('Database unavailable');

      const filename = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      if (res.flushHeaders) res.flushHeaders();

      // Aggregate real order counts & spend per customer
      const orderStatsByUid = new Map();
      const orderStatsByEmail = new Map();
      try {
        const ordSnap = await db.collection('orders').get();
        for (const oDoc of ordSnap.docs) {
          const o = oDoc.data() || {};
          const st = (o.status || o.orderStatus || '').toLowerCase();
          if (st === 'cancelled') continue;
          const spendPaise = Number(o.pricing?.finalPayablePaise ?? o.pricing?.totalPaise ?? 0) || 0;
          if (o.customerId) {
            const cur = orderStatsByUid.get(o.customerId) || { count: 0, spendPaise: 0 };
            cur.count += 1;
            cur.spendPaise += spendPaise;
            orderStatsByUid.set(o.customerId, cur);
          }
          const em = (o.customerEmail || '').toLowerCase().trim();
          if (em) {
            const cur = orderStatsByEmail.get(em) || { count: 0, spendPaise: 0 };
            cur.count += 1;
            cur.spendPaise += spendPaise;
            orderStatsByEmail.set(em, cur);
          }
        }
      } catch (_) {}

      // CSV Headers — Sensitive credentials (passwords, tokens, secrets) EXCLUDED
      const headers = [
        'Customer ID',
        'Customer Name',
        'Email Address',
        'Phone Number',
        'Account Role',
        'Total Orders',
        'Total Spend (INR)',
        'Registered Date',
        'Last Login Date',
        'Status'
      ];

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.write('\uFEFF' + toCsvRow(headers));
      }

      let baseQuery = db.collection('users');
      let lastDoc = null;
      let hasMore = true;

      while (hasMore) {
        if (clientDisconnected || res.writableEnded || res.destroyed) break;

        let batchQuery = baseQuery.limit(BATCH_SIZE);
        if (lastDoc) {
          batchQuery = batchQuery.startAfter(lastDoc);
        }

        const snap = await batchQuery.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
          if (clientDisconnected || res.writableEnded || res.destroyed) break;

          const u = doc.data();
          const email = (u.email || '').toLowerCase();

          // Strip staff accounts & non-customers
          const isStaff = email.startsWith('admin_') ||
                          email.startsWith('admin@') ||
                          u.role === 'admin' ||
                          u.role === 'super_admin' ||
                          u.role === 'order_manager' ||
                          u.role === 'product_manager' ||
                          u.role === 'inventory_manager';
          if (isStaff) continue;

          // Filter by search query if supplied
          if (filters.search) {
            const s = filters.search.toLowerCase().trim();
            const matchEmail = u.email && u.email.toLowerCase().includes(s);
            const matchName = u.displayName && u.displayName.toLowerCase().includes(s);
            const matchPhone = u.phone && u.phone.includes(s);
            if (!matchEmail && !matchName && !matchPhone) continue;
          }

          const customerId = u.uid || doc.id || '';
          const name = u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Customer';
          const phone = normalizeCsvPhone(u.phone || u.phoneNumber || '');
          const role = u.role || 'customer';
          const agg = orderStatsByUid.get(customerId) || orderStatsByEmail.get(email);
          const ordersCount = agg ? agg.count : (u.ordersCount || u.totalOrders || 0);
          const spendPaise = agg ? agg.spendPaise : u.totalSpentPaise;
          const totalSpent = formatPlainInr(spendPaise, u.totalSpentFormatted);
          const createdAt = formatCsvDate(u.createdAt);
          const lastLogin = formatCsvDate(u.lastLoginAt || u.lastActiveAt);
          const status = u.isActive === false ? 'INACTIVE' : 'ACTIVE';

          const row = [
            customerId,
            name,
            u.email || '',
            phone,
            role,
            ordersCount,
            totalSpent,
            createdAt,
            lastLogin,
            status
          ];

          res.write(toCsvRow(row));
        }

        if (snap.docs.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }

      if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    } catch (err) {
      logger.error('Error streaming customers CSV export', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Failed to export customers CSV' } });
      } else if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }
}

const csvExportServiceInstance = new CsvExportService();
csvExportServiceInstance.CsvExportService = CsvExportService;
csvExportServiceInstance.csvExportService = csvExportServiceInstance;
csvExportServiceInstance.sanitizeCsvValue = sanitizeCsvValue;
csvExportServiceInstance.toCsvRow = toCsvRow;

module.exports = csvExportServiceInstance;
