const express = require('express');
const router = express.Router();
const {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  getImagesByCategory,
  getCategoryCounts
} = require('../controller/galleryController');

// Get all images
router.get('/', getGalleryImages);

// Get category counts
router.get('/categories/count', getCategoryCounts);

// Get images by category
router.get('/categories/:category', getImagesByCategory);

// CRUD operations for a specific image
router.route('/:id')
  .get(getGalleryImage)
  .put(updateGalleryImage)
  .delete(deleteGalleryImage);

// Create a new image
router.post('/', createGalleryImage);

module.exports = router;