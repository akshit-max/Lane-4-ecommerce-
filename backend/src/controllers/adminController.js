const adminDashboardService = require('../services/adminDashboardService');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const productService = require('../services/productService');
const categoryService = require('../services/categoryService');
const inventoryService = require('../services/inventoryService');
const couponService = require('../services/couponService');
const shippingService = require('../services/shippingService');
const storeSettingsService = require('../services/storeSettingsService');
const enquiryService = require('../services/enquiryService');
const reviewService = require('../services/reviewService');
const returnService = require('../services/returnService');
const gstInvoiceService = require('../services/gstInvoiceService');
const { csvExportService } = require('../services/csvExportService');
const { uploadImageBuffer } = require('../config/cloudinary');
const { getDb } = require('../config/firebaseAdmin');
const { sendSuccess, sendError } = require('../utils/response');

class AdminController {
  async getDashboard(req, res, next) {
    try {
      const metrics = await adminDashboardService.getMetrics();
      return sendSuccess(res, metrics);
    } catch (err) {
      next(err);
    }
  }

  async listLogs(req, res, next) {
    try {
      const { page, limit } = req.query;
      const logs = await adminDashboardService.listActivityLogs(page, limit);
      return sendSuccess(res, logs);
    } catch (err) {
      next(err);
    }
  }

  // Orders
  async listOrders(req, res, next) {
    try {
      const orders = await orderService.listAllOrders(req.query);
      return sendSuccess(res, orders);
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req, res, next) {
    try {
      const order = await orderService.getOrderById(req.params.id);
      if (!order) return sendError(res, 'NOT_FOUND', 'Order not found', null, 404);
      return sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }

  async updateOrderStatus(req, res, next) {
    try {
      const { status } = req.body;
      const result = await orderService.updateOrderStatus(req.params.id, status, req.user);
      return sendSuccess(res, result, `Order status updated to ${status}.`);
    } catch (err) {
      next(err);
    }
  }

  async processRefund(req, res, next) {
    try {
      const { refundReference, notes } = req.body;
      const result = await orderService.processRefund(req.params.id, req.user, { refundReference, notes });
      return sendSuccess(res, result, 'Refund recorded and processed successfully.');
    } catch (err) {
      next(err);
    }
  }

  async addTracking(req, res, next) {
    try {
      const result = await orderService.addTrackingInfo(req.params.id, req.body, req.user);
      return sendSuccess(res, result, 'Courier tracking details updated.');
    } catch (err) {
      next(err);
    }
  }

  // Payments
  async listPayments(req, res, next) {
    try {
      const payments = await paymentService.listPayments(req.query);
      return sendSuccess(res, payments);
    } catch (err) {
      next(err);
    }
  }

  async getPayment(req, res, next) {
    try {
      const payment = await paymentService.getPaymentById(req.params.id);
      if (!payment) {
        return sendError(res, 'NOT_FOUND', 'Payment record not found.', null, 404);
      }
      return sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  }

  async approvePayment(req, res, next) {
    try {
      const internalNote = (req.body.internalNote || req.body.approvalNote || req.body.note || '').trim();
      const result = await paymentService.approvePayment(req.params.id, req.user, internalNote);
      return sendSuccess(res, result, 'Payment verified and approved.');
    } catch (err) {
      next(err);
    }
  }

  async rejectPayment(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await paymentService.rejectPayment(req.params.id, req.user, reason);
      return sendSuccess(res, result, 'Payment rejected with staff feedback.');
    } catch (err) {
      next(err);
    }
  }

  async uploadPaymentProof(req, res, next) {
    try {
      if (!req.file) {
        return sendError(res, 'FILE_REQUIRED', 'Please select a screenshot file to upload.', null, 400);
      }
      const paymentId = req.params.id;
      const db = getDb();
      const paymentRef = db.collection('payments').doc(paymentId);
      const paymentDoc = await paymentRef.get();
      if (!paymentDoc.exists) {
        return sendError(res, 'NOT_FOUND', 'Payment record not found.', null, 404);
      }

      const uploadResult = await uploadImageBuffer(req.file.buffer, {
        folder: 'payment_proofs',
        mimeType: req.file.mimetype,
        isPrivate: false
      });

      const existingData = paymentDoc.data();
      const priorHistory = Array.isArray(existingData.proofHistory) ? [...existingData.proofHistory] : [];
      if (existingData.proofScreenshot && (existingData.proofScreenshot.secureUrl || existingData.proofScreenshot.url)) {
        const oldUrl = existingData.proofScreenshot.secureUrl || existingData.proofScreenshot.url;
        const oldPublicId = existingData.proofScreenshot.publicId || null;
        const isDuplicate = priorHistory.some(h =>
          (h.secureUrl && h.secureUrl === oldUrl) ||
          (oldPublicId && h.publicId && h.publicId === oldPublicId)
        );
        if (!isDuplicate) {
          priorHistory.push({
            publicId: oldPublicId,
            secureUrl: oldUrl,
            upiReferenceNumber: existingData.upiReferenceNumber || null,
            uploadedAt: existingData.proofScreenshot.uploadedAt || existingData.updatedAt || new Date(),
            supersededAt: new Date(),
            uploadedBy: req.user?.email || req.user?.uid || 'admin'
          });
        }
      }

      await paymentRef.update({
        proofScreenshot: {
          publicId: uploadResult.publicId,
          secureUrl: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
        proofHistory: priorHistory,
        updatedAt: new Date()
      });

      return sendSuccess(res, uploadResult, 'Payment proof screenshot updated');
    } catch (err) {
      next(err);
    }
  }

  // Products
  async listProducts(req, res, next) {
    try {
      const result = await productService.listProducts({ ...req.query, onlyPublished: false });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.body, req.user);
      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body, req.user);
      return sendSuccess(res, product, 'Product updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const result = await productService.deleteProduct(req.params.id, req.user);
      return sendSuccess(res, result, 'Product archived successfully');
    } catch (err) {
      next(err);
    }
  }

  async uploadProductImage(req, res, next) {
    try {
      if (!req.file) {
        return sendError(res, 'FILE_REQUIRED', 'Please select an image file to upload.', null, 400);
      }
      const result = await uploadImageBuffer(req.file.buffer, {
        folder: 'products',
        mimeType: req.file.mimetype
      });
      return sendSuccess(res, result, 'Image uploaded to Cloudinary');
    } catch (err) {
      next(err);
    }
  }

  // Categories
  async listCategories(req, res, next) {
    try {
      const categories = await categoryService.listCategories();
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.body);
      return sendSuccess(res, category, 'Category created', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      return sendSuccess(res, category, 'Category updated');
    } catch (err) {
      next(err);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await categoryService.deleteCategory(req.params.id);
      return sendSuccess(res, result, 'Category deleted');
    } catch (err) {
      next(err);
    }
  }

  // Inventory
  async listInventory(req, res, next) {
    try {
      const items = await inventoryService.listInventory(req.query);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { adjustmentQuantity, type, reason } = req.body;
      const result = await inventoryService.adjustStock(req.params.sku, { adjustmentQuantity, type, reason }, req.user);
      return sendSuccess(res, result, 'Inventory stock balance updated.');
    } catch (err) {
      next(err);
    }
  }

  // Coupons
  async listCoupons(req, res, next) {
    try {
      const coupons = await couponService.listCoupons();
      return sendSuccess(res, coupons);
    } catch (err) {
      next(err);
    }
  }

  async createCoupon(req, res, next) {
    try {
      const coupon = await couponService.createCoupon(req.body);
      return sendSuccess(res, coupon, 'Coupon created', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateCoupon(req, res, next) {
    try {
      const coupon = await couponService.updateCoupon(req.params.id, req.body);
      return sendSuccess(res, coupon, 'Coupon updated');
    } catch (err) {
      next(err);
    }
  }

  async deleteCoupon(req, res, next) {
    try {
      const result = await couponService.deleteCoupon(req.params.id);
      return sendSuccess(res, result, 'Coupon deleted');
    } catch (err) {
      next(err);
    }
  }

  // Settings
  async getPaymentSettings(req, res, next) {
    try {
      const settings = await paymentService.getPublicPaymentSettings();
      return sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  }

  async updatePaymentSettings(req, res, next) {
    try {
      const settings = await paymentService.updatePaymentSettings(req.body, req.user);
      return sendSuccess(res, settings, 'Payment & QR configuration updated.');
    } catch (err) {
      next(err);
    }
  }

  async uploadPaymentQrImage(req, res, next) {
    try {
      const file = req.file || (req.files && (req.files.qrImage?.[0] || req.files.image?.[0] || req.files.file?.[0]));
      if (!file) {
        return sendError(res, 'FILE_REQUIRED', 'Please select a QR code image to upload.', null, 400);
      }

      const uploadResult = await uploadImageBuffer(file.buffer, {
        folder: 'store_qr',
        mimeType: file.mimetype,
        isPrivate: false
      });

      const updatedSettings = await paymentService.updatePaymentSettings({
        qrCodeImage: {
          publicId: uploadResult.publicId,
          url: uploadResult.secureUrl,
          uploadedAt: new Date()
        },
        qrCodeUrl: uploadResult.secureUrl
      }, req.user);

      return sendSuccess(res, {
        qrCodeUrl: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        settings: updatedSettings
      }, 'UPI QR code image uploaded and active in checkout');
    } catch (err) {
      next(err);
    }
  }

  async updateShippingSettings(req, res, next) {
    try {
      const settings = await shippingService.updateShippingSettings(req.body);
      return sendSuccess(res, settings, 'Shipping settings updated.');
    } catch (err) {
      next(err);
    }
  }

  async updateStoreSettings(req, res, next) {
    try {
      const settings = await storeSettingsService.updateStoreSettings(req.body, req.user);
      return sendSuccess(res, settings, 'Store profile updated.');
    } catch (err) {
      next(err);
    }
  }

  // Customers
  async listCustomers(req, res, next) {
    try {
      const db = getDb();
      const snap = await db.collection('users').get();
      let customers = snap.docs.map(d => ({ ...d.data(), id: d.id }));

      // Filter out administrator accounts
      customers = customers.filter(c => {
        const email = (c.email || '').toLowerCase();
        return !email.startsWith('admin_') && !email.startsWith('admin@') && c.role !== 'admin' && c.role !== 'super_admin';
      });

      // Sort newest customers at the top
      customers.sort((a, b) => {
        const getT = (doc) => {
          if (!doc || !doc.createdAt) return 0;
          if (typeof doc.createdAt.toMillis === 'function') return doc.createdAt.toMillis();
          if (doc.createdAt._seconds !== undefined) return doc.createdAt._seconds * 1000;
          if (doc.createdAt.seconds !== undefined) return doc.createdAt.seconds * 1000;
          const t = new Date(doc.createdAt).getTime();
          return isNaN(t) ? 0 : t;
        };
        return getT(b) - getT(a);
      });

      if (req.query.search) {
        const s = req.query.search.toLowerCase().trim();
        customers = customers.filter(c =>
          (c.email && c.email.toLowerCase().includes(s)) ||
          (c.displayName && c.displayName.toLowerCase().includes(s)) ||
          (c.phoneNumber && c.phoneNumber.includes(s))
        );
      }
      return sendSuccess(res, customers);
    } catch (err) {
      next(err);
    }
  }

  // Enquiries
  async listEnquiries(req, res, next) {
    try {
      const enquiries = await enquiryService.listEnquiries(req.query);
      return sendSuccess(res, enquiries);
    } catch (err) {
      next(err);
    }
  }

  async updateEnquiry(req, res, next) {
    try {
      const result = await enquiryService.updateEnquiryStatus(req.params.id, req.body, req.user);
      return sendSuccess(res, result, 'Enquiry updated.');
    } catch (err) {
      next(err);
    }
  }

  // Reviews
  async listReviews(req, res, next) {
    try {
      const reviews = await reviewService.listAdminReviews(req.query);
      return sendSuccess(res, reviews);
    } catch (err) {
      next(err);
    }
  }

  async moderateReview(req, res, next) {
    try {
      const { status } = req.body;
      const result = await reviewService.moderateReview(req.params.id, status, req.user);
      return sendSuccess(res, result, `Review ${status}.`);
    } catch (err) {
      next(err);
    }
  }

  async deleteReview(req, res, next) {
    try {
      const result = await reviewService.deleteReview(req.params.id);
      return sendSuccess(res, result, 'Review deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  // Returns
  async listReturns(req, res, next) {
    try {
      const returns = await returnService.listAdminReturns(req.query);
      return sendSuccess(res, returns);
    } catch (err) {
      next(err);
    }
  }

  async updateReturn(req, res, next) {
    try {
      const result = await returnService.updateReturnStatus(req.params.id, req.body, req.user);
      return sendSuccess(res, result, 'Return request updated.');
    } catch (err) {
      next(err);
    }
  }

  // GST Invoice
  async getOrderInvoice(req, res, next) {
    try {
      const invoice = await gstInvoiceService.getOrCreateInvoice(req.params.id, req.user);
      return sendSuccess(res, invoice, 'GST tax invoice retrieved successfully.');
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'INVOICE_ERROR',
            message: err.message
          }
        });
      }
      next(err);
    }
  }

  // Data Exports
  async exportOrders(req, res, next) {
    try {
      await csvExportService.exportOrders(res, req.query);
    } catch (err) {
      next(err);
    }
  }

  async exportInventory(req, res, next) {
    try {
      await csvExportService.exportInventory(res, req.query);
    } catch (err) {
      next(err);
    }
  }

  async exportCustomers(req, res, next) {
    try {
      await csvExportService.exportCustomers(res, req.query);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();

