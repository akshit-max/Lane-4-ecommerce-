const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { upload } = require('../middleware/uploadMiddleware');
const { paymentProofLimiter } = require('../middleware/rateLimiter');

router.get('/settings', paymentController.getPaymentSettings);

router.post(
  '/proof',
  paymentProofLimiter,
  optionalAuthenticate,
  upload.single('screenshot'),
  paymentController.submitProof
);

router.get('/order/:id', optionalAuthenticate, paymentController.getOrderPaymentStatus);

module.exports = router;

