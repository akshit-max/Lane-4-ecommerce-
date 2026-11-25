const { getDb } = require('../config/firebaseAdmin');
const { staffNotificationService } = require('./staffNotificationService');
const { logger } = require('../utils/logger');

class InventoryService {
  async listInventory(filters = {}) {
    const db = getDb();
    if (!db) return [];

    let query = db.collection('inventory');

    const snap = await query.get();
    let items = snap.docs.map(d => d.data());

    if (filters.lowStockOnly === true || filters.lowStockOnly === 'true') {
      items = items.filter(it => it.availableQuantity <= (it.lowStockThreshold || 5));
    }

    if (filters.outOfStockOnly === true || filters.outOfStockOnly === 'true') {
      items = items.filter(it => it.availableQuantity <= 0);
    }

    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      items = items.filter(it =>
        it.sku.toLowerCase().includes(s) ||
        (it.productName && it.productName.toLowerCase().includes(s)) ||
        (it.variantLabel && it.variantLabel.toLowerCase().includes(s))
      );
    }

    return items;
  }

  async adjustStock(sku, { adjustmentQuantity, type = 'manual_adjustment', reason = '' }, adminUser) {
    const db = getDb();
    const qty = parseInt(adjustmentQuantity, 10);
    if (isNaN(qty) || qty === 0) {
      const err = new Error('Valid non-zero integer adjustmentQuantity is required.');
      err.statusCode = 400;
      throw err;
    }

    const invRef = db.collection('inventory').doc(sku);
    const invDoc = await invRef.get();
    if (!invDoc.exists) {
      const err = new Error(`Inventory item with SKU "${sku}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const currentData = invDoc.data();
    const currentAvailable = typeof currentData.availableQuantity === 'number' ? currentData.availableQuantity : 0;
    const reserved = typeof currentData.reservedQuantity === 'number' ? currentData.reservedQuantity : 0;

    // Guard: cannot reduce available stock below 0 or physical stock below active reservations
    if (currentAvailable + qty < 0) {
      const err = new Error(`Insufficient stock for SKU "${sku}": cannot decrease stock below active reservations (${reserved} units reserved for pending orders; current available: ${currentAvailable}, requested adjustment: ${qty}).`);
      err.statusCode = 400;
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }

    const newAvailable = currentAvailable + qty;
    const now = new Date();

    // 1. Update authoritative inventory document (available stock, keeping reservations untouched)
    await invRef.update({
      availableQuantity: newAvailable,
      isOutOfStock: newAvailable <= 0,
      updatedAt: now
    });

    // 2. Synchronize physical stock to products collection (currentPhysicalStock + adjustmentQuantity)
    let productUpdated = false;
    let targetProduct = null;
    try {
      const productsSnap = await db.collection('products').get();
      for (const pDoc of productsSnap.docs) {
        const pData = pDoc.data();
        let matched = false;

        // Check variants
        if (pData.variants && Array.isArray(pData.variants) && pData.variants.length > 0) {
          const updatedVariants = pData.variants.map(v => {
            if (v.sku === sku || v.variantId === sku) {
              matched = true;
              // Preserve physical warehouse stock invariant: currentPhysical + qty
              const currentVStock = typeof v.stockQuantity === 'number'
                ? v.stockQuantity
                : (currentAvailable + reserved);
              const newVStock = Math.max(0, currentVStock + qty);
              return { ...v, stockQuantity: newVStock };
            }
            return v;
          });

          if (matched) {
            const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
            await pDoc.ref.update({
              variants: updatedVariants,
              stockQuantity: newTotalStock,
              updatedAt: now
            });
            productUpdated = true;
            targetProduct = { id: pDoc.id, slug: pData.slug, newTotalStock };
            break;
          }
        }

        // Single-SKU product match
        if (!matched && (pData.sku === sku || pData.slug === currentData.slug || pDoc.id === currentData.productId)) {
          const currentPStock = typeof pData.stockQuantity === 'number'
            ? pData.stockQuantity
            : (currentAvailable + reserved);
          const newPStock = Math.max(0, currentPStock + qty);
          const pUpdates = {
            stockQuantity: newPStock,
            updatedAt: now
          };
          if (pData.variants && Array.isArray(pData.variants) && pData.variants.length > 0) {
            pUpdates.variants = pData.variants.map((v, idx) => idx === 0 ? { ...v, stockQuantity: newPStock } : v);
          }
          await pDoc.ref.update(pUpdates);
          productUpdated = true;
          targetProduct = { id: pDoc.id, slug: pData.slug, newTotalStock: newPStock };
          break;
        }
      }
    } catch (syncErr) {
      logger.warn('Failed to sync stock adjustment to products collection', { message: syncErr.message, sku });
    }

    // 3. Record inventory ledger entry
    await invRef.collection('ledger').add({
      type,
      quantityChanged: qty,
      previousQuantity: currentAvailable,
      newBalance: newAvailable,
      reservedQuantity: reserved,
      reason: reason || 'Staff adjustment',
      adjustedByUid: adminUser ? (adminUser.email || adminUser.uid) : 'system',
      timestamp: now
    });

    // 4. Record audit log
    if (adminUser) {
      await db.collection('adminActivityLogs').add({
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        action: 'stock_adjusted',
        resourceType: 'inventory',
        resourceId: sku,
        details: {
          previousAvailable: currentAvailable,
          change: qty,
          newAvailable,
          reservedQuantity: reserved,
          newPhysicalStock: newAvailable + reserved,
          productSynced: productUpdated,
          productInfo: targetProduct,
          reason
        },
        timestamp: now
      });
    }

    // 5. Notify staff if stock dropped to or below low-stock threshold (non-blocking async)
    const lowStockThreshold = typeof currentData.lowStockThreshold === 'number' ? currentData.lowStockThreshold : 5;
    if (newAvailable <= lowStockThreshold) {
      staffNotificationService.notifyLowStockAlert({
        sku,
        productName: targetProduct?.title || currentData.productName || sku,
        availableQuantity: newAvailable,
        reservedQuantity: reserved,
        lowStockThreshold
      });
    }

    return {
      sku,
      previousQuantity: currentAvailable,
      adjustedBy: qty,
      newAvailableQuantity: newAvailable,
      reservedQuantity: reserved,
      physicalStock: newAvailable + reserved,
      isOutOfStock: newAvailable <= 0,
      productSynced: productUpdated
    };
  }
}

module.exports = new InventoryService();

