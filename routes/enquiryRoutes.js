const express = require('express');
const router = express.Router();
const {
  getEnquiries,
  getEnquiry,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
  addResponse,
  toggleRead,
  toggleStar,
  exportEnquiries,
  bulkUpdate,
  bulkDelete,
  getStats
} = require('../controller/enquiryController');
// const { protect, adminOnly } = require('../middleware/auth'); // Auth disabled as per your request

// ⭐ PUBLIC ROUTE - Create enquiry (from contact form)
router.post('/', createEnquiry);

// ===== ALL ROUTES BELOW ARE NOW PUBLIC (NO AUTH REQUIRED) =====
// ⚠️ Re-enable authentication in production!
// router.use(protect);
// router.use(adminOnly);

// Stats route (must be before '/:id')
router.get('/stats', getStats);

// Export route
router.get('/export', exportEnquiries);

// Bulk operations (must be before '/:id' too)
router.put('/bulk', bulkUpdate);
router.post('/bulk/delete', bulkDelete);

// Main CRUD routes
router.get('/', getEnquiries);
router.get('/:id', getEnquiry);
router.put('/:id', updateEnquiry);
router.delete('/:id', deleteEnquiry);
router.post('/:id/responses', addResponse);
router.patch('/:id/read', toggleRead);
router.patch('/:id/star', toggleStar);

module.exports = router;