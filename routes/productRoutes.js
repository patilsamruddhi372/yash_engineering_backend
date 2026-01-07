const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  patchProduct,
  deleteProduct,
  toggleStatus,
  toggleFeatured,
  toggleCertified,
  togglePopular,
  bulkUpdate,
  bulkDelete,
  getProductsByCategory,
  getFeaturedProducts,
  getPopularProducts,
  getCertifiedProducts,
  getTrendingProducts,
  getRecentProducts,
  searchProducts,
  getCategoryStats,
  getProductCategories,
  incrementViews,
  incrementDownloads,
  updateRating
} = require('../controller/productController');

// ╔════════════════════════════════════════════════════════════╗
// ║                    PRODUCT ROUTES                          ║
// ╚════════════════════════════════════════════════════════════╝

// ===== STATS & ANALYTICS =====
router.get('/stats/categories', getCategoryStats);
router.get('/categories/list', getProductCategories);

// ===== FILTERED & SPECIAL LISTS =====
router.get('/filter/featured', getFeaturedProducts);
router.get('/filter/popular', getPopularProducts);
router.get('/filter/certified', getCertifiedProducts);
router.get('/filter/trending', getTrendingProducts);
router.get('/filter/recent', getRecentProducts);
router.get('/filter/category/:category', getProductsByCategory);

// ===== SEARCH =====
router.get('/search', searchProducts);

// ===== BASE ROUTES =====
router.route('/')
  .get(getProducts)      // Get all products with optional filters
  .post(createProduct);  // Create new product

// ===== BULK OPERATIONS =====
router.post('/bulk-update', bulkUpdate);
router.post('/bulk-delete', bulkDelete);

// ===== SINGLE PRODUCT ROUTES =====
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)       // Full update
  .patch(patchProduct)      // Partial update
  .delete(deleteProduct);

// ===== QUICK TOGGLE ACTIONS =====
router.patch('/:id/toggle/status', toggleStatus);
router.patch('/:id/toggle/featured', toggleFeatured);
router.patch('/:id/toggle/certified', toggleCertified);
router.patch('/:id/toggle/popular', togglePopular);

// ===== ANALYTICS ACTIONS =====
router.post('/:id/views', incrementViews);
router.post('/:id/downloads', incrementDownloads);
router.post('/:id/rating', updateRating);

module.exports = router;