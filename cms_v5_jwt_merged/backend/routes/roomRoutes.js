const express = require('express');
const router  = express.Router();
const {
  getRooms, getRoomStatus, getTodayCancellations,
  getStats, occupyRoom, freeRoom,
  checkoutProjector, returnProjector, adminOverview
} = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

// ── Read endpoints (all authenticated users) ──────────────────────────────────
router.get('/',                       protect, getRooms);
router.get('/status',                 protect, getRoomStatus);       // NEW: dynamic status
router.get('/current',                protect, getRoomStatus);       // NEW: alias
router.get('/stats',                  protect, getStats);
router.get('/cancellations/today',    protect, getTodayCancellations); // NEW: cancellations

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/overview',         protect, authorize('admin'), adminOverview);

// ── Write endpoints (teacher or CR) ──────────────────────────────────────────
router.post('/:roomNumber/occupy',              protect, authorize('teacher', 'cr'), occupyRoom);
router.post('/:roomNumber/free',               protect, authorize('teacher', 'cr'), freeRoom);

// ── Projector (CR only) ───────────────────────────────────────────────────────
router.post('/:roomNumber/projector/checkout', protect, authorize('cr'), checkoutProjector);
router.post('/:roomNumber/projector/return',   protect, authorize('cr'), returnProjector);

module.exports = router;
