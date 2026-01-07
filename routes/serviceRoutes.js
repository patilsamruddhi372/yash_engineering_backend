const express = require('express');
const router = express.Router();
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  patchService,
  deleteService,
  toggleStatus,
  toggleFeatured,
  bulkDelete,
  getStats
} = require('../controller/serviceController');

// ╔════════════════════════════════════════════════════════════╗
// ║                    SERVICE ROUTES                          ║
// ╚════════════════════════════════════════════════════════════╝

// Stats
router.get('/stats', getStats);

// Bulk operations
router.post('/bulk-delete', bulkDelete);

// Base routes
router.route('/')
  .get(getServices)
  .post(createService);

// Single service routes
router.route('/:id')
  .get(getServiceById)
  .put(updateService)
  .patch(patchService)
  .delete(deleteService);

// Quick actions
router.patch('/:id/status', toggleStatus);
router.patch('/:id/featured', toggleFeatured);

module.exports = router;