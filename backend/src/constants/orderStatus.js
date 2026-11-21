/**
 * Order and Payment Status Definitions
 */
const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_VERIFICATION: 'payment_verification',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  REFUNDED: 'refunded'
};

const ALLOWED_ORDER_STATUSES = Object.values(ORDER_STATUS);

const PAYMENT_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  VERIFICATION_PENDING: 'verification_pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const ALLOWED_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

const SHIPPING_DEFAULTS = {
  FLAT_FEE_PAISE: 9900, // ₹99.00
  FREE_SHIPPING_THRESHOLD_PAISE: 199900 // ₹1,999.00
};

module.exports = {
  ORDER_STATUS,
  ALLOWED_ORDER_STATUSES,
  PAYMENT_STATUS,
  ALLOWED_PAYMENT_STATUSES,
  SHIPPING_DEFAULTS
};

