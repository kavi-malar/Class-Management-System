/**
 * Room Allocation Controller — v3
 *
 * GET  /api/rooms              → get all rooms (all roles)
 * GET  /api/rooms/stats        → projector inventory stats (all roles)
 * POST /api/rooms/:id/occupy   → mark room occupied (teacher or cr only)
 * POST /api/rooms/:id/free     → mark room free (teacher or cr only)
 * POST /api/rooms/:id/projector/checkout → CR checks out projector
 * POST /api/rooms/:id/projector/return   → CR returns projector
 * PUT  /api/rooms              → admin seeds/updates rooms
 */
const RoomAllocation     = require('../models/RoomAllocation');
const ProjectorInventory = require('../models/ProjectorInventory');

// ── helpers ──────────────────────────────────────────────────────────────────

async function getInventory() {
  let inv = await ProjectorInventory.findOne();
  if (!inv) inv = await ProjectorInventory.create({ totalProjectors: 10, availableProjectors: 10 });
  return inv;
}

// ── GET /api/rooms ────────────────────────────────────────────────────────────
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
exports.occupyRoom = async (req, res) => {
  try {
    const { occupiedByClass, occupancyLabel } = req.body;
    if (!occupiedByClass) {
      return res.status(400).json({ success: false, message: 'occupiedByClass is required' });
    }

    const room = await RoomAllocation.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.status === 'occupied') {
      return res.status(400).json({
        success: false,
        message: `Room ${room.roomNumber} is already occupied by ${room.occupiedByClass}`
      });
    }

    room.status          = 'occupied';
    room.occupiedByClass = occupiedByClass;
    room.occupancyLabel  = occupancyLabel || occupiedByClass;
    room.lastUpdatedBy   = req.user._id;
    room.lastUpdatedAt   = new Date();
    await room.save();

    const populated = await RoomAllocation.findById(room._id).populate('lastUpdatedBy', 'name role');
    res.json({ success: true, message: `Room ${room.roomNumber} marked occupied`, room: populated });
  } catch (err) {
    console.error('occupyRoom error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/rooms/:roomNumber/free ──────────────────────────────────────────
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

    room.status          = 'free';
    room.occupiedByClass = null;
    room.occupancyLabel  = null;
    room.projectorPresent = false;
    room.lastUpdatedBy   = req.user._id;
    room.lastUpdatedAt   = new Date();
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
    if (room.status !== 'occupied') {
      return res.status(400).json({ success: false, message: 'Room must be occupied before checking out a projector' });
    }
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
    const User      = require('../models/User');
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
