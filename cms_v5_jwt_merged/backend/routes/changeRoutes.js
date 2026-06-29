const express = require('express');
const router  = express.Router();
const {
  createChange,
  restoreChange,
  getChanges,
  deleteChange,
  getOfferableSlots,
} = require('../controllers/changeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/offerable',       protect, authorize('teacher'), getOfferableSlots); // Feature 1 — MUST be before /:id routes
router.get('/',                protect, getChanges);
router.post('/',               protect, authorize('teacher'), createChange);
router.patch('/:id/restore',   protect, authorize('teacher'), restoreChange);
router.delete('/:id',          protect, authorize('teacher'), deleteChange);

module.exports = router;
