const express = require('express');
const router  = express.Router();
const {
  getRooms, getStats, occupyRoom, freeRoom,
  checkoutProjector, returnProjector, adminOverview
} = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

// All authenticated users can view rooms
router.get('/',              protect, getRooms);
router.get('/stats',         protect, getStats);
router.get('/admin/overview', protect, authorize('admin'), adminOverview);

// Only teacher or CR can change room status
router.post('/:roomNumber/occupy',              protect, authorize('teacher', 'cr'), occupyRoom);
router.post('/:roomNumber/free',               protect, authorize('teacher', 'cr'), freeRoom);
// Only CR can check out / return projectors
router.post('/:roomNumber/projector/checkout', protect, authorize('cr'), checkoutProjector);
router.post('/:roomNumber/projector/return',   protect, authorize('cr'), returnProjector);

module.exports = router;
