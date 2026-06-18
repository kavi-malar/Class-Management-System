/**
 * FreeSlot Controller
 */
const mongoose    = require('mongoose');
const FreeSlot        = require('../models/FreeSlot');
const FixedTimetable  = require('../models/FixedTimetable');
const TimetableChange = require('../models/TimetableChange');
const smsService      = require('../services/smsService');

const ALL_PERIODS = [
  { number: 1, start: '09:00', end: '09:45' },
  { number: 2, start: '09:45', end: '10:30' },
  { number: 3, start: '10:45', end: '11:30' },
  { number: 4, start: '11:30', end: '12:15' },
  { number: 5, start: '13:00', end: '13:45' },
  { number: 6, start: '13:45', end: '14:30' },
  { number: 7, start: '14:30', end: '15:15' },
  { number: 8, start: '15:15', end: '16:00' },
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/** Parse YYYY-MM-DD into a LOCAL midnight Date — avoids UTC timezone shift */
function parseDateLocal(dateStr) {
  const parts = String(dateStr).trim().split('-');
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;   // 0-indexed
  const day   = parseInt(parts[2], 10);
  return new Date(year, month, day, 0, 0, 0, 0);
}

function midnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isFutureDay(dateStr) {
  const target = parseDateLocal(dateStr);
  const today  = midnight(new Date());
  return target > today;
}

/** Safely convert any id value to mongoose ObjectId */
function toObjectId(id) {
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch(e) { return id; }
}

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/free-slots/my-periods?date=YYYY-MM-DD
 * Returns all 8 period slots tagged as assigned / cancelled / free
 */
exports.getMyPeriodsForDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }

    const localDate = parseDateLocal(date);
    if (isNaN(localDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD' });
    }

    const dayName    = DAY_NAMES[localDate.getDay()];
    const teacherId  = toObjectId(req.user._id);

    // Debug log — remove after confirming fix
    console.log(`[freeSlot] date=${date} dayName=${dayName} teacherId=${teacherId}`);

    // 1. Assigned fixed periods for this teacher on this weekday
    const assigned = await FixedTimetable.find({
      teacher:   teacherId,
      dayOfWeek: dayName,
    }).populate('subject', 'name code');

    console.log(`[freeSlot] assigned periods found: ${assigned.length}`, assigned.map(a => `P${a.periodNumber}`));

    // 1b. ALL periods occupied by ANY teacher on this weekday
    const allOccupied = await FixedTimetable.find({ dayOfWeek: dayName });
    const occupiedPeriodNumbers = new Set(allOccupied.map(e => e.periodNumber));

    const assignedMap = {};
    assigned.forEach(a => { assignedMap[a.periodNumber] = a; });

    // 2. TimetableChange records on this date
    const dayStart = midnight(localDate);
    const dayEnd   = new Date(dayStart.getTime() + 86399999);

    const changes = await TimetableChange.find({
      teacher:    teacherId,
      changeDate: { $gte: dayStart, $lte: dayEnd },
    }).populate('subject', 'name code');

    const changeMap = {};
    changes.forEach(c => { changeMap[c.periodNumber] = c; });

    // 3. Existing FreeSlot offers on this date
    const offers = await FreeSlot.find({
      teacher:  teacherId,
      slotDate: { $gte: dayStart, $lte: dayEnd },
    }).populate('subject', 'name code');

    const offerMap = {};
    offers.forEach(o => { offerMap[o.periodNumber] = o; });

    // 4. Build period view — only assigned/cancelled for this teacher + truly free periods
    const periods = ALL_PERIODS.map(slot => {
      const fixedEntry = assignedMap[slot.number] || null;
      const change     = changeMap[slot.number]   || null;
      const offer      = offerMap[slot.number]    || null;

      if (fixedEntry) {
        // This teacher has a class here — show as assigned or cancelled
        const isCancelled = !!(change && change.status === 'cancelled');
        return {
          periodNumber: slot.number,
          startTime:    slot.start,
          endTime:      slot.end,
          type:         isCancelled ? 'cancelled' : 'assigned',
          subject:      fixedEntry.subject,
          fixedEntryId: fixedEntry._id,
          changeId:     change?._id || null,
          change:       change      || null,
          offer:        null,
        };
      } else if (occupiedPeriodNumbers.has(slot.number)) {
        // Another teacher has a class here — skip this period entirely (return null)
        return null;
      } else {
        // Truly free — no teacher has any class in this period on this weekday
        return {
          periodNumber: slot.number,
          startTime:    slot.start,
          endTime:      slot.end,
          type:         'free',
          subject:      offer?.subject || null,
          fixedEntryId: null,
          changeId:     null,
          change:       null,
          offer:        offer || null,
          offerStatus:  offer?.status || null,
        };
      }
    }).filter(p => p !== null);

    res.json({ success: true, date, dayName, periods });
  } catch (err) {
    console.error('getMyPeriodsForDate error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/free-slots
 * Teacher offers an extra class on a FREE period
 */
exports.createFreeSlot = async (req, res) => {
  try {
    const { date, periodNumber, subjectId, note } = req.body;

    if (!date || !periodNumber || !subjectId) {
      return res.status(400).json({
        success: false,
        message: 'date, periodNumber, and subjectId are required',
      });
    }

    if (!isFutureDay(date)) {
      return res.status(400).json({
        success: false,
        message: 'Free period offers must be submitted at least one day in advance.',
      });
    }

    const localDate  = parseDateLocal(date);
    const dayName    = DAY_NAMES[localDate.getDay()];
    const teacherId  = toObjectId(req.user._id);

    // Verify this period is actually FREE for this teacher on this weekday
    const alreadyAssigned = await FixedTimetable.findOne({
      teacher:      teacherId,
      dayOfWeek:    dayName,
      periodNumber: Number(periodNumber),
    });

    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: `Period ${periodNumber} on ${dayName} is an assigned class — use the Cancel/Restore page instead.`,
      });
    }

    const slot = ALL_PERIODS.find(p => p.number === Number(periodNumber));
    if (!slot) {
      return res.status(400).json({ success: false, message: 'Invalid period number (1–8)' });
    }

    const dayStart = midnight(localDate);
    const dayEnd   = new Date(dayStart.getTime() + 86399999);

    const existing = await FreeSlot.findOne({
      teacher:      teacherId,
      slotDate:     { $gte: dayStart, $lte: dayEnd },
      periodNumber: Number(periodNumber),
    });

    let freeSlot;
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'You have already offered this period on that date.',
        });
      }
      existing.status  = 'active';
      existing.subject = subjectId;
      existing.note    = note || '';
      existing.smsSent = false;
      await existing.save();
      freeSlot = existing;
    } else {
      freeSlot = await FreeSlot.create({
        slotDate:     dayStart,
        periodNumber: Number(periodNumber),
        startTime:    slot.start,
        endTime:      slot.end,
        teacher:      teacherId,
        subject:      subjectId,
        className:    'Class-10A',
        note:         note || '',
        status:       'active',
      });
    }

    smsService.notifyStudentsAboutFreeSlot(freeSlot).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Free period marked as available! Students will be notified via SMS.',
      freeSlot,
    });
  } catch (err) {
    console.error('createFreeSlot error:', err);
    res.status(500).json({ success: false, message: 'Server error creating free slot' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/free-slots/:id/withdraw
 */
exports.withdrawFreeSlot = async (req, res) => {
  try {
    const slot = await FreeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Free slot not found' });
    if (slot.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    if (slot.status === 'withdrawn') {
      return res.status(400).json({ success: false, message: 'Slot already withdrawn' });
    }
    slot.status = 'withdrawn';
    await slot.save();
    smsService.notifyStudentsAboutFreeSlotWithdrawal(slot).catch(console.error);
    res.json({ success: true, message: 'Free slot withdrawn. Students will be notified.', slot });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error withdrawing slot' });
  }
};

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/free-slots
 */
exports.getFreeSlots = async (req, res) => {
  try {
    const { date, upcoming } = req.query;
    const filter = {};

    if (req.user.role === 'teacher') {
      filter.teacher = toObjectId(req.user._id);
    } else {
      filter.status = 'active';
    }

    if (date) {
      const d = midnight(parseDateLocal(date));
      filter.slotDate = { $gte: d, $lte: new Date(d.getTime() + 86399999) };
    } else if (upcoming) {
      filter.slotDate = { $gte: midnight(new Date()) };
    }

    const slots = await FreeSlot.find(filter)
      .populate('teacher', 'name email')
      .populate('subject', 'name code')
      .sort({ slotDate: 1, periodNumber: 1 });

    res.json({ success: true, freeSlots: slots });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching free slots' });
  }
};
