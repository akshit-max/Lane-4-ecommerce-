const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');
const { ADMIN_ROLES } = require('../constants/roles');
const { verifyOrderAccessToken } = require('../utils/orderSecurity');
const crypto = require('crypto');

/**
 * Default HSN Code and GST Rate mapping by product category/slug.
 * In India:
 * - Swimwear / Jammers (Apparel > ₹1,000): HSN 6112, Rate 12%
 * - Swim Caps (Headgear): HSN 6506, Rate 18%
 * - Swimming Goggles (Eyewear): HSN 9004, Rate 18%
 * - Training Equipment (Kickboards, Fins): HSN 9506, Rate 18%
 *
 * NOTE: These are documented configurable defaults. The client must formally certify
 * exact HSN classifications and applicable GST rates prior to commercial production filing.
 */
const HSN_TAX_MAP = {
  // Jammers / Swimwear
  'performance-racing-jammer': { hsn: '6112', gstRate: 12, description: 'Racing Jammer / Swimwear' },
  'surge-jammer-pro': { hsn: '6112', gstRate: 12, description: 'Performance Jammer' },
  'swimwear': { hsn: '6112', gstRate: 12, description: 'Competition Swimwear' },
  'apparel': { hsn: '6112', gstRate: 12, description: 'Swim Apparel' },

  // Goggles / Eyewear
  'mirror-racing-goggles': { hsn: '9004', gstRate: 18, description: 'Racing Swim Goggles' },
  'open-water-goggles': { hsn: '9004', gstRate: 18, description: 'Open Water Swim Goggles' },
  'goggles': { hsn: '9004', gstRate: 18, description: 'Swim Eyewear' },

  // Caps
  'surge-racing-cap': { hsn: '6506', gstRate: 18, description: 'Silicone Racing Cap' },
  'lycra-training-cap': { hsn: '6506', gstRate: 18, description: 'Lycra Training Cap' },
  'caps': { hsn: '6506', gstRate: 18, description: 'Swim Headgear' },

  // Training Gear
  'swim-training-fins': { hsn: '9506', gstRate: 18, description: 'Silicone Training Fins' },
  'pro-kickboard-hydro-flow': { hsn: '9506', gstRate: 18, description: 'Hydro Flow Kickboard' },
  'training-gear': { hsn: '9506', gstRate: 18, description: 'Swim Training Equipment' }
};

const DEFAULT_TAX_FALLBACK = {
  hsn: '9506',
  gstRate: 18,
  description: 'Swimming & Aquatic Gear'
};

const SELLER_STATE = 'Maharashtra';
const SELLER_STATE_CODE = '27';

/**
 * Determine Indian Financial Year string (e.g., '2627' for FY 2026-2027)
 * In India, FY begins on April 1 (month index 3 in JS Date)
 */
function getIndianFiscalYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

/**
 * Canonical SHA-256 fingerprint generation for invoice integrity checking
 */
function computeInvoiceFingerprint(invoice) {
  const payload = {
    invoiceNumber: invoice.invoiceNumber,
    orderId: invoice.orderId,
    grandTotalPaise: invoice.summary?.grandTotalPaise,
    totalTaxPaise: invoice.summary?.totalTaxPaise,
    totalTaxablePaise: invoice.summary?.totalTaxablePaise,
    items: (invoice.items || []).map(i => ({
      sku: i.sku,
      qty: i.quantity,
      taxablePaise: i.taxableAmountPaise,
      taxPaise: i.totalTaxAmountPaise
    }))
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Validate cryptographic integrity of an invoice
 */
function verifyInvoiceIntegrity(invoice) {
  if (!invoice || !invoice.sha256Fingerprint) {
    const err = new Error('Security alert: Invoice document lacks cryptographic fingerprint.');
    err.statusCode = 500;
    err.code = 'INVOICE_INTEGRITY_MISSING';
    throw err;
  }
  const expectedHash = computeInvoiceFingerprint(invoice);
  if (invoice.sha256Fingerprint !== expectedHash) {
    const err = new Error('Security alert: Invoice integrity verification failed. Cryptographic signature does not match stored content.');
    err.statusCode = 500;
    err.code = 'INVOICE_INTEGRITY_COMPROMISED';
    throw err;
  }
  return true;
}

class GstInvoiceService {
  /**
   * Resolve applicable HSN and GST rate for a line item
   */
  resolveItemTaxConfig(item) {
    // 1. Explicit item-level metadata takes precedence
    if (item.hsnCode && typeof item.gstRate === 'number') {
      return {
        hsn: String(item.hsnCode),
        gstRate: item.gstRate,
        description: item.name || item.title || 'Product'
      };
    }

    // 2. Lookup by slug or category
    const slugKey = (item.slug || '').toLowerCase().trim();
    if (slugKey && HSN_TAX_MAP[slugKey]) {
      return HSN_TAX_MAP[slugKey];
    }

    const catKey = (item.categorySlug || item.category || '').toLowerCase().trim();
    if (catKey && HSN_TAX_MAP[catKey]) {
      return HSN_TAX_MAP[catKey];
    }

    // 3. Fallback to general aquatic equipment
    return DEFAULT_TAX_FALLBACK;
  }

  /**
   * Determine Place of Supply and tax regime (Intra-State vs Inter-State)
   */
  determinePlaceOfSupply(shippingAddress, storeProfile = {}) {
    const sellerState = storeProfile.state || SELLER_STATE;
    const sellerStateCode = storeProfile.stateCode || SELLER_STATE_CODE;

    const rawState = (shippingAddress && shippingAddress.state) ? shippingAddress.state.trim() : '';
    const cleanState = rawState.toLowerCase();

    // Check if buyer state matches seller registered state
    const isIntraState = (
      cleanState === 'maharashtra' ||
      cleanState === 'mh' ||
      cleanState === '27' ||
      cleanState === sellerState.toLowerCase()
    );

    return {
      sellerState,
      sellerStateCode,
      buyerState: rawState || sellerState,
      isIntraState,
      isInterState: !isIntraState
    };
  }

  _resolveLineItemUnitAndTotalPaise(item) {
    const qty = parseInt(item.quantity, 10) || 1;
    let unitPricePaise = parseInt(
      item.unitPricePaise ?? item.pricePaise ?? (typeof item.price === 'number' ? Math.round(item.price * 100) : 0),
      10
    ) || 0;
    let lineTotalPaise = parseInt(item.totalPricePaise ?? item.lineTotalPaise ?? 0, 10) || 0;
    if (!unitPricePaise && lineTotalPaise > 0) {
      unitPricePaise = Math.round(lineTotalPaise / qty);
    }
    if (!lineTotalPaise && unitPricePaise > 0) {
      lineTotalPaise = unitPricePaise * qty;
    }
    return { qty, unitPricePaise, lineTotalPaise };
  }

  /**
   * Calculate exact line-item tax breakdown with proportional coupon discount allocation
   */
  calculateLineItemTax(item, effectiveLineTotalPaise, originalLineTotalPaise, allocatedDiscountPaise, isIntraState) {
    const { qty, unitPricePaise } = this._resolveLineItemUnitAndTotalPaise(item);

    const taxConfig = this.resolveItemTaxConfig(item);
    const gstRate = taxConfig.gstRate;

    // Backward extraction from discounted GST-inclusive transaction value:
    // Taxable Value = Effective Line Total * 100 / (100 + gstRate)
    const taxableAmountPaise = Math.round((effectiveLineTotalPaise * 100) / (100 + gstRate));
    const totalTaxAmountPaise = effectiveLineTotalPaise - taxableAmountPaise;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmountPaise = 0;
    let sgstAmountPaise = 0;
    let igstAmountPaise = 0;

    if (isIntraState) {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmountPaise = Math.round(totalTaxAmountPaise / 2);
      sgstAmountPaise = totalTaxAmountPaise - cgstAmountPaise; // Exact sum guarantee
    } else {
      igstRate = gstRate;
      igstAmountPaise = totalTaxAmountPaise;
    }

    const derivedVariant = [
      item.size ? `Size: ${item.size}` : '',
      item.color ? String(item.color) : ''
    ].filter(Boolean).join(' · ');
    const variantLabel = item.variantLabel || item.variantName || derivedVariant;

    return {
      sku: item.sku || '',
      name: item.name || item.title || 'Product',
      description: item.name || item.title || 'Product',
      variantLabel,
      variantName: variantLabel,
      hsn: taxConfig.hsn,
      hsnCode: taxConfig.hsn,
      quantity: qty,
      unitPricePaise,
      unitPriceFormatted: (unitPricePaise / 100).toFixed(2),
      originalLineTotalPaise,
      originalLineTotalFormatted: (originalLineTotalPaise / 100).toFixed(2),
      lineTotalPaise: effectiveLineTotalPaise,
      lineTotalFormatted: (effectiveLineTotalPaise / 100).toFixed(2),
      totalFormatted: (effectiveLineTotalPaise / 100).toFixed(2),
      allocatedDiscountPaise,
      allocatedDiscountFormatted: (allocatedDiscountPaise / 100).toFixed(2),
      effectiveLineTotalPaise,
      effectiveLineTotalFormatted: (effectiveLineTotalPaise / 100).toFixed(2),
      taxableAmountPaise,
      taxableAmountFormatted: (taxableAmountPaise / 100).toFixed(2),
      gstRate,
      cgstRate,
      cgstAmountPaise,
      cgstAmountFormatted: (cgstAmountPaise / 100).toFixed(2),
      cgstFormatted: (cgstAmountPaise / 100).toFixed(2),
      sgstRate,
      sgstAmountPaise,
      sgstAmountFormatted: (sgstAmountPaise / 100).toFixed(2),
      sgstFormatted: (sgstAmountPaise / 100).toFixed(2),
      igstRate,
      igstAmountPaise,
      igstAmountFormatted: (igstAmountPaise / 100).toFixed(2),
      igstFormatted: (igstAmountPaise / 100).toFixed(2),
      totalTaxAmountPaise,
      totalTaxAmountFormatted: (totalTaxAmountPaise / 100).toFixed(2)
    };
  }

  /**
   * Generate or retrieve an immutable GST Tax Invoice for an order
   * Uses atomic Firestore transaction for sequential counter allocation
   */
  async getOrCreateInvoice(orderId, callerUser = null, orderAccessToken = null) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    // 1. Fetch order document
    let orderRef = db.collection('orders').doc(orderId);
    let orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      const qSnap = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get();
      if (!qSnap.empty) {
        orderSnap = qSnap.docs[0];
        orderRef = orderSnap.ref;
      }
    }
    if (!orderSnap.exists) {
      const err = new Error(`Order "${orderId}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const orderData = orderSnap.data();
    const actualOrderId = orderSnap.id;

    // 2. Authorization & Ownership verification
    this._verifyInvoiceAccess(orderData, actualOrderId, callerUser, orderAccessToken);

    // 3. Return existing immutable invoice if already issued (with integrity check & broken-zero auto-repair)
    const invoiceDocRef = db.collection('invoices').doc(`inv_${actualOrderId}`);
    const existingInvoiceSnap = await invoiceDocRef.get();
    let repairExistingInvoice = null;
    if (existingInvoiceSnap.exists) {
      const existingInvoice = existingInvoiceSnap.data();
      verifyInvoiceIntegrity(existingInvoice);
      const isZeroBroken =
        (existingInvoice.summary?.grandTotalPaise || 0) > 0 &&
        (existingInvoice.summary?.totalTaxablePaise || 0) === 0;
      if (!isZeroBroken) {
        return existingInvoice;
      }
      repairExistingInvoice = existingInvoice;
    }

    // 4. Fetch store profile settings for seller identity
    let storeProfile = {};
    try {
      const profileSnap = await db.collection('storeSettings').doc('profile').get();
      if (profileSnap.exists) storeProfile = profileSnap.data();
    } catch (_) {}

    // Compliance Check: Block official invoice in production if seller GSTIN is missing/unverified
    const isProduction = process.env.NODE_ENV === 'production';
    const requireCertifiedGst = isProduction || process.env.REQUIRE_CERTIFIED_GST === 'true';
    const effectiveGstin = (storeProfile.gstin || process.env.SELLER_GSTIN || '').trim().toUpperCase();
    // Valid Indian GSTIN: 2-digit state code + 10-char PAN + 1 entity num + 'Z' + 1 checksum char
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const isValidGstinFormat = GSTIN_REGEX.test(effectiveGstin);
    const isPlaceholderGstin = !effectiveGstin || !isValidGstinFormat || effectiveGstin.includes('TEST') || effectiveGstin.includes('PENDING');

    if (requireCertifiedGst && isPlaceholderGstin) {
      const err = new Error('Legal compliance failure: Store GSTIN is not certified. Commercial tax invoice issuance is blocked.');
      err.statusCode = 422;
      err.code = 'GST_CONFIG_INCOMPLETE';
      throw err;
    }

    const now = new Date();
    const supply = this.determinePlaceOfSupply(orderData.shippingAddress, storeProfile);
    const fy = getIndianFiscalYear(now);

    // 5. Pre-supply coupon discount proportional allocation
    const discountPaise = (orderData.pricing && orderData.pricing.couponDiscountPaise) || 0;
    const rawItems = orderData.items || [];
    const computedRawSubtotal = rawItems.reduce((sum, it) => sum + this._resolveLineItemUnitAndTotalPaise(it).lineTotalPaise, 0);
    const itemsSubtotalPaise =
      (orderData.pricing && (orderData.pricing.itemsSubtotalPaise || orderData.pricing.subtotalPaise || orderData.pricing.itemsTotalPaise)) ||
      computedRawSubtotal;

    let allocatedDiscountAcc = 0;
    const itemDiscounts = rawItems.map((it, idx) => {
      const lineTotal = this._resolveLineItemUnitAndTotalPaise(it).lineTotalPaise;
      if (idx === rawItems.length - 1) {
        return Math.max(0, discountPaise - allocatedDiscountAcc);
      }
      const d = itemsSubtotalPaise > 0 ? Math.floor((discountPaise * lineTotal) / itemsSubtotalPaise) : 0;
      allocatedDiscountAcc += d;
      return d;
    });

    // 6. Calculate item-level GST breakdowns on discounted effective values
    const items = rawItems.map((it, idx) => {
      const origLineTotal = this._resolveLineItemUnitAndTotalPaise(it).lineTotalPaise;
      const allocatedDisc = itemDiscounts[idx] || 0;
      const effectiveLineTotal = Math.max(0, origLineTotal - allocatedDisc);
      return this.calculateLineItemTax(it, effectiveLineTotal, origLineTotal, allocatedDisc, supply.isIntraState);
    });

    const totalTaxablePaise = items.reduce((sum, it) => sum + it.taxableAmountPaise, 0);
    const totalCgstPaise = items.reduce((sum, it) => sum + it.cgstAmountPaise, 0);
    const totalSgstPaise = items.reduce((sum, it) => sum + it.sgstAmountPaise, 0);
    const totalIgstPaise = items.reduce((sum, it) => sum + it.igstAmountPaise, 0);
    const totalTaxPaise = items.reduce((sum, it) => sum + it.totalTaxAmountPaise, 0);

    // Shipping tax handling (SAC 9968 - Courier services at 18%)
    const shippingPaise = (orderData.pricing && orderData.pricing.shippingChargesPaise) || 0;
    let shippingTaxablePaise = 0;
    let shippingGstPaise = 0;
    let shippingCgstPaise = 0;
    let shippingSgstPaise = 0;
    let shippingIgstPaise = 0;

    if (shippingPaise > 0) {
      shippingTaxablePaise = Math.round((shippingPaise * 100) / 118);
      shippingGstPaise = shippingPaise - shippingTaxablePaise;
      if (supply.isIntraState) {
        shippingCgstPaise = Math.round(shippingGstPaise / 2);
        shippingSgstPaise = shippingGstPaise - shippingCgstPaise;
      } else {
        shippingIgstPaise = shippingGstPaise;
      }
    }

    const finalAmountPaise = (orderData.pricing && orderData.pricing.finalPayablePaise) || (totalTaxablePaise + totalTaxPaise + shippingPaise);

    // 7. Atomic transaction: allocate sequential invoice number and persist
    let finalInvoice;

    await db.runTransaction(async (transaction) => {
      // Re-read existing invoice inside transaction to prevent concurrency collision
      const checkInvoiceSnap = await transaction.get(invoiceDocRef);
      if (checkInvoiceSnap.exists && !repairExistingInvoice) {
        finalInvoice = checkInvoiceSnap.data();
        return;
      }

      // Preserve existing invoiceNumber & date if repairing a previously broken zero-total record
      let nextSequence = null;
      let invoiceNumber;
      const counterRef = db.collection('counters').doc(`invoices_FY${fy}`);
      if (repairExistingInvoice && repairExistingInvoice.invoiceNumber) {
        invoiceNumber = repairExistingInvoice.invoiceNumber;
      } else {
        const counterSnap = await transaction.get(counterRef);
        nextSequence = (counterSnap.exists ? (counterSnap.data().currentSequence || 0) : 0) + 1;
        invoiceNumber = `L4-INV-${fy}-${String(nextSequence).padStart(4, '0')}`;
      }

      // Assemble complete GST Tax Invoice payload
      finalInvoice = {
        invoiceId: `inv_${actualOrderId}`,
        invoiceNumber,
        fiscalYear: (repairExistingInvoice && repairExistingInvoice.fiscalYear) || `FY${fy}`,
        invoiceDate: (repairExistingInvoice && repairExistingInvoice.invoiceDate) || now,
        orderId: actualOrderId,
        orderNumber: orderData.orderNumber || actualOrderId,
        orderCreatedAt: orderData.createdAt,
        paymentStatus: orderData.paymentStatus || 'paid',
        paymentMethod: orderData.paymentMethod || 'UPI_QR',

        // Seller Details
        seller: {
          legalName: storeProfile.legalName || storeProfile.storeName || 'The Lane4 Performance Store',
          address: storeProfile.storeAddress || 'Nagpur, Maharashtra, India',
          city: storeProfile.city || 'Nagpur',
          state: supply.sellerState,
          stateCode: supply.sellerStateCode,
          gstin: isPlaceholderGstin ? null : effectiveGstin,
          gstinStatus: isPlaceholderGstin ? 'PENDING_REGISTRATION' : 'CERTIFIED_ACTIVE',
          isCertifiedGstin: !isPlaceholderGstin,
          contactEmail: storeProfile.supportEmail || 'Lane4performancestore@gmail.com',
          contactPhone: storeProfile.supportPhone || '+91 79725 41297'
        },
        isProvisionalDraft: isPlaceholderGstin,

        // Buyer / Consignee Details
        buyer: {
          customerId: orderData.customerId || null,
          name: (orderData.shippingAddress && orderData.shippingAddress.addressee) || orderData.customerEmail,
          email: orderData.customerEmail,
          phone: (orderData.shippingAddress && orderData.shippingAddress.phone) || orderData.customerPhone || '',
          addressLine1: (orderData.shippingAddress && orderData.shippingAddress.addressLine1) || '',
          addressLine2: (orderData.shippingAddress && orderData.shippingAddress.addressLine2) || '',
          city: (orderData.shippingAddress && orderData.shippingAddress.city) || '',
          state: supply.buyerState,
          postalCode: (orderData.shippingAddress && orderData.shippingAddress.postalCode) || '',
          country: 'India',
          gstin: orderData.buyerGstin || null
        },

        // Place of Supply
        placeOfSupply: {
          state: supply.buyerState,
          stateCode: supply.isIntraState ? supply.sellerStateCode : 'OTHER',
          taxType: supply.isIntraState ? 'INTRA_STATE (CGST + SGST)' : 'INTER_STATE (IGST)'
        },

        // Line Items Breakdown
        items,

        // Shipping Charges Breakdown
        shipping: {
          sacCode: '9968',
          chargesPaise: shippingPaise,
          chargesFormatted: (shippingPaise / 100).toFixed(2),
          totalFormatted: (shippingPaise / 100).toFixed(2),
          taxablePaise: shippingTaxablePaise,
          taxableFormatted: (shippingTaxablePaise / 100).toFixed(2),
          taxableAmountPaise: shippingTaxablePaise,
          taxableAmountFormatted: (shippingTaxablePaise / 100).toFixed(2),
          gstRate: shippingPaise > 0 ? 18 : 0,
          cgstPaise: shippingCgstPaise,
          cgstFormatted: (shippingCgstPaise / 100).toFixed(2),
          sgstPaise: shippingSgstPaise,
          sgstFormatted: (shippingSgstPaise / 100).toFixed(2),
          igstPaise: shippingIgstPaise,
          igstFormatted: (shippingIgstPaise / 100).toFixed(2),
          totalTaxPaise: shippingGstPaise
        },

        // Discount Summary
        discountPaise,
        discountFormatted: (discountPaise / 100).toFixed(2),

        // Summary Totals (Exact reconciliation: totalTaxable + totalTax === grandTotal)
        summary: {
          itemsSubtotalPaise,
          itemsSubtotalFormatted: (itemsSubtotalPaise / 100).toFixed(2),
          totalTaxablePaise: totalTaxablePaise + shippingTaxablePaise,
          totalTaxableFormatted: ((totalTaxablePaise + shippingTaxablePaise) / 100).toFixed(2),
          totalCgstPaise: totalCgstPaise + shippingCgstPaise,
          totalCgstFormatted: ((totalCgstPaise + shippingCgstPaise) / 100).toFixed(2),
          totalSgstPaise: totalSgstPaise + shippingSgstPaise,
          totalSgstFormatted: ((totalSgstPaise + shippingSgstPaise) / 100).toFixed(2),
          totalIgstPaise: totalIgstPaise + shippingIgstPaise,
          totalIgstFormatted: ((totalIgstPaise + shippingIgstPaise) / 100).toFixed(2),
          totalTaxPaise: totalTaxPaise + shippingGstPaise,
          totalTaxFormatted: ((totalTaxPaise + shippingGstPaise) / 100).toFixed(2),
          grandTotalPaise: finalAmountPaise,
          grandTotalFormatted: (finalAmountPaise / 100).toFixed(2)
        },

        generatedAt: now,
        isImmutable: true
      };

      // 8. Cryptographic integrity fingerprint
      finalInvoice.sha256Fingerprint = computeInvoiceFingerprint(finalInvoice);

      // 9. Atomic writes inside transaction
      if (nextSequence !== null) {
        transaction.set(counterRef, { currentSequence: nextSequence, updatedAt: now }, { merge: true });
      }
      transaction.set(invoiceDocRef, finalInvoice);
      transaction.update(orderRef, {
        invoiceIssued: true,
        invoiceNumber,
        invoiceId: finalInvoice.invoiceId,
        invoiceIssuedAt: now
      });
    });

    verifyInvoiceIntegrity(finalInvoice);
    return finalInvoice;
  }

  /**
   * Internal ownership check: only admin or owning customer can access invoice
   */
  _verifyInvoiceAccess(orderData, orderId, callerUser, orderAccessToken) {
    // 1. Admin access
    if (callerUser && callerUser.role && ADMIN_ROLES.includes(callerUser.role)) {
      return true;
    }

    // 2. Registered order: strictly require exact customer UID match
    if (orderData.customerId) {
      if (callerUser && callerUser.uid && callerUser.uid === orderData.customerId) {
        return true;
      }
      const err = new Error('Access denied: You are not authorized to view the invoice for this registered order.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // 3. Guest order: strictly require cryptographic orderAccessToken
    if (orderAccessToken) {
      const isValid = verifyOrderAccessToken(orderId, orderData.customerEmail, orderAccessToken);
      if (isValid) return true;
    }

    const err = new Error('Access denied: You are not authorized to view the invoice for this order.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

const instance = new GstInvoiceService();
instance.GstInvoiceService = GstInvoiceService;
instance.gstInvoiceService = instance;
instance.getIndianFiscalYear = getIndianFiscalYear;
instance.computeInvoiceFingerprint = computeInvoiceFingerprint;
instance.verifyInvoiceIntegrity = verifyInvoiceIntegrity;
instance.HSN_TAX_MAP = HSN_TAX_MAP;

module.exports = instance;
