const express = require('express');
const router  = express.Router();
const {
  createChange,
  restoreChange,
  getChanges,
  deleteChange
} = require('../controllers/changeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',            protect,                   getChanges);
router.post('/',           protect, authorize('teacher'), createChange);
router.patch('/:id/restore', protect, authorize('teacher'), restoreChange);   // ← NEW
router.delete('/:id',      protect, authorize('teacher'), deleteChange);

module.exports = router;
