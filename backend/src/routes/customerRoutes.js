const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/authenticate');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.use(authenticate);

router.get('/profile', customerController.getProfile);
router.patch('/profile', customerController.updateProfile);

router.get('/addresses', customerController.listAddresses);
router.post(
  '/addresses',
  [
    body('addressee').notEmpty().withMessage('Addressee name is required'),
    body('addressLine1').notEmpty().withMessage('Street address is required'),
    body('postalCode').notEmpty().withMessage('Postal code is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required')
  ],
  validateRequest,
  customerController.addAddress
);
router.delete('/addresses/:id', customerController.deleteAddress);

module.exports = router;

