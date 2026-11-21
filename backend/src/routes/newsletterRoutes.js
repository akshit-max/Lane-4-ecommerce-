const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');
const { validateRequest } = require('../middleware/validateRequest');
const { newsletterValidator } = require('../validators');

router.post(
  '/subscribe',
  newsletterValidator,
  validateRequest,
  newsletterController.subscribe
);

module.exports = router;

