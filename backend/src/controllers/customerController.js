const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

class CustomerController {
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getCustomerProfile(req.user.uid);
      return sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await authService.updateCustomerProfile(req.user.uid, req.body);
      return sendSuccess(res, profile, 'Profile updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  async listAddresses(req, res, next) {
    try {
      const addresses = await authService.listCustomerAddresses(req.user.uid);
      return sendSuccess(res, addresses);
    } catch (err) {
      next(err);
    }
  }

  async addAddress(req, res, next) {
    try {
      const address = await authService.addCustomerAddress(req.user.uid, req.body);
      return sendSuccess(res, address, 'Address added successfully.', 201);
    } catch (err) {
      next(err);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      const result = await authService.deleteCustomerAddress(req.user.uid, req.params.id);
      return sendSuccess(res, result, 'Address deleted.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();

