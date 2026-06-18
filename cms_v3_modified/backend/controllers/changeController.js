/**
 * Timetable Change Controller
 *
 * POST   /api/changes              → teacher marks period CANCELLED
 * PATCH  /api/changes/:id/restore  → teacher marks period back AVAILABLE
 * GET    /api/changes              → list changes
 * DELETE /api/changes/:id          → hard-delete a change record
 */
const TimetableChange = require('../models/TimetableChange');
const FixedTimetable  = require('../models/FixedTimetable');
const smsService      = require('../services/smsService');

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD" safely WITHOUT UTC timezone shift.
 * new Date("2025-01-20") is treated as UTC midnight which becomes the
 * previous day in UTC+5:30 — this constructs a LOCAL date instead.
 */
function parseDateLocal(dateStr) {
  if (dateStr instanceof Date) return dateStr;          // already a Date
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Midnight of a local date */
function midnight(d) {
  const x = parseDateLocal(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** True if today is strictly BEFORE targetDate (local, ignoring time) */
function isBeforeDay(targetDate) {
  const now    = midnight(new Date());
  const target = midnight(targetDate);
  return now < target;
}

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Teacher marks a period CANCELLED for a specific date
 * @route POST /api/changes
 * @access Private — teacher only
 */
exports.createChange = async (req, res) => {
  try {
    const { fixedTimetableEntryId, changeDate, reason } = req.body;

    if (!fixedTimetableEntryId || !changeDate) {
      return res.status(400).json({ success: false, message: 'Timetable entry ID and date are required' });
    }

    const fixedEntry = await FixedTimetable.findById(fixedTimetableEntryId)
      .populate('subject').populate('teacher');

    if (!fixedEntry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    if (fixedEntry.teacher._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own assigned periods' });
    }

    const targetDate = midnight(changeDate);
    const dayEnd     = new Date(targetDate.getTime() + 86399999);

    const existing = await TimetableChange.findOne({
      fixedTimetableEntry: fixedTimetableEntryId,
      changeDate: { $gte: targetDate, $lte: dayEnd }
    });

    if (existing) {
      if (existing.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'This period is already marked as cancelled for that date' });
      }
      existing.status        = 'cancelled';
      existing.changeType    = 'teacher_unavailable';
      existing.reason        = reason || 'Teacher unavailable';
      existing.lastUpdatedBy = req.user._id;
      existing.lastUpdatedAt = new Date();
      existing.smsSent       = false;
      await existing.save();
      smsService.notifyStudentsAboutChange(existing).catch(console.error);
      return res.json({ success: true, message: 'Period cancelled again. Students will be notified via SMS.', change: existing });
    }

    const change = await TimetableChange.create({
      changeDate:          targetDate,
      fixedTimetableEntry: fixedTimetableEntryId,
      teacher:             req.user._id,
      subject:             fixedEntry.subject._id,
      periodNumber:        fixedEntry.periodNumber,
      startTime:           fixedEntry.startTime,
      endTime:             fixedEntry.endTime,
      className:           fixedEntry.className,
      status:              'cancelled',
      changeType:          'teacher_unavailable',
      reason:              reason || 'Teacher unavailable',
      lastUpdatedBy:       req.user._id,
      lastUpdatedAt:       new Date(),
    });

    smsService.notifyStudentsAboutChange(change).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Period cancelled. Students will be notified via SMS.',
      change,
    });
  } catch (err) {
    console.error('createChange error:', err);
    res.status(500).json({ success: false, message: 'Server error creating change' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Restore a CANCELLED period back to AVAILABLE
 *        Rule: only allowed if today < changeDate (at least day before)
 * @route PATCH /api/changes/:id/restore
 * @access Private — teacher only
 */
exports.restoreChange = async (req, res) => {
  try {
    const change = await TimetableChange.findById(req.params.id);
    if (!change) return res.status(404).json({ success: false, message: 'Change record not found' });

    if (change.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to restore this change' });
    }
    if (change.status === 'available') {
      return res.status(400).json({ success: false, message: 'This period is already marked as available' });
    }
    if (!isBeforeDay(change.changeDate)) {
      return res.status(400).json({
        success: false,
        message: 'You can only restore a cancelled period at least one day in advance. Same-day or past restoration is not allowed.',
      });
    }

    change.status        = 'available';
    change.changeType    = 'teacher_available';
    change.lastUpdatedBy = req.user._id;
    change.lastUpdatedAt = new Date();
    await change.save();

    smsService.notifyStudentsAboutRestoration(change).catch(console.error);

    res.json({ success: true, message: 'Period restored. Students will be notified via SMS.', change });
  } catch (err) {
    console.error('restoreChange error:', err);
    res.status(500).json({ success: false, message: 'Server error restoring change' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Get list of changes
 * @route GET /api/changes
 */
exports.getChanges = async (req, res) => {
  try {
    const { date, upcoming, status } = req.query;
    const filter = {};

    if (date) {
      const d   = midnight(date);
      filter.changeDate = { $gte: d, $lte: new Date(d.getTime() + 86399999) };
    } else if (upcoming) {
      filter.changeDate = { $gte: midnight(new Date()) };
    }

    if (status) filter.status = status;
    if (req.user.role === 'teacher') filter.teacher = req.user._id;

    const changes = await TimetableChange.find(filter)
      .populate('teacher', 'name email')
      .populate('subject', 'name code')
      .populate('fixedTimetableEntry')
      .sort({ changeDate: 1, periodNumber: 1 });

    res.json({ success: true, changes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching changes' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Hard-delete a change record
 * @route DELETE /api/changes/:id
 */
exports.deleteChange = async (req, res) => {
  try {
    const change = await TimetableChange.findById(req.params.id);
    if (!change) return res.status(404).json({ success: false, message: 'Change not found' });
    if (change.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    await change.deleteOne();
    res.json({ success: true, message: 'Change deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting change' });
  }
};
