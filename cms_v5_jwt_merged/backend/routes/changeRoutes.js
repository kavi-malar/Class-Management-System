const express = require('express');
const router  = express.Router();
const {
  createChange,
  restoreChange,
  getChanges,
  deleteChange,
  getOfferableSlots,
  getMyHistory,
} = require('../controllers/changeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/offerable',       protect, authorize('teacher'), getOfferableSlots); // MUST be before /:id routes
router.get('/my-history',      protect, authorize('teacher'), getMyHistory);       // Feature 3 — full teacher history
router.get('/',                protect, getChanges);
router.post('/',               protect, authorize('teacher'), createChange);
router.patch('/:id/restore',   protect, authorize('teacher'), restoreChange);
router.delete('/:id',          protect, authorize('teacher'), deleteChange);

module.exports = router;
