const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Validates request schema via express-validator
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({ field: err.path || err.param, message: err.msg }));
    const specificMessage = errorDetails.map(e => e.message).filter(Boolean).join('. ') || 'One or more input fields failed validation.';
    return sendError(
      res,
      'VALIDATION_FAILED',
      specificMessage,
      errorDetails,
      400
    );
  }
  next();
}

module.exports = {
  validateRequest
};

