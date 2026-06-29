/**
 * Timetable Controller
 */
const FixedTimetable  = require('../models/FixedTimetable');
const TimetableChange = require('../models/TimetableChange');

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Parse "YYYY-MM-DD" safely without UTC timezone shift.
 * new Date("2025-01-20") → UTC midnight → wrong day in UTC+5:30.
 * This function constructs a LOCAL date directly from the parts.
 */
function parseDateLocal(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function midnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/timetable  —  full fixed weekly timetable
 * Optional query param: ?className=CSE-A  (filters to that class)
 * If no className, falls back to the logged-in user's own className.
 */
exports.getFixedTimetable = async (req, res) => {
  try {
    // Determine which class to fetch
    const className = req.query.className || req.user?.className || null;
    const filter = className ? { className } : {};

    const timetable = await FixedTimetable.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const grouped = Object.fromEntries(days.map(d => [d, []]));
    timetable.forEach(e => { if (grouped[e.dayOfWeek]) grouped[e.dayOfWeek].push(e); });

    res.json({ success: true, timetable: grouped, flat: timetable, className: className || 'all' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching timetable' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/timetable/date/:date
 * Returns fixed timetable for that weekday + any changes applied for that date.
 *
 * Status logic:
 *   No change record             → status = 'normal'    (active class)
 *   change.status = 'cancelled'  → status = 'cancelled' (period is off)
 *   change.status = 'available'  → status = 'normal'    (restored, class is back on)
 */
exports.getTimetableForDate = async (req, res) => {
  try {
    const { date } = req.params;

    // ── Safe local parse — avoids UTC shift bug ────────────────
    const localDate = parseDateLocal(date);
    if (isNaN(localDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD' });
    }

    const dayName = DAY_NAMES[localDate.getDay()];

    // Scope to user's class (or override with ?className= for admin/teacher)
    const className = req.query.className || req.user?.className || null;
    const classFilter = className ? { className } : {};

    const fixedEntries = await FixedTimetable.find({ dayOfWeek: dayName, ...classFilter })
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ periodNumber: 1 });

    const from = midnight(localDate);
    const to   = new Date(from.getTime() + 86399999);

    const changes = await TimetableChange.find({ changeDate: { $gte: from, $lte: to }, ...classFilter })
      .populate('subject', 'name code')
      .populate('teacher', 'name email');

    const changeMap = {};
    changes.forEach(c => { changeMap[c.periodNumber] = c; });

    const merged = fixedEntries.map(entry => {
      const chg = changeMap[entry.periodNumber];
      const isCancelled = !!(chg && chg.status === 'cancelled');
      return {
        ...entry.toObject(),
        change:    chg || null,
        isChanged: isCancelled,
        status:    isCancelled ? 'cancelled' : 'normal',
      };
    });

    res.json({ success: true, date, dayName, timetable: merged, changes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching date timetable' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/timetable/teacher  —  this teacher's own fixed periods
 */
exports.getTeacherTimetable = async (req, res) => {
  try {
    const entries = await FixedTimetable.find({ teacher: req.user._id })
      .populate('subject', 'name code')
      .sort({ dayOfWeek: 1, periodNumber: 1 });
    res.json({ success: true, timetable: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching teacher timetable' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/timetable/teacher/classes  —  distinct classes this teacher teaches
 */
exports.getTeacherClasses = async (req, res) => {
  try {
    const entries = await FixedTimetable.find({ teacher: req.user._id }).select('className');
    const classes = [...new Set(entries.map(e => e.className))].filter(Boolean).sort();
    res.json({ success: true, classes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching teacher classes' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/timetable/:id/classroom
 * Update the classroom number for a fixed timetable entry.
 * Access: teacher (who owns the period) OR cr
 */
exports.updateClassroomNo = async (req, res) => {
  try {
    const { classroomNo } = req.body;

    if (!classroomNo || !classroomNo.trim()) {
      return res.status(400).json({ success: false, message: 'classroomNo is required' });
    }

    const entry = await FixedTimetable.findById(req.params.id)
      .populate('subject', 'name')
      .populate('teacher', 'name');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    // Authorization: teacher must own the period; CR can update any period
    if (req.user.role === 'teacher') {
      if (entry.teacher._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Teachers can only update the classroom for their own assigned periods'
        });
      }
    }
    // CR can update any period — no extra check needed

    const oldRoom = entry.classroomNo;
    entry.classroomNo          = classroomNo.trim();
    entry.classroomUpdatedBy   = req.user._id;
    entry.classroomUpdatedAt   = new Date();
    await entry.save();

    // Notify all students about the classroom change
    const smsService = require('../services/smsService');
    smsService.notifyStudentsAboutClassroomChange(entry, oldRoom).catch(console.error);

    res.json({
      success: true,
      message: `Classroom updated to "${entry.classroomNo}". Students will be notified.`,
      entry
    });
  } catch (err) {
    console.error('updateClassroomNo error:', err);
    res.status(500).json({ success: false, message: 'Server error updating classroom' });
  }
};
