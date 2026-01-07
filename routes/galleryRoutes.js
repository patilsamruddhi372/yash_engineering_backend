const express = require('express');
const router = express.Router();
const {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage
} = require('../controller/galleryController');

router.get('/', getGalleryImages);
router.get('/:id', getGalleryImage);
router.post('/', createGalleryImage);
router.put('/:id', updateGalleryImage);
router.delete('/:id', deleteGalleryImage);

module.exports = router;