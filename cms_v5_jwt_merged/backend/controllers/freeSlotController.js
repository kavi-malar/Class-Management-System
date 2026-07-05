/**
 * FreeSlot Controller — v2
 *
 * Feature 1: Show offerable cancelled slots in getMyPeriodsForDate
 * Feature 2: Prevent double booking — check FreeSlot + TimetableChange together
 * Feature 4: Room dashboard picks up FreeSlot rooms
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

function parseDateLocal(dateStr) {
  const parts = String(dateStr).trim().split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
}

function midnight(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function isFutureDay(dateStr) {
  const target = parseDateLocal(dateStr);
  const today  = midnight(new Date());
  return target > today;
}

function toObjectId(id) {
  try { return new mongoose.Types.ObjectId(String(id)); } catch(e) { return id; }
}

// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/free-slots/my-periods?date=YYYY-MM-DD
 *
 * Feature 1 change: also returns 'offerable_cancelled' type periods — i.e.
 * periods that ANOTHER teacher cancelled ≥1 day in advance (and unclaimed).
 * These show up so the current teacher can offer an extra class in that slot.
 *
 * Feature 2 change: a 'free' period that already has an active FreeSlot from
 * ANY teacher is tagged as 'already_reserved' — hidden from offering UI.
 */
exports.getMyPeriodsForDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });

    const localDate = parseDateLocal(date);
    if (isNaN(localDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid date' });

    const dayName   = DAY_NAMES[localDate.getDay()];
    const teacherId = toObjectId(req.user._id);
    const dayStart  = midnight(localDate);
    const dayEnd    = new Date(dayStart.getTime() + 86399999);

    // 1. This teacher's fixed periods on this weekday
    const assigned = await FixedTimetable.find({ teacher: teacherId, dayOfWeek: dayName })
      .populate('subject', 'name code');

    // 2. ALL fixed periods on this weekday (to know which are occupied by others)
    const allOccupied = await FixedTimetable.find({ dayOfWeek: dayName });
    const occupiedByAny = new Set(allOccupied.map(e => e.periodNumber));
    const assignedMap   = {};
    assigned.forEach(a => { assignedMap[a.periodNumber] = a; });

    // 3. This teacher's change records for this date
    const myChanges = await TimetableChange.find({ teacher: teacherId, changeDate: { $gte: dayStart, $lte: dayEnd } })
      .populate('subject', 'name code');
    const myChangeMap = {};
    myChanges.forEach(c => { myChangeMap[c.periodNumber] = c; });

    // 4. This teacher's FreeSlot offers on this date
    const myOffers = await FreeSlot.find({ teacher: teacherId, slotDate: { $gte: dayStart, $lte: dayEnd } })
      .populate('subject', 'name code');
    const myOfferMap = {};
    myOffers.forEach(o => { myOfferMap[o.periodNumber] = o; });

    // Feature 2: ALL active FreeSlots on this date (any teacher) — for double-booking check
    const allOffers = await FreeSlot.find({ slotDate: { $gte: dayStart, $lte: dayEnd }, status: 'active' })
      .populate('teacher', 'name email').populate('subject', 'name code');
    const allOffersByPeriod = {};
    allOffers.forEach(o => { allOffersByPeriod[o.periodNumber] = o; });

    // Feature 1: OFFERABLE cancelled slots from OTHER teachers on this date
    const offerableChanges = await TimetableChange.find({
      changeDate: { $gte: dayStart, $lte: dayEnd },
      status:     'cancelled',
      offerable:  true,
      claimedBy:  null,
      teacher:    { $ne: teacherId }        // NOT this teacher's own cancellations
    }).populate('teacher', 'name email').populate('subject', 'name code')
      .populate('fixedTimetableEntry', 'classroomNo');

    const offerableByPeriod = {};
    offerableChanges.forEach(c => { offerableByPeriod[c.periodNumber] = c; });

    // 5. Build period view
    const periods = ALL_PERIODS.map(slot => {
      const fixedEntry = assignedMap[slot.number] || null;
      const myChange   = myChangeMap[slot.number] || null;
      const myOffer    = myOfferMap[slot.number]  || null;
      const anyOffer   = allOffersByPeriod[slot.number] || null;
      const offerable  = offerableByPeriod[slot.number] || null;

      if (fixedEntry) {
        // This teacher's own assigned period
        const isCancelled = !!(myChange && myChange.status === 'cancelled');
        return {
          periodNumber: slot.number,
          startTime: slot.start,
          endTime:   slot.end,
          type: isCancelled ? 'cancelled' : 'assigned',
          subject: fixedEntry.subject,
          fixedEntryId: fixedEntry._id,
          changeId: myChange?._id || null,
          change:   myChange || null,
          offer:    null,
        };
      }

      // Feature 1: another teacher freed this period — show as offerable_cancelled
      if (offerable && !assignedMap[slot.number]) {
        // Feature 2: if already reserved by someone, tag as already_reserved
        if (anyOffer) {
          return {
            periodNumber: slot.number,
            startTime:    slot.start,
            endTime:      slot.end,
            type:         'already_reserved',
            originalTeacher: { name: offerable.teacher?.name },
            originalSubject: offerable.subject,
            classroomNo:     offerable.fixedTimetableEntry?.classroomNo || 'TBD',
            cancelChange:    offerable,
            reservedBy:      anyOffer.teacher,
            offer:           myOffer || null,
          };
        }
        return {
          periodNumber: slot.number,
          startTime:    slot.start,
          endTime:      slot.end,
          type:         'offerable_cancelled',   // ← Feature 1 new type
          originalTeacher: { name: offerable.teacher?.name },
          originalSubject: offerable.subject,
          classroomNo:     offerable.fixedTimetableEntry?.classroomNo || 'TBD',
          cancelChangeId:  offerable._id,        // needed when claiming
          cancelChange:    offerable,
          offer:           myOffer || null,
        };
      }

      if (occupiedByAny.has(slot.number)) return null; // another teacher is here, skip

      // Feature 2: truly free period but already reserved
      if (anyOffer && !myOffer) {
        return {
          periodNumber: slot.number,
          startTime:    slot.start,
          endTime:      slot.end,
          type:         'already_reserved',
          reservedBy:   anyOffer.teacher,
          subject:      anyOffer.subject,
          offer:        null,
        };
      }

      // Truly free — no one has a class here
      return {
        periodNumber: slot.number,
        startTime:    slot.start,
        endTime:      slot.end,
        type:         'free',
        subject:      myOffer?.subject || null,
        fixedEntryId: null,
        changeId:     null,
        change:       null,
        offer:        myOffer || null,
        offerStatus:  myOffer?.status || null,
      };
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
 * Teacher offers an extra class.
 *
 * Feature 1: if the slot comes from a cancelled (offerable) period,
 * mark that TimetableChange as claimedBy this teacher.
 *
 * Feature 2: block if another teacher already has an active FreeSlot
 * in the same period on the same date.
 */
exports.createFreeSlot = async (req, res) => {
  try {
    const { date, periodNumber, subjectId, note, cancelChangeId } = req.body;

    if (!date || !periodNumber || !subjectId) {
      return res.status(400).json({ success: false, message: 'date, periodNumber, and subjectId are required' });
    }

    if (!isFutureDay(date)) {
      return res.status(400).json({ success: false, message: 'Free period offers must be submitted at least one day in advance.' });
    }

    const localDate = parseDateLocal(date);
    const dayName   = DAY_NAMES[localDate.getDay()];
    const teacherId = toObjectId(req.user._id);
    const dayStart  = midnight(localDate);
    const dayEnd    = new Date(dayStart.getTime() + 86399999);
    const pNum      = Number(periodNumber);

    // Block if teacher already has an assigned class in this period
    const alreadyAssigned = await FixedTimetable.findOne({ teacher: teacherId, dayOfWeek: dayName, periodNumber: pNum });
    if (alreadyAssigned) {
      return res.status(400).json({ success: false, message: `Period ${pNum} on ${dayName} is your assigned class — use Cancel/Restore instead.` });
    }

    // Feature 2: check if ANY other teacher already has an active offer in this slot
    const conflictOffer = await FreeSlot.findOne({
      slotDate:     { $gte: dayStart, $lte: dayEnd },
      periodNumber: pNum,
      status:       'active',
      teacher:      { $ne: teacherId }
    }).populate('teacher', 'name');

    if (conflictOffer) {
      return res.status(409).json({
        success: false,
        message: `Period ${pNum} is already reserved by ${conflictOffer.teacher?.name || 'another teacher'}. Cannot double-book.`,
        alreadyReservedBy: conflictOffer.teacher?.name
      });
    }

    const slot = ALL_PERIODS.find(p => p.number === pNum);
    if (!slot) return res.status(400).json({ success: false, message: 'Invalid period number (1–8)' });

    // Feature 1: validate that if a cancelChangeId is provided, it's offerable
    let cancelChange = null;
    if (cancelChangeId) {
      cancelChange = await TimetableChange.findById(cancelChangeId);
      if (!cancelChange) return res.status(404).json({ success: false, message: 'Cancellation record not found' });
      if (!cancelChange.offerable) return res.status(400).json({ success: false, message: 'This slot is not offerable (same-day cancellation or already claimed)' });
      if (cancelChange.claimedBy) return res.status(409).json({ success: false, message: 'This slot was already claimed by another teacher' });
    }

    const existing = await FreeSlot.findOne({ teacher: teacherId, slotDate: { $gte: dayStart, $lte: dayEnd }, periodNumber: pNum });
    let freeSlot;
    if (existing) {
      if (existing.status === 'active') return res.status(400).json({ success: false, message: 'You have already offered this period on that date.' });
      existing.status  = 'active';
      existing.subject = subjectId;
      existing.note    = note || '';
      existing.smsSent = false;
      await existing.save();
      freeSlot = existing;
    } else {
      freeSlot = await FreeSlot.create({
        slotDate:     dayStart,
        periodNumber: pNum,
        startTime:    slot.start,
        endTime:      slot.end,
        teacher:      teacherId,
        subject:      subjectId,
        className:    req.user.className || 'Class-10A',
        note:         note || '',
        status:       'active',
      });
    }

    // Feature 1: mark the original cancellation as claimed
    if (cancelChange) {
      cancelChange.claimedBy = teacherId;
      cancelChange.claimedAt = new Date();
      await cancelChange.save();
    }

    smsService.notifyStudentsAboutFreeSlot(freeSlot).catch(console.error);

    // Feature 4: occupy room when extra class offered
    const roomStatusService = require('../services/roomStatusService');
    roomStatusService.syncRoomAllocationsFromTimetable(new Date()).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Extra class offered! Students will be notified via SMS.',
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
 * Feature 1: also un-claim the TimetableChange if this was a claimed slot
 */
exports.withdrawFreeSlot = async (req, res) => {
  try {
    const slot = await FreeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Free slot not found' });
    if (slot.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    if (slot.status === 'withdrawn') return res.status(400).json({ success: false, message: 'Slot already withdrawn' });

    slot.status = 'withdrawn';
    await slot.save();

    // Feature 1: un-claim the original TimetableChange so another teacher can claim it
    const dayStart = midnight(slot.slotDate);
    const dayEnd   = new Date(dayStart.getTime() + 86399999);
    await TimetableChange.updateMany(
      {
        changeDate:    { $gte: dayStart, $lte: dayEnd },
        periodNumber:  slot.periodNumber,
        claimedBy:     req.user._id,
        offerable:     true,
      },
      { claimedBy: null, claimedAt: null }
    );

    smsService.notifyStudentsAboutFreeSlotWithdrawal(slot).catch(console.error);
    res.json({ success: true, message: 'Free slot withdrawn. Students will be notified.', slot });

    // Feature 4: free room when extra class withdrawn
    const roomStatusService = require('../services/roomStatusService');
    roomStatusService.syncRoomAllocationsFromTimetable(new Date()).catch(console.error);
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
