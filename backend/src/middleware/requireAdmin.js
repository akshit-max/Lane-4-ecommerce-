const { sendError } = require('../utils/response');
const { ADMIN_ROLES } = require('../constants');

/**
 * Require valid administrator role
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required.', null, 401);
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return sendError(res, 'FORBIDDEN', 'Access restricted to authorized store staff.', null, 403);
  }

  next();
}

module.exports = {
  requireAdmin,
  ADMIN_ROLES
};

