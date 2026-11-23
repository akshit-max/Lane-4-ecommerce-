const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/requireAdmin');
const { requirePermission } = require('../middleware/requirePermission');
const { upload } = require('../middleware/uploadMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { addTrackingValidator, updateOrderStatusValidator } = require('../validators/orderValidators');
const { rejectPaymentValidator } = require('../validators/paymentValidators');

// All admin routes require valid authentication & staff role
router.use(authenticate, requireAdmin);

// Dashboard & Logs
router.get('/dashboard', adminController.getDashboard);
router.get('/logs', requirePermission('super_admin'), adminController.listLogs);

// Orders
router.get('/orders', adminController.listOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch('/orders/:id/status', updateOrderStatusValidator, validateRequest, adminController.updateOrderStatus);
router.post('/orders/:id/tracking', addTrackingValidator, validateRequest, adminController.addTracking);

// Payments (QR Manual Verification)
router.get('/payments', adminController.listPayments);
router.get('/payments/:id', adminController.getPayment);
router.post('/payments/:id/approve', adminController.approvePayment);
router.post('/payments/:id/reject', rejectPaymentValidator, validateRequest, adminController.rejectPayment);
router.post('/payments/:id/upload-proof', upload.single('screenshot'), adminController.uploadPaymentProof);

// Products
router.get('/products', adminController.listProducts);
router.post('/products', adminController.createProduct);
router.patch('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.post('/uploads/image', upload.single('image'), adminController.uploadProductImage);

// Categories
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Inventory
router.get('/inventory', adminController.listInventory);
router.patch('/inventory/:sku', adminController.adjustStock);

// Coupons
router.get('/coupons', adminController.listCoupons);
router.post('/coupons', adminController.createCoupon);
router.patch('/coupons/:id', adminController.updateCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Settings
router.get('/store/payment-settings', adminController.getPaymentSettings);
router.patch('/store/payment-settings', adminController.updatePaymentSettings);
router.post(
  '/store/payment-settings/qr-image',
  upload.fields([{ name: 'qrImage', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  adminController.uploadPaymentQrImage
);
router.post(
  '/store/payment-settings/upload-qr',
  upload.fields([{ name: 'qrImage', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  adminController.uploadPaymentQrImage
);
router.patch('/store/shipping-settings', adminController.updateShippingSettings);
router.patch('/store/settings', adminController.updateStoreSettings);

// Customers
router.get('/customers', adminController.listCustomers);

// Enquiries
router.get('/enquiries', adminController.listEnquiries);
router.patch('/enquiries/:id', adminController.updateEnquiry);

// Reviews
router.get('/reviews', adminController.listReviews);
router.patch('/reviews/:id/status', adminController.moderateReview);
router.delete('/reviews/:id', adminController.deleteReview);

// Returns
router.get('/returns', adminController.listReturns);
router.patch('/returns/:id', adminController.updateReturn);

module.exports = router;

