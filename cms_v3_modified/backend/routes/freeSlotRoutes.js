const express = require('express');
const router  = express.Router();
const {
  getMyPeriodsForDate,
  createFreeSlot,
  withdrawFreeSlot,
  getFreeSlots,
} = require('../controllers/freeSlotController');
const { protect, authorize } = require('../middleware/auth');

router.get('/my-periods',        protect, authorize('teacher'), getMyPeriodsForDate);
router.get('/',                  protect, getFreeSlots);
router.post('/',                 protect, authorize('teacher'), createFreeSlot);
router.patch('/:id/withdraw',    protect, authorize('teacher'), withdrawFreeSlot);

module.exports = router;
