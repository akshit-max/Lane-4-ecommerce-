/**
 * User and Administrator Roles
 */
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ORDER_MANAGER: 'order_manager',
  PRODUCT_MANAGER: 'product_manager',
  INVENTORY_MANAGER: 'inventory_manager',
  CUSTOMER: 'customer'
};

const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.ORDER_MANAGER,
  ROLES.PRODUCT_MANAGER,
  ROLES.INVENTORY_MANAGER
];

module.exports = {
  ROLES,
  ADMIN_ROLES
};

