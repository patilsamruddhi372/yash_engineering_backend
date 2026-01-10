const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsage
} = require('../controller/categoryController');

// Get all categories
router.get('/', getCategories);

// Get category usage stats
router.get('/usage', getCategoryUsage);

// CRUD operations for a specific category
router.route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

// Create a new category
router.post('/', createCategory);

module.exports = router;