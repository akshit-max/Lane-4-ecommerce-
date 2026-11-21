const { registerValidator, loginValidator, adminLoginValidator } = require('./authValidators');
const { quoteValidator, createOrderValidator, updateOrderStatusValidator, addTrackingValidator } = require('./orderValidators');
const { submitProofValidator, rejectPaymentValidator } = require('./paymentValidators');
const { submitReviewValidator, moderateReviewValidator, createProductValidator } = require('./productValidators');
const { enquiryValidator, newsletterValidator } = require('./formValidators');

module.exports = {
  registerValidator,
  loginValidator,
  adminLoginValidator,
  quoteValidator,
  createOrderValidator,
  updateOrderStatusValidator,
  addTrackingValidator,
  submitProofValidator,
  rejectPaymentValidator,
  submitReviewValidator,
  moderateReviewValidator,
  createProductValidator,
  enquiryValidator,
  newsletterValidator
};

