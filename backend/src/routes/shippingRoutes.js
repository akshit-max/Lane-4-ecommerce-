const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');

router.get('/settings', shippingController.getSettings);
router.get('/calculate', shippingController.calculate);

module.exports = router;

