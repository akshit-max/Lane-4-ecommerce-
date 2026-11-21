const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { validateRequest } = require('../middleware/validateRequest');
const { enquiryValidator } = require('../validators');

router.post(
  '/',
  enquiryValidator,
  validateRequest,
  enquiryController.submitEnquiry
);

module.exports = router;

