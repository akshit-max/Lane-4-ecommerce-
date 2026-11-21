const { sendError } = require('../utils/response');

function notFound(req, res) {
  return sendError(
    res,
    'RESOURCE_NOT_FOUND',
    `Cannot ${req.method} ${req.originalUrl}`,
    null,
    404
  );
}

module.exports = {
  notFound
};

