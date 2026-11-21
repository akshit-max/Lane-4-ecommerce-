const enquiryService = require('../services/enquiryService');
const { sendSuccess } = require('../utils/response');

class EnquiryController {
  async submitEnquiry(req, res, next) {
    try {
      const { type, name, email, phone, message } = req.body;
      const enquiry = await enquiryService.submitEnquiry({ type, name, email, phone, message });
      return sendSuccess(res, enquiry, 'Thank you! Your message has been received.', 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EnquiryController();

