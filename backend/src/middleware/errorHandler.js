const { logger } = require('../utils/logger');
const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled Server Error', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'FILE_TOO_LARGE', 'Uploaded image exceeds maximum size of 5 MB.', null, 400);
    }
    return sendError(res, 'UPLOAD_ERROR', err.message, null, 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  return sendError(res, code, message, null, statusCode);
}

module.exports = {
  errorHandler
};

