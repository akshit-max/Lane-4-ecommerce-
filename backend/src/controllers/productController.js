const productService = require('../services/productService');
const { sendSuccess } = require('../utils/response');

class ProductController {
  async listProducts(req, res, next) {
    try {
      const { category, featured, search, sort, page, limit } = req.query;
      const result = await productService.listProducts({
        categorySlug: category,
        featured,
        search,
        sort,
        page,
        limit
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getProductBySlug(req, res, next) {
    try {
      const product = await productService.getProductBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }
      return sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      }
      return sendSuccess(res, product);
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
}

module.exports = new ProductController();

