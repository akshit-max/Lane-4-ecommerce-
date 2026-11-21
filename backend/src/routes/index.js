const express = require('express');
const router = express.Router();

// Domain Route Modules
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');
const couponRoutes = require('./couponRoutes');
const shippingRoutes = require('./shippingRoutes');
const customerRoutes = require('./customerRoutes');
const enquiryRoutes = require('./enquiryRoutes');
const newsletterRoutes = require('./newsletterRoutes');
const reviewRoutes = require('./reviewRoutes');
const returnRoutes = require('./returnRoutes');
const adminRoutes = require('./adminRoutes');
const publicConfigRoutes = require('./publicConfigRoutes');

// Mount Domain Routes
router.use('/', publicConfigRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/checkout', orderRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment-settings', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/shipping', shippingRoutes);
router.use('/customers', customerRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/reviews', reviewRoutes);
router.use('/returns', returnRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

