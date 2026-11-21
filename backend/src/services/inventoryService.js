const { getDb } = require('../config/firebaseAdmin');
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
    if (isNaN(qty)) throw new Error('Valid integer adjustmentQuantity is required.');

    const invRef = db.collection('inventory').doc(sku);
    const invDoc = await invRef.get();
    if (!invDoc.exists) throw new Error(`Inventory item with SKU "${sku}" not found.`);

    const currentData = invDoc.data();
    const newAvailable = Math.max(0, (currentData.availableQuantity || 0) + qty);
    const now = new Date();

    await invRef.update({
      availableQuantity: newAvailable,
      isOutOfStock: newAvailable <= 0,
      updatedAt: now
    });

    // Record ledger entry
    await invRef.collection('ledger').add({
      type,
      quantityChanged: qty,
      newBalance: newAvailable,
      reason: reason || 'Staff adjustment',
      adjustedByUid: adminUser ? adminUser.uid : 'system',
      timestamp: now
    });

    // Audit log
    if (adminUser) {
      await db.collection('adminActivityLogs').add({
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        action: 'stock_adjusted',
        resourceType: 'inventory',
        resourceId: sku,
        details: { previous: currentData.availableQuantity, change: qty, newBalance: newAvailable, reason },
        timestamp: now
      });
    }

    return {
      sku,
      previousQuantity: currentData.availableQuantity,
      adjustedBy: qty,
      newAvailableQuantity: newAvailable,
      isOutOfStock: newAvailable <= 0
    };
  }
}

module.exports = new InventoryService();

