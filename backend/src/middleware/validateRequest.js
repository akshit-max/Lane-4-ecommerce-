const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Validates request schema via express-validator
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(
      res,
      'VALIDATION_FAILED',
      'One or more input fields failed validation.',
      errors.array().map(err => ({ field: err.path || err.param, message: err.msg })),
      400
    );
  }
  next();
}

module.exports = {
  validateRequest
};

