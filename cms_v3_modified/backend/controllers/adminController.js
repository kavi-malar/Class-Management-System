/**
 * Admin Controller — v3
 *
 * Admin can:
 *  - View all classes and their timetables (monitoring, NO cancel)
 *  - Manage users (CRUD)
 *  - Manage class sections
 *  - View system-wide room allocation & projector status
 *  - Update projector total count
 */
const User           = require('../models/User');
const ClassSection   = require('../models/ClassSection');
const FixedTimetable = require('../models/FixedTimetable');
const TimetableChange = require('../models/TimetableChange');
const RoomAllocation = require('../models/RoomAllocation');
const ProjectorInventory = require('../models/ProjectorInventory');

// ── GET /api/admin/dashboard ─────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [
      totalUsers, teachers, students, crCount,
      totalClasses, rooms, inventory
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'cr',      isActive: true }),
      ClassSection.countDocuments({ isActive: true }),
      RoomAllocation.find().sort({ roomNumber: 1 }),
      ProjectorInventory.findOne()
    ]);

    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;

    res.json({
      success: true,
      stats: {
        totalUsers, teachers, students, crCount,
        totalClasses,
        totalRooms: rooms.length,
        occupiedRooms,
        freeRooms: rooms.length - occupiedRooms,
        totalProjectors: inventory?.totalProjectors || 0,
        availableProjectors: inventory?.availableProjectors || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching dashboard' });
  }
};

// ── GET /api/admin/classes ────────────────────────────────────────────────────
exports.getClasses = async (req, res) => {
  try {
    const classes = await ClassSection.find().populate('createdBy', 'name').sort({ name: 1 });
    res.json({ success: true, classes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching classes' });
  }
};

// ── POST /api/admin/classes ───────────────────────────────────────────────────
exports.createClass = async (req, res) => {
  try {
    const { name, department, batch, semester, defaultTimetable } = req.body;
    if (!name || !department) {
      return res.status(400).json({ success: false, message: 'name and department are required' });
    }
    const cls = await ClassSection.create({ name, department, batch, semester, createdBy: req.user._id });

    // If admin provided a default timetable, seed FixedTimetable entries
    if (defaultTimetable && Array.isArray(defaultTimetable) && defaultTimetable.length > 0) {
      const Subject = require('../models/Subject');

      // Resolve teacher names → ObjectIds
      const teacherNames  = [...new Set(defaultTimetable.map(e => e.teacher).filter(Boolean))];
      const subjectNames  = [...new Set(defaultTimetable.map(e => e.subject).filter(Boolean))];

      const [teachers, subjects] = await Promise.all([
        User.find({ name: { $in: teacherNames }, role: { $in: ['teacher','cr'] } }).select('_id name'),
        Subject.find({ name: { $in: subjectNames } }).select('_id name'),
      ]);

      const teacherMap = Object.fromEntries(teachers.map(t => [t.name.toLowerCase(), t._id]));
      const subjectMap = Object.fromEntries(subjects.map(s => [s.name.toLowerCase(), s._id]));

      const entries = defaultTimetable
        .map(e => {
          const teacherId  = teacherMap[e.teacher?.toLowerCase()];
          const subjectId  = subjectMap[e.subject?.toLowerCase()];
          if (!teacherId || !subjectId) return null;   // skip unresolvable entries
          return {
            dayOfWeek:    e.dayOfWeek,
            periodNumber: e.periodNumber,
            startTime:    e.startTime,
            endTime:      e.endTime,
            subject:      subjectId,
            teacher:      teacherId,
            className:    name,
            classroomNo:  e.classroomNo || 'TBD',
          };
        })
        .filter(Boolean);

      if (entries.length > 0) {
        try {
          await FixedTimetable.insertMany(entries, { ordered: false });
        } catch (ttErr) {
          console.warn('Partial timetable seed:', ttErr.message);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Class created', class: cls });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Class name already exists' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/admin/classes/:id ────────────────────────────────────────────────
exports.updateClass = async (req, res) => {
  try {
    const cls = await ClassSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, message: 'Class updated', class: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/admin/classes/:id ─────────────────────────────────────────────
exports.deleteClass = async (req, res) => {
  try {
    await ClassSection.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Class deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { role, className } = req.query;
    const filter = {};
    if (role)      filter.role = role;
    if (className) filter.className = className;
    const users = await User.find(filter).populate('assignedSubject', 'name code').sort({ role: 1, name: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
};

// ── POST /api/admin/users ─────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, message: 'User created', user });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;  // never update password via this route
    const user = await User.findByIdAndUpdate(req.params.id, rest, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User updated', user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/admin/timetable-overview ─────────────────────────────────────────
// Admin sees all classes' timetables at once (READ ONLY, no cancel)
exports.getTimetableOverview = async (req, res) => {
  try {
    const { className } = req.query;
    const filter = className ? { className } : {};
    const entries = await FixedTimetable.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ className: 1, dayOfWeek: 1, periodNumber: 1 });

    // Group by className → dayOfWeek
    const grouped = {};
    for (const e of entries) {
      if (!grouped[e.className]) grouped[e.className] = {};
      if (!grouped[e.className][e.dayOfWeek]) grouped[e.className][e.dayOfWeek] = [];
      grouped[e.className][e.dayOfWeek].push(e);
    }

    // Also get today's changes across all classes
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(today.getTime() + 86399999);
    const todayChanges = await TimetableChange.find({ changeDate: { $gte: today, $lte: todayEnd } })
      .populate('teacher', 'name').populate('subject', 'name');

    res.json({ success: true, grouped, todayChanges });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching timetable overview' });
  }
};

// ── PUT /api/admin/projectors ──────────────────────────────────────────────────
exports.updateProjectorCount = async (req, res) => {
  try {
    const { totalProjectors } = req.body;
    if (!totalProjectors || totalProjectors < 1) {
      return res.status(400).json({ success: false, message: 'Invalid projector count' });
    }
    let inv = await ProjectorInventory.findOne();
    if (!inv) inv = new ProjectorInventory();
    const checkedOut = inv.totalProjectors - inv.availableProjectors;
    inv.totalProjectors     = totalProjectors;
    inv.availableProjectors = Math.max(0, totalProjectors - checkedOut);
    await inv.save();
    res.json({ success: true, message: 'Projector count updated', inventory: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
