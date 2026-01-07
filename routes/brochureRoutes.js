const express = require('express');
const router = express.Router();
const brochureController = require('../controllers/brochureController');
const upload = require('../middleware/upload');

// Public routes
router.get('/active', brochureController.getActiveBrochure);

// Admin routes (add auth middleware as needed)
router.post('/upload', upload.single('file'), brochureController.uploadBrochure);
router.get('/', brochureController.getAllBrochures);
router.get('/:id', brochureController.getBrochureById);
router.patch('/:id/activate', brochureController.activateBrochure);
router.delete('/:id', brochureController.deleteBrochure);

module.exports = router;