/**
 * Timetable Change Controller — v2
 *
 * POST   /api/changes              → teacher marks period CANCELLED
 * PATCH  /api/changes/:id/restore  → teacher marks period back AVAILABLE
 * GET    /api/changes              → list changes
 * GET    /api/changes/offerable    → NEW: cancelled periods offerable to other teachers (Feature 1)
 * DELETE /api/changes/:id          → hard-delete a change record
 */
const TimetableChange = require('../models/TimetableChange');
const FixedTimetable  = require('../models/FixedTimetable');
const FreeSlot        = require('../models/FreeSlot');
const smsService      = require('../services/smsService');

// ── Helpers ──────────────────────────────────────────────────────

function parseDateLocal(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  return new Date(year, month - 1, day);
}

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

/**
 * Feature 1: Is the cancellation at least 1 full day before the class date?
 * cancelledAt = now, effectiveDate = the class date
 * Rule: midnight(effectiveDate) - midnight(cancelledAt) >= 1 day
 */
function isOfferableAdvance(effectiveDate, cancelledAt = new Date()) {
  const classDay  = midnight(effectiveDate);
  const cancelDay = midnight(cancelledAt);
  const diffMs    = classDay.getTime() - cancelDay.getTime();
  return diffMs >= 86400000; // at least 1 full day
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
    const now        = new Date();

    const existing = await TimetableChange.findOne({
      fixedTimetableEntry: fixedTimetableEntryId,
      changeDate: { $gte: targetDate, $lte: dayEnd }
    });

    // Feature 1: compute offerable flag
    const offerable = isOfferableAdvance(targetDate, now);

    if (existing) {
      if (existing.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'This period is already marked as cancelled for that date' });
      }
      existing.status        = 'cancelled';
      existing.changeType    = 'teacher_unavailable';
      existing.reason        = reason || 'Teacher unavailable';
      existing.lastUpdatedBy = req.user._id;
      existing.lastUpdatedAt = now;
      existing.cancelledAt   = now;
      existing.effectiveDate = targetDate;
      existing.offerable     = offerable;
      existing.claimedBy     = null;
      existing.claimedAt     = null;
      existing.smsSent       = false;
      await existing.save();
      smsService.notifyStudentsAboutChange(existing).catch(console.error);
      return res.json({
        success: true,
        message: offerable
          ? 'Period cancelled. Other teachers can now offer an extra class in this slot.'
          : 'Period cancelled. (Same-day cancellation — slot not offerable to others.)',
        change: existing,
        offerable
      });
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
      lastUpdatedAt:       now,
      cancelledAt:         now,
      effectiveDate:       targetDate,
      offerable,
      claimedBy:           null,
      claimedAt:           null,
    });

    smsService.notifyStudentsAboutChange(change).catch(console.error);

    res.status(201).json({
      success: true,
      message: offerable
        ? 'Period cancelled. Other teachers can now offer an extra class in this slot.'
        : 'Period cancelled. Students notified via SMS.',
      change,
      offerable
    });
  } catch (err) {
    console.error('createChange error:', err);
    res.status(500).json({ success: false, message: 'Server error creating change' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Restore a CANCELLED period back to AVAILABLE
 * @route PATCH /api/changes/:id/restore
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
        message: 'You can only restore a cancelled period at least one day in advance.',
      });
    }

    // Feature 1: if slot was claimed by another teacher, un-claim it
    if (change.claimedBy) {
      // Withdraw any FreeSlot that was booked into this slot
      const dayStart = midnight(change.changeDate);
      const dayEnd   = new Date(dayStart.getTime() + 86399999);
      await FreeSlot.updateMany(
        {
          teacher:      change.claimedBy,
          slotDate:     { $gte: dayStart, $lte: dayEnd },
          periodNumber: change.periodNumber,
          status:       'active'
        },
        { status: 'withdrawn' }
      );
    }

    change.status        = 'available';
    change.changeType    = 'teacher_available';
    change.offerable     = false;
    change.claimedBy     = null;
    change.claimedAt     = null;
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
    if (req.user.role === 'teacher' && !date && !upcoming) filter.teacher = req.user._id;
    if (req.user.role === 'teacher' && upcoming) filter.teacher = req.user._id;

    const changes = await TimetableChange.find(filter)
      .populate('teacher', 'name email')
      .populate('subject', 'name code')
      .populate('fixedTimetableEntry')
      .populate('claimedBy', 'name email')
      .sort({ changeDate: 1, periodNumber: 1 });

    res.json({ success: true, changes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching changes' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * @desc  Feature 1 — Get all CANCELLED periods that are offerable (≥1 day in advance)
 *        Other teachers use this list to decide which slots they can offer extra class in.
 * @route GET /api/changes/offerable
 * @access Private — teacher (any)
 */
exports.getOfferableSlots = async (req, res) => {
  try {
    const now = new Date();
    const todayMidnight = midnight(now);

    // All cancellations that are:
    //   - status = cancelled
    //   - offerable = true
    //   - effectiveDate >= tomorrow (so still in the future)
    //   - NOT yet claimed (claimedBy is null)
    const slots = await TimetableChange.find({
      status:        'cancelled',
      offerable:     true,
      effectiveDate: { $gte: new Date(todayMidnight.getTime() + 86400000) },
      claimedBy:     null
    })
      .populate('teacher',             'name email')
      .populate('subject',             'name code')
      .populate('fixedTimetableEntry', 'classroomNo className')
      .sort({ effectiveDate: 1, periodNumber: 1 });

    const result = slots.map(s => ({
      _id:           s._id,
      effectiveDate: s.effectiveDate,
      changeDate:    s.changeDate,
      periodNumber:  s.periodNumber,
      startTime:     s.startTime,
      endTime:       s.endTime,
      className:     s.className,
      classroomNo:   s.fixedTimetableEntry?.classroomNo || s.classroomNo || 'TBD',
      originalTeacher: { name: s.teacher?.name, email: s.teacher?.email },
      subject:       s.subject,
      reason:        s.reason,
      cancelledAt:   s.cancelledAt,
      offerable:     s.offerable,
    }));

    res.json({ success: true, slots: result, count: result.length });
  } catch (err) {
    console.error('getOfferableSlots error:', err);
    res.status(500).json({ success: false, message: 'Error fetching offerable slots' });
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
