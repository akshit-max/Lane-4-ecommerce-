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
 * Format timestamp into standard ISO string or readable date
 */
function formatCsvDate(ts) {
  if (!ts) return '';
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? String(ts) : d.toISOString();
  } catch (_) {
    return String(ts);
  }
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
        res.write(toCsvRow(headers));
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
          const pricing = ord.pricing || {};
          const ship = ord.shippingAddress || {};
          const tracking = ord.tracking || {};
          const items = ord.items || [];
          const totalItemsCount = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);

          const row = [
            ord.orderId || doc.id || '',
            ord.orderNumber || '',
            formatCsvDate(ord.createdAt),
            ord.customerEmail || '',
            ship.addressee || ord.customerName || '',
            ship.phone || ord.customerPhone || '',
            ord.status || ord.orderStatus || '',
            ord.paymentStatus || '',
            ord.paymentMethod || 'UPI_QR',
            pricing.itemsSubtotalFormatted || (pricing.itemsSubtotalPaise ? (pricing.itemsSubtotalPaise / 100).toFixed(2) : '0.00'),
            pricing.shippingChargesFormatted || (pricing.shippingChargesPaise ? (pricing.shippingChargesPaise / 100).toFixed(2) : '0.00'),
            pricing.couponDiscountFormatted || (pricing.couponDiscountPaise ? (pricing.couponDiscountPaise / 100).toFixed(2) : '0.00'),
            pricing.finalPayableFormatted || (pricing.finalPayablePaise ? (pricing.finalPayablePaise / 100).toFixed(2) : '0.00'),
            totalItemsCount,
            ship.addressee || '',
            ship.city || '',
            ship.state || '',
            ship.postalCode || '',
            tracking.carrier || '',
            tracking.trackingNumber || '',
            ord.paymentDetails?.utr || ord.upiReferenceNumber || ''
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
        res.write(toCsvRow(headers));
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

          const row = [
            item.sku || doc.id || '',
            item.productId || '',
            item.productName || item.title || '',
            item.variantLabel || item.variant || item.size || 'Default',
            avail,
            resv,
            physical,
            threshold,
            status,
            item.priceFormatted || (item.pricePaise ? (item.pricePaise / 100).toFixed(2) : (item.price || '0.00')),
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
        res.write(toCsvRow(headers));
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
          const phone = u.phone || u.phoneNumber || '';
          const role = u.role || 'customer';
          const ordersCount = u.ordersCount || u.totalOrders || 0;
          const totalSpent = u.totalSpentFormatted || (u.totalSpentPaise ? (u.totalSpentPaise / 100).toFixed(2) : '0.00');
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
