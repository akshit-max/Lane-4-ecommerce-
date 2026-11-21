/**
 * Standard API Response Handlers
 */

function sendSuccess(res, data = null, message = null, statusCode = 200) {
  const payload = {
    success: true
  };

  if (message) {
    payload.message = message;
  }

  if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
}

function sendError(res, code = 'INTERNAL_ERROR', message = 'An error occurred', details = null, statusCode = 500) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};

