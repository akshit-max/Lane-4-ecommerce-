const categoryService = require('../services/categoryService');
const productService = require('../services/productService');
const { sendSuccess } = require('../utils/response');

class CategoryController {
  async listCategories(req, res, next) {
    try {
      const categories = await categoryService.listCategories();
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  async getCategoryBySlug(req, res, next) {
    try {
      const category = await categoryService.getCategoryBySlug(req.params.slug);
      if (!category) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
      }
      return sendSuccess(res, category);
    } catch (err) {
      next(err);
    }
  }

  async getCategoryProducts(req, res, next) {
    try {
      const { slug } = req.params;
      const result = await productService.listProducts({
        categorySlug: slug,
        page: req.query.page,
        limit: req.query.limit
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CategoryController();

