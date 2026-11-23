const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { upload } = require('../middleware/uploadMiddleware');
const { paymentProofLimiter } = require('../middleware/rateLimiter');
const { submitProofValidator } = require('../validators/paymentValidators');
const { validateRequest } = require('../middleware/validateRequest');

router.get('/settings', paymentController.getPaymentSettings);

router.post(
  '/proof',
  paymentProofLimiter,
  optionalAuthenticate,
  upload.single('screenshot'),
  submitProofValidator,
  validateRequest,
  paymentController.submitProof
);

router.get('/order/:id', optionalAuthenticate, paymentController.getOrderPaymentStatus);

module.exports = router;

