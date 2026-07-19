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

// ══════════════════════════════════════════════════════════════════
// Feature 3 — Admin Timetable CRUD
// ══════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/timetable-classes
 * Returns distinct class names that have timetable entries + all ClassSection names
 */
exports.getTimetableClasses = async (req, res) => {
  try {
    const [ftClasses, sections] = await Promise.all([
      FixedTimetable.distinct('className'),
      ClassSection.find({ isActive: true }).select('name department').sort({ name: 1 })
    ]);
    const allNames = [...new Set([...ftClasses, ...sections.map(s => s.name)])].sort();
    res.json({ success: true, classes: allNames, sections });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching timetable classes' });
  }
};

/**
 * GET /api/admin/timetable/:className
 * Full timetable for a single class (grouped by day)
 */
exports.getTimetableForClass = async (req, res) => {
  try {
    const { className } = req.params;
    const entries = await FixedTimetable.find({ className })
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const grouped = Object.fromEntries(days.map(d => [d, []]));
    entries.forEach(e => { if (grouped[e.dayOfWeek]) grouped[e.dayOfWeek].push(e); });

    res.json({ success: true, className, grouped, flat: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching class timetable' });
  }
};

/**
 * PUT /api/admin/timetable/entry
 * Upsert a single timetable entry (create or update by className+dayOfWeek+periodNumber)
 */
exports.upsertTimetableEntry = async (req, res) => {
  try {
    const { className, dayOfWeek, periodNumber, teacherEmail, subjectName, classroomNo } = req.body;
    if (!className || !dayOfWeek || !periodNumber || !teacherEmail || !subjectName) {
      return res.status(400).json({ success: false, message: 'className, dayOfWeek, periodNumber, teacherEmail, subjectName are required' });
    }

    const Subject = require('../models/Subject');
    const [teacher, subject] = await Promise.all([
      User.findOne({ email: teacherEmail.trim(), role: { $in: ['teacher','cr'] } }),
      Subject.findOne({ name: { $regex: new RegExp(`^${subjectName.trim()}$`, 'i') } })
    ]);

    if (!teacher) return res.status(404).json({ success: false, message: `Teacher not found: ${teacherEmail}` });
    if (!subject) return res.status(404).json({ success: false, message: `Subject not found: ${subjectName}` });

    const PERIOD_MAP = {
      1:{start:'09:00',end:'09:45'}, 2:{start:'09:45',end:'10:30'},
      3:{start:'10:45',end:'11:30'}, 4:{start:'11:30',end:'12:15'},
      5:{start:'13:00',end:'13:45'}, 6:{start:'13:45',end:'14:30'},
      7:{start:'14:30',end:'15:15'}, 8:{start:'15:15',end:'16:00'},
    };
    const slot = PERIOD_MAP[Number(periodNumber)];
    if (!slot) return res.status(400).json({ success: false, message: 'Invalid period number' });

    const entry = await FixedTimetable.findOneAndUpdate(
      { className, dayOfWeek, periodNumber: Number(periodNumber) },
      {
        className, dayOfWeek, periodNumber: Number(periodNumber),
        startTime: slot.start, endTime: slot.end,
        teacher:   teacher._id,
        subject:   subject._id,
        classroomNo: classroomNo?.trim() || 'TBD',
        classroomUpdatedBy: req.user._id,
        classroomUpdatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    const populated = await FixedTimetable.findById(entry._id)
      .populate('subject', 'name code')
      .populate('teacher', 'name email');

    res.json({ success: true, message: 'Timetable entry saved', entry: populated });
  } catch (err) {
    console.error('upsertTimetableEntry error:', err);
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate entry — that slot is already filled' });
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

/**
 * DELETE /api/admin/timetable/entry
 * Delete a single entry by className+dayOfWeek+periodNumber
 */
exports.deleteTimetableEntry = async (req, res) => {
  try {
    const { className, dayOfWeek, periodNumber } = req.body;
    if (!className || !dayOfWeek || !periodNumber) {
      return res.status(400).json({ success: false, message: 'className, dayOfWeek, periodNumber are required' });
    }
    const result = await FixedTimetable.findOneAndDelete({ className, dayOfWeek, periodNumber: Number(periodNumber) });
    if (!result) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/admin/timetable/duplicate
 * Copy entire timetable from sourceClass to targetClass
 * (does not overwrite existing entries in target — use ?overwrite=true to force)
 */
exports.duplicateTimetable = async (req, res) => {
  try {
    const { sourceClass, targetClass, overwrite } = req.body;
    if (!sourceClass || !targetClass) {
      return res.status(400).json({ success: false, message: 'sourceClass and targetClass are required' });
    }
    if (sourceClass === targetClass) {
      return res.status(400).json({ success: false, message: 'sourceClass and targetClass must be different' });
    }

    const sourceEntries = await FixedTimetable.find({ className: sourceClass });
    if (sourceEntries.length === 0) {
      return res.status(404).json({ success: false, message: `No timetable found for ${sourceClass}` });
    }

    if (overwrite) {
      await FixedTimetable.deleteMany({ className: targetClass });
    }

    const newEntries = sourceEntries.map(e => ({
      dayOfWeek:    e.dayOfWeek,
      periodNumber: e.periodNumber,
      startTime:    e.startTime,
      endTime:      e.endTime,
      subject:      e.subject,
      teacher:      e.teacher,
      className:    targetClass,
      classroomNo:  e.classroomNo || 'TBD',
    }));

    let inserted = 0;
    try {
      const result = await FixedTimetable.insertMany(newEntries, { ordered: false });
      inserted = result.length;
    } catch (bulkErr) {
      inserted = bulkErr.result?.nInserted || 0;
    }

    res.json({ success: true, message: `Duplicated ${inserted} entries from ${sourceClass} to ${targetClass}`, inserted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error duplicating timetable' });
  }
};

/**
 * GET /api/admin/subjects-and-teachers
 * Helper for the timetable editor dropdowns
 */
exports.getSubjectsAndTeachers = async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const [subjects, teachers] = await Promise.all([
      Subject.find().sort({ name: 1 }),
      User.find({ role: { $in: ['teacher','cr'] }, isActive: true }).select('name email').sort({ name: 1 })
    ]);
    res.json({ success: true, subjects, teachers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching subjects/teachers' });
  }
};
