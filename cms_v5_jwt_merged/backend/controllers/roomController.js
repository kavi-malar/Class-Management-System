/**
 * Room Allocation Controller — v4
 *
 * GET  /api/rooms              → get all rooms (all roles) — legacy, uses DB state
 * GET  /api/rooms/status       → NEW: dynamic room status from timetable
 * GET  /api/rooms/current      → NEW: alias for /status
 * GET  /api/rooms/stats        → projector inventory stats (all roles)
 * GET  /api/rooms/cancellations/today → NEW: today's cancelled classes
 * POST /api/rooms/:id/occupy   → mark room occupied (teacher or cr only)
 * POST /api/rooms/:id/free     → mark room free (teacher or cr only)
 * POST /api/rooms/:id/projector/checkout → CR checks out projector
 * POST /api/rooms/:id/projector/return   → CR returns projector
 * PUT  /api/rooms              → admin seeds/updates rooms
 */
const RoomAllocation     = require('../models/RoomAllocation');
const ProjectorInventory = require('../models/ProjectorInventory');
const roomStatusService  = require('../services/roomStatusService');

// ── helpers ──────────────────────────────────────────────────────────────────

async function getInventory() {
  let inv = await ProjectorInventory.findOne();
  if (!inv) inv = await ProjectorInventory.create({ totalProjectors: 10, availableProjectors: 10 });
  return inv;
}

// ── GET /api/rooms ────────────────────────────────────────────────────────────
// Legacy endpoint — returns raw DB rooms (manual state only)
exports.getRooms = async (req, res) => {
  try {
    const rooms = await RoomAllocation.find()
      .populate('lastUpdatedBy', 'name role')
      .sort({ roomNumber: 1 });
    const inventory = await getInventory();
    res.json({ success: true, rooms, projectorInventory: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching rooms' });
  }
};

// ── GET /api/rooms/status ─────────────────────────────────────────────────────
// NEW: Dynamic room status computed from timetable + manual bookings + cancellations
exports.getRoomStatus = async (req, res) => {
  try {
    const now   = new Date();
    const rooms = await roomStatusService.computeRoomStatuses(now);
    const counters = roomStatusService.computeCounters(rooms);
    const inventory = await getInventory();
    const currentPeriod = roomStatusService.getCurrentPeriod(now);
    const periodInfo = currentPeriod ? roomStatusService.PERIOD_TIMES[currentPeriod] : null;

    res.json({
      success: true,
      rooms,
      counters,
      projectorInventory: inventory,
      meta: {
        currentPeriod,
        periodInfo,
        computedAt: now,
        dayName: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]
      }
    });
  } catch (err) {
    console.error('getRoomStatus error:', err);
    res.status(500).json({ success: false, message: 'Error computing room status' });
  }
};

// ── GET /api/rooms/cancellations/today ────────────────────────────────────────
// NEW: All cancelled classes for today — visible to ALL teachers/roles
exports.getTodayCancellations = async (req, res) => {
  try {
    const cancellations = await roomStatusService.getTodayCancellations(new Date());
    res.json({ success: true, cancellations, count: cancellations.length });
  } catch (err) {
    console.error('getTodayCancellations error:', err);
    res.status(500).json({ success: false, message: 'Error fetching cancellations' });
  }
};

// ── GET /api/rooms/stats ──────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const rooms     = await RoomAllocation.find();
    const inventory = await getInventory();
    const stats = {
      totalRooms:     rooms.length,
      occupiedRooms:  rooms.filter(r => r.status === 'occupied').length,
      freeRooms:      rooms.filter(r => r.status === 'free').length,
      totalProjectors:     inventory.totalProjectors,
      availableProjectors: inventory.availableProjectors,
      checkedOutProjectors: inventory.totalProjectors - inventory.availableProjectors
    };
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
};

// ── POST /api/rooms/:roomNumber/occupy ────────────────────────────────────────
// Updated to set manualBooking = true
exports.occupyRoom = async (req, res) => {
  try {
    const { occupiedByClass, occupancyLabel, note } = req.body;
    if (!occupiedByClass) {
      return res.status(400).json({ success: false, message: 'occupiedByClass is required' });
    }

    const room = await RoomAllocation.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.status === 'occupied' && room.manualBooking) {
      return res.status(400).json({
        success: false,
        message: `Room ${room.roomNumber} is already manually booked by ${room.occupiedByClass}`
      });
    }

    room.status            = 'occupied';
    room.occupiedByClass   = occupiedByClass;
    room.occupancyLabel    = occupancyLabel || occupiedByClass;
    room.manualBooking     = true;
    room.manualBookingNote = note || null;
    room.lastUpdatedBy     = req.user._id;
    room.lastUpdatedAt     = new Date();
    await room.save();

    const populated = await RoomAllocation.findById(room._id).populate('lastUpdatedBy', 'name role');
    res.json({ success: true, message: `Room ${room.roomNumber} manually booked`, room: populated });
  } catch (err) {
    console.error('occupyRoom error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/rooms/:roomNumber/free ──────────────────────────────────────────
// Updated to clear manualBooking flag
exports.freeRoom = async (req, res) => {
  try {
    const room = await RoomAllocation.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // If a projector was checked out to this room, return it automatically
    if (room.projectorPresent) {
      const inv = await getInventory();
      inv.availableProjectors = Math.min(inv.totalProjectors, inv.availableProjectors + 1);
      await inv.save();
    }

    room.status            = 'free';
    room.occupiedByClass   = null;
    room.occupancyLabel    = null;
    room.projectorPresent  = false;
    room.manualBooking     = false;
    room.manualBookingNote = null;
    room.lastUpdatedBy     = req.user._id;
    room.lastUpdatedAt     = new Date();
    await room.save();

    const populated = await RoomAllocation.findById(room._id).populate('lastUpdatedBy', 'name role');
    res.json({ success: true, message: `Room ${room.roomNumber} is now free`, room: populated });
  } catch (err) {
    console.error('freeRoom error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/rooms/:roomNumber/projector/checkout ────────────────────────────
exports.checkoutProjector = async (req, res) => {
  try {
    const room = await RoomAllocation.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.projectorPresent) {
      return res.status(400).json({ success: false, message: 'Room already has a projector' });
    }

    const inv = await getInventory();
    if (inv.availableProjectors <= 0) {
      return res.status(400).json({ success: false, message: 'No projectors available. All are checked out.' });
    }

    inv.availableProjectors -= 1;
    await inv.save();

    room.projectorPresent = true;
    room.lastUpdatedBy    = req.user._id;
    room.lastUpdatedAt    = new Date();
    await room.save();

    const populated = await RoomAllocation.findById(room._id).populate('lastUpdatedBy', 'name role');
    res.json({
      success: true,
      message: `Projector checked out to Room ${room.roomNumber}. ${inv.availableProjectors} remaining.`,
      room: populated,
      projectorInventory: inv
    });
  } catch (err) {
    console.error('checkoutProjector error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/rooms/:roomNumber/projector/return ──────────────────────────────
exports.returnProjector = async (req, res) => {
  try {
    const room = await RoomAllocation.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!room.projectorPresent) {
      return res.status(400).json({ success: false, message: 'No projector to return from this room' });
    }

    const inv = await getInventory();
    inv.availableProjectors = Math.min(inv.totalProjectors, inv.availableProjectors + 1);
    await inv.save();

    room.projectorPresent = false;
    room.lastUpdatedBy    = req.user._id;
    room.lastUpdatedAt    = new Date();
    await room.save();

    const populated = await RoomAllocation.findById(room._id).populate('lastUpdatedBy', 'name role');
    res.json({
      success: true,
      message: `Projector returned from Room ${room.roomNumber}. ${inv.availableProjectors} now available.`,
      room: populated,
      projectorInventory: inv
    });
  } catch (err) {
    console.error('returnProjector error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/rooms/admin/overview ─────────────────────────────────────────────
exports.adminOverview = async (req, res) => {
  try {
    const rooms     = await RoomAllocation.find().populate('lastUpdatedBy', 'name role').sort({ roomNumber: 1 });
    const inventory = await getInventory();
    const User         = require('../models/User');
    const ClassSection = require('../models/ClassSection');

    const [totalUsers, totalClasses, teachers, students] = await Promise.all([
      User.countDocuments({ isActive: true }),
      ClassSection.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'student', isActive: true }),
    ]);

    res.json({
      success: true,
      rooms,
      projectorInventory: inventory,
      systemStats: { totalUsers, totalClasses, teachers, students }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching admin overview' });
  }
};
