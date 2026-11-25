const { sendError } = require('../utils/response');
const { ROLE_PERMISSIONS } = require('../constants/roles');

/**
 * Check if admin user has specific operational permission.
 * Accepts one or multiple permissions. User must possess at least one of the specified permissions.
 */
function requirePermission(...requiredPermissions) {
  const allowed = requiredPermissions.flat();
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required.', null, 401);
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin' || (req.user.permissions && req.user.permissions.includes('super_admin'))) {
      return next();
    }

    const rolePerms = (req.user.role && ROLE_PERMISSIONS[req.user.role]) || [];
    const userPerms = req.user.permissions || [];
    const effectivePermissions = [...new Set([...userPerms, ...rolePerms])];

    const hasPermission = allowed.some(p => effectivePermissions.includes(p));

    if (!hasPermission) {
      return sendError(
        res,
        'INSUFFICIENT_PERMISSIONS',
        `User does not possess required permission (${allowed.join(' or ')}).`,
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

