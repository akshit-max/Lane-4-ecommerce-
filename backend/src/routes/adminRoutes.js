const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/requireAdmin');
const { requirePermission } = require('../middleware/requirePermission');
const { upload } = require('../middleware/uploadMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { addTrackingValidator, updateOrderStatusValidator } = require('../validators/orderValidators');
const { approvePaymentValidator, rejectPaymentValidator } = require('../validators/paymentValidators');

// All admin routes require valid authentication & staff role
router.use(authenticate, requireAdmin);

// Dashboard & Logs
router.get('/dashboard', requirePermission('dashboard:read'), adminController.getDashboard);
router.get('/logs', requirePermission('super_admin'), adminController.listLogs);

// Orders
router.get('/orders', requirePermission('orders:read'), adminController.listOrders);
router.get('/orders/:id', requirePermission('orders:read'), adminController.getOrder);
router.get('/orders/:id/invoice', requirePermission('orders:read'), adminController.getOrderInvoice);
router.patch('/orders/:id/status', requirePermission('orders:write'), updateOrderStatusValidator, validateRequest, adminController.updateOrderStatus);
router.post('/orders/:id/tracking', requirePermission('orders:write'), addTrackingValidator, validateRequest, adminController.addTracking);
router.post('/orders/:id/refund', requirePermission('orders:refund'), adminController.processRefund);

// Payments (QR Manual Verification)
router.get('/payments', requirePermission('payments:read'), adminController.listPayments);
router.get('/payments/:id', requirePermission('payments:read'), adminController.getPayment);
router.post('/payments/:id/approve', requirePermission('payments:verify'), approvePaymentValidator, validateRequest, adminController.approvePayment);
router.post('/payments/:id/reject', requirePermission('payments:verify'), rejectPaymentValidator, validateRequest, adminController.rejectPayment);
router.post('/payments/:id/upload-proof', requirePermission('payments:verify'), upload.single('screenshot'), adminController.uploadPaymentProof);

// Products
router.get('/products', requirePermission('products:read', 'inventory:read'), adminController.listProducts);
router.post('/products', requirePermission('products:write'), adminController.createProduct);
router.patch('/products/:id', requirePermission('products:write'), adminController.updateProduct);
router.delete('/products/:id', requirePermission('products:delete'), adminController.deleteProduct);
router.post('/uploads/image', requirePermission('products:write'), upload.single('image'), adminController.uploadProductImage);

// Categories
router.get('/categories', requirePermission('categories:read', 'categories:write', 'products:read'), adminController.listCategories);
router.post('/categories', requirePermission('categories:write'), adminController.createCategory);
router.patch('/categories/:id', requirePermission('categories:write'), adminController.updateCategory);
router.delete('/categories/:id', requirePermission('categories:write'), adminController.deleteCategory);

// Inventory
router.get('/inventory', requirePermission('inventory:read'), adminController.listInventory);
router.patch('/inventory/:sku', requirePermission('inventory:write'), adminController.adjustStock);

// Coupons
router.get('/coupons', requirePermission('coupons:read', 'coupons:write'), adminController.listCoupons);
router.post('/coupons', requirePermission('coupons:write'), adminController.createCoupon);
router.patch('/coupons/:id', requirePermission('coupons:write'), adminController.updateCoupon);
router.delete('/coupons/:id', requirePermission('coupons:write'), adminController.deleteCoupon);

// Settings
router.get('/store/payment-settings', requirePermission('settings:read', 'settings:write'), adminController.getPaymentSettings);
router.patch('/store/payment-settings', requirePermission('settings:write'), adminController.updatePaymentSettings);
router.post(
  '/store/payment-settings/qr-image',
  requirePermission('settings:write'),
  upload.fields([{ name: 'qrImage', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  adminController.uploadPaymentQrImage
);
router.post(
  '/store/payment-settings/upload-qr',
  requirePermission('settings:write'),
  upload.fields([{ name: 'qrImage', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  adminController.uploadPaymentQrImage
);
router.patch('/store/shipping-settings', requirePermission('settings:write'), adminController.updateShippingSettings);
router.patch('/store/settings', requirePermission('settings:write'), adminController.updateStoreSettings);

// Customers
router.get('/customers', requirePermission('customers:read'), adminController.listCustomers);

// Enquiries
router.get('/enquiries', requirePermission('enquiries:read'), adminController.listEnquiries);
router.patch('/enquiries/:id', requirePermission('enquiries:write'), adminController.updateEnquiry);

// Reviews
router.get('/reviews', requirePermission('reviews:read', 'reviews:write'), adminController.listReviews);
router.patch('/reviews/:id/status', requirePermission('reviews:write'), adminController.moderateReview);
router.delete('/reviews/:id', requirePermission('reviews:write'), adminController.deleteReview);

// Returns
router.get('/returns', requirePermission('returns:read', 'returns:write', 'orders:read'), adminController.listReturns);
router.patch('/returns/:id', requirePermission('returns:write', 'orders:write'), adminController.updateReturn);

// Exports
router.get('/exports/orders', requirePermission('orders:read'), adminController.exportOrders);
router.get('/exports/inventory', requirePermission('inventory:read'), adminController.exportInventory);
router.get('/exports/customers', requirePermission('customers:export'), adminController.exportCustomers);

module.exports = router;

