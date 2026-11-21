const { sendError } = require('../utils/response');

/**
 * Check if admin user has specific operational permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required.', null, 401);
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    const permissions = req.user.permissions || [];
    if (!permissions.includes(permission)) {
      return sendError(
        res,
        'INSUFFICIENT_PERMISSIONS',
        `User does not possess '${permission}' permission.`,
        null,
        403
      );
    }

    next();
  };
}

module.exports = {
  requirePermission
};

