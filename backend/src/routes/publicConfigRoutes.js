const express = require('express');
const router = express.Router();
const { config, checkEnvironmentStatus } = require('../config/environment');
const storeSettingsService = require('../services/storeSettingsService');
const paymentService = require('../services/paymentService');
const { sendSuccess } = require('../utils/response');

// Return safe public config for frontend (Firebase Web SDK, public endpoints)
router.get('/config/public', async (req, res, next) => {
  try {
    const storeSettings = await storeSettingsService.getStoreSettings();
    return sendSuccess(res, {
      firebase: {
        apiKey: config.firebase.webApiKey,
        authDomain: config.firebase.webAuthDomain,
        projectId: config.firebase.projectId,
        storageBucket: config.firebase.webStorageBucket,
        messagingSenderId: config.firebase.webMessagingSenderId,
        appId: config.firebase.webAppId
      },
      store: storeSettings,
      env: config.env
    });
  } catch (err) {
    next(err);
  }
});

// Alias for public storefront config
router.get('/public-config', async (req, res, next) => {
  try {
    const storeSettings = await storeSettingsService.getStoreSettings();
    return sendSuccess(res, {
      storeName: storeSettings.storeName || 'The Lane4 Performance Store',
      city: storeSettings.city || 'Nagpur',
      paymentSettings: { upiId: 'lane4swim@upi' },
      store: storeSettings
    });
  } catch (err) {
    next(err);
  }
});

// System health check
router.get('/health', (req, res) => {
  const envStatus = checkEnvironmentStatus();
  return sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    integrations: envStatus
  });
});

// Store profile
router.get('/store/settings', async (req, res, next) => {
  try {
    const settings = await storeSettingsService.getStoreSettings();
    return sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

// Store payment settings alias
router.get(['/store/payment-settings', '/payments/settings'], async (req, res, next) => {
  try {
    const settings = await paymentService.getPublicPaymentSettings();
    return sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
