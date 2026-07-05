/**
 * Room Status Service — v3
 *
 * Priority (highest → lowest):
 *   1. CR / Teacher Manual Booking          → source: 'manual_cr' | 'manual_teacher'
 *   2. Extra Class (FreeSlot active)        → source: 'extra_class'
 *   3. Timetable Override (TimetableChange) → source: 'timetable'
 *   4. Timetable Allocation (FixedTimetable)→ source: 'timetable'
 *   5. Default Free                         → source: 'free'
 *
 * Feature 1 fix: computeRoomStatuses() now shows timetable rooms
 *   even when no active period — displayed with source='timetable_scheduled'
 *   so the dashboard always reflects what the timetable says.
 *
 * Feature 3 fix: manual bookings carry bookedByRole and bookedByName
 *   so the frontend can show "Booked by Teacher" vs "Booked by CR".
 *
 * Feature 4: syncRoomAllocationsFromTimetable() — writes RoomAllocation
 *   records from the current period's FixedTimetable entries.
 *   Called after seed, timetable CRUD, cancel, extra class offered/withdrawn.
 */

const FixedTimetable  = require('../models/FixedTimetable');
const TimetableChange = require('../models/TimetableChange');
const RoomAllocation  = require('../models/RoomAllocation');
const FreeSlot        = require('../models/FreeSlot');

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const PERIOD_TIMES = {
  1: { start: '09:00', end: '09:45' },
  2: { start: '09:45', end: '10:30' },
  3: { start: '10:45', end: '11:30' },
  4: { start: '11:30', end: '12:15' },
  5: { start: '13:00', end: '13:45' },
  6: { start: '13:45', end: '14:30' },
  7: { start: '14:30', end: '15:15' },
  8: { start: '15:15', end: '16:00' },
};

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentPeriod(now = new Date()) {
  const currentMins = now.getHours() * 60 + now.getMinutes();
  for (const [num, slot] of Object.entries(PERIOD_TIMES)) {
    if (currentMins >= toMinutes(slot.start) && currentMins < toMinutes(slot.end)) {
      return parseInt(num);
    }
  }
  return null;
}

function getTodayInfo(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${d}`, dayName: DAY_NAMES[now.getDay()] };
}

function midnight(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: compute live room statuses
// ─────────────────────────────────────────────────────────────────────────────

async function computeRoomStatuses(now = new Date()) {
  const { dayName } = getTodayInfo(now);
  const currentPeriod = getCurrentPeriod(now);

  const dbRooms = await RoomAllocation.find()
    .populate('lastUpdatedBy', 'name role')
    .sort({ roomNumber: 1 });
  const dbRoomMap = {};
  dbRooms.forEach(r => { dbRoomMap[r.roomNumber] = r; });

  // ── Outside school hours or weekend: show manual bookings + scheduled timetable ──
  if (!currentPeriod || dayName === 'Sunday') {
    // Feature 1 fix: even outside hours, show what rooms are assigned in timetable today.
    // Find which period is closest (previous or next) for context.
    let displayPeriod = null;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    // Find the last period that has passed, or the next upcoming one
    for (const [num, slot] of Object.entries(PERIOD_TIMES)) {
      if (currentMins >= toMinutes(slot.start)) displayPeriod = parseInt(num);
    }
    if (!displayPeriod) displayPeriod = 1; // before school starts, show P1 context

    const fixedForDisplay = dayName !== 'Sunday'
      ? await FixedTimetable.find({ dayOfWeek: dayName, periodNumber: displayPeriod })
          .populate('subject', 'name code').populate('teacher', 'name email')
      : [];

    const scheduledRooms = {};
    for (const entry of fixedForDisplay) {
      if (entry.classroomNo && entry.classroomNo !== 'TBD') {
        scheduledRooms[entry.classroomNo] = {
          occupiedBy: entry.className,
          label: `${entry.className} | ${entry.subject?.name || ''} [Scheduled P${displayPeriod}]`,
          teacher: entry.teacher?.name || ''
        };
      }
    }

    return dbRooms.map(r => {
      // Priority 1: manual booking always wins
      if (r.status === 'occupied' && r.manualBooking) {
        return {
          roomNumber: r.roomNumber, status: 'occupied',
          occupiedBy: r.occupiedByClass, occupancyLabel: r.occupancyLabel || r.occupiedByClass,
          source: r.bookingSource || 'manual',
          bookedByRole: r.bookedByRole, bookedByName: r.bookedByName,
          currentPeriod: null, periodInfo: null,
          projectorPresent: r.projectorPresent, isManualBooking: true,
          lastUpdatedBy: r.lastUpdatedBy, lastUpdatedAt: r.lastUpdatedAt
        };
      }
      // Show scheduled timetable rooms so dashboard is never all-free
      if (scheduledRooms[r.roomNumber]) {
        const occ = scheduledRooms[r.roomNumber];
        return {
          roomNumber: r.roomNumber, status: 'occupied',
          occupiedBy: occ.occupiedBy, occupancyLabel: occ.label,
          source: 'timetable_scheduled',
          bookedByRole: 'timetable', bookedByName: 'Timetable',
          currentPeriod: null, periodInfo: null,
          projectorPresent: r.projectorPresent, isManualBooking: false,
          lastUpdatedBy: r.lastUpdatedBy, lastUpdatedAt: r.lastUpdatedAt
        };
      }
      return {
        roomNumber: r.roomNumber, status: 'free',
        occupiedBy: null, occupancyLabel: null,
        source: 'free', bookedByRole: null, bookedByName: null,
        currentPeriod: null, periodInfo: null,
        projectorPresent: r.projectorPresent, isManualBooking: false,
        lastUpdatedBy: r.lastUpdatedBy, lastUpdatedAt: r.lastUpdatedAt
      };
    });
  }

  // ── During school hours: full dynamic computation ──────────────────────────
  const periodSlot = PERIOD_TIMES[currentPeriod];
  const todayStart = midnight(now);
  const todayEnd   = new Date(todayStart.getTime() + 86399999);

  // Fixed timetable entries for current period
  const fixedEntries = await FixedTimetable.find({ dayOfWeek: dayName, periodNumber: currentPeriod })
    .populate('subject', 'name code')
    .populate('teacher', 'name email');

  // Changes for today's current period
  const changes = await TimetableChange.find({
    changeDate: { $gte: todayStart, $lte: todayEnd },
    periodNumber: currentPeriod
  })
    .populate('teacher', 'name email')
    .populate('subject', 'name code');

  const changeByEntryId = {};
  changes.forEach(c => { if (c.fixedTimetableEntry) changeByEntryId[c.fixedTimetableEntry.toString()] = c; });

  // Feature 4 Rule B: Active FreeSlots for current period today
  const freeSlots = await FreeSlot.find({
    slotDate:     { $gte: todayStart, $lte: todayEnd },
    periodNumber: currentPeriod,
    status:       'active'
  }).populate('teacher', 'name email').populate('subject', 'name code');

  // Build room occupancy from timetable
  const roomOccupancy = {};
  const labOccupancy  = {};

  for (const entry of fixedEntries) {
    const entryId = entry._id.toString();
    const change  = changeByEntryId[entryId];

    // Cancelled → room is free (skip)
    if (change && change.status === 'cancelled' && !change.classroomNo) continue;

    let effectiveRoom = entry.classroomNo;
    let source        = 'timetable';
    const originalRoom = entry.classroomNo;

    if (change && change.classroomNo) {
      const newRoom = change.classroomNo.trim();
      if (newRoom.toLowerCase().startsWith('lab')) {
        // Lab movement — original room freed
        labOccupancy[newRoom] = {
          occupiedBy: entry.className,
          label: `${entry.className} | ${entry.subject?.name || ''} | Lab`,
          fromRoom: originalRoom, className: entry.className
        };
        continue;
      } else {
        effectiveRoom = newRoom; source = 'timetable';
      }
    }

    // Feature 5 fix: skip TBD rooms entirely
    if (effectiveRoom && effectiveRoom !== 'TBD') {
      if (!roomOccupancy[effectiveRoom]) {
        roomOccupancy[effectiveRoom] = {
          occupiedBy: entry.className,
          label: `${entry.className} | ${entry.subject?.name || ''}`,
          source, className: entry.className,
          teacher: entry.teacher?.name || '',
          bookedByRole: 'timetable',
          bookedByName: 'Timetable'
        };
      }
    }
  }

  // Extra classes occupy rooms
  const extraClassOccupancy = {};
  for (const fs of freeSlots) {
    let room = null;
    const tc = changes.find(c => c.claimedBy?.toString() === fs.teacher?._id?.toString() && c.periodNumber === currentPeriod);
    if (tc && tc.fixedTimetableEntry) {
      const ftEntry = fixedEntries.find(e => e._id.toString() === tc.fixedTimetableEntry?.toString());
      room = ftEntry?.classroomNo || tc.classroomNo || null;
    }
    if (room && room !== 'TBD' && !roomOccupancy[room] && !extraClassOccupancy[room]) {
      extraClassOccupancy[room] = {
        occupiedBy: fs.teacher?.name || 'Extra Class',
        label: `Extra: ${fs.subject?.name || ''} | ${fs.teacher?.name || ''}`,
        source: 'extra_class',
        bookedByRole: 'extra_class',
        bookedByName: fs.teacher?.name || 'Extra Class'
      };
    }
  }

  // Build final room status list
  const result = [];
  for (const dbRoom of dbRooms) {
    const rn     = dbRoom.roomNumber;
    const manual = dbRoom.status === 'occupied' && dbRoom.manualBooking;

    if (manual) {
      // Feature 3: use stored bookedByRole/bookedByName from DB
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: dbRoom.occupiedByClass, occupancyLabel: dbRoom.occupancyLabel || dbRoom.occupiedByClass,
        source: dbRoom.bookingSource || 'manual',
        bookedByRole: dbRoom.bookedByRole,
        bookedByName: dbRoom.bookedByName,
        currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: true,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else if (extraClassOccupancy[rn]) {
      const occ = extraClassOccupancy[rn];
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: occ.occupiedBy, occupancyLabel: occ.label,
        source: 'extra_class',
        bookedByRole: occ.bookedByRole, bookedByName: occ.bookedByName,
        currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: false,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else if (roomOccupancy[rn]) {
      const occ = roomOccupancy[rn];
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: occ.occupiedBy, occupancyLabel: occ.label,
        source: occ.source,
        bookedByRole: occ.bookedByRole, bookedByName: occ.bookedByName,
        currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: false,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else {
      result.push({
        roomNumber: rn, status: 'free',
        occupiedBy: null, occupancyLabel: null,
        source: 'free', bookedByRole: null, bookedByName: null,
        currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: false,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    }
  }

  // Append lab rooms
  for (const [labName, labInfo] of Object.entries(labOccupancy)) {
    result.push({
      roomNumber: labName, status: 'occupied',
      occupiedBy: labInfo.occupiedBy, occupancyLabel: labInfo.label,
      source: 'lab', bookedByRole: 'timetable', bookedByName: 'Timetable',
      currentPeriod, periodInfo: periodSlot,
      projectorPresent: false, isManualBooking: false,
      isLab: true, originalRoom: labInfo.fromRoom,
      lastUpdatedBy: null, lastUpdatedAt: null
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 & 4: Sync RoomAllocation records from current period timetable
// This writes to the DB so even the legacy /api/rooms endpoint reflects timetable.
// Does NOT overwrite manual bookings.
// ─────────────────────────────────────────────────────────────────────────────
async function syncRoomAllocationsFromTimetable(now = new Date()) {
  const { dayName } = getTodayInfo(now);
  const currentPeriod = getCurrentPeriod(now);

  // If no active period, clear all non-manual timetable occupancies
  if (!currentPeriod || dayName === 'Sunday') {
    await RoomAllocation.updateMany(
      { manualBooking: { $ne: true }, status: 'occupied', bookingSource: 'timetable' },
      {
        $set: {
          status: 'free', occupiedByClass: null, occupancyLabel: null,
          bookedByRole: null, bookedByName: null, bookingSource: null
        }
      }
    );
    return { synced: 0, cleared: true, reason: 'outside_hours' };
  }

  const todayStart = midnight(now);
  const todayEnd   = new Date(todayStart.getTime() + 86399999);

  // Get all fixed entries for the current period today
  const fixedEntries = await FixedTimetable.find({ dayOfWeek: dayName, periodNumber: currentPeriod })
    .populate('subject', 'name code')
    .populate('teacher', 'name email');

  // Get cancellations for today's current period
  const changes = await TimetableChange.find({
    changeDate: { $gte: todayStart, $lte: todayEnd },
    periodNumber: currentPeriod
  });
  const cancelledEntryIds = new Set(
    changes.filter(c => c.status === 'cancelled').map(c => c.fixedTimetableEntry?.toString())
  );

  // Active free slots (extra classes)
  const freeSlots = await FreeSlot.find({
    slotDate: { $gte: todayStart, $lte: todayEnd },
    periodNumber: currentPeriod,
    status: 'active'
  }).populate('teacher', 'name email').populate('subject', 'name code');

  // First: clear all non-manual timetable occupancies (will re-set below)
  await RoomAllocation.updateMany(
    { manualBooking: { $ne: true }, status: 'occupied', bookingSource: 'timetable' },
    {
      $set: {
        status: 'free', occupiedByClass: null, occupancyLabel: null,
        bookedByRole: null, bookedByName: null, bookingSource: null
      }
    }
  );

  let synced = 0;

  // Set rooms from timetable
  for (const entry of fixedEntries) {
    // Skip cancelled
    if (cancelledEntryIds.has(entry._id.toString())) continue;
    // Skip TBD rooms
    const room = entry.classroomNo;
    if (!room || room === 'TBD') continue;

    const existing = await RoomAllocation.findOne({ roomNumber: room });
    if (!existing) continue;
    // Don't overwrite manual bookings
    if (existing.manualBooking) continue;

    await RoomAllocation.updateOne(
      { roomNumber: room },
      {
        $set: {
          status: 'occupied',
          occupiedByClass: entry.className,
          occupancyLabel: `${entry.className} | ${entry.subject?.name || ''}`,
          bookedByRole: 'timetable',
          bookedByName: 'Timetable',
          bookingSource: 'timetable',
          lastUpdatedAt: new Date()
        }
      }
    );
    synced++;
  }

  // Set rooms from extra classes (FreeSlots)
  for (const fs of freeSlots) {
    const tc = changes.find(c =>
      c.claimedBy?.toString() === fs.teacher?._id?.toString() &&
      c.periodNumber === currentPeriod
    );
    let room = null;
    if (tc && tc.fixedTimetableEntry) {
      const ftEntry = fixedEntries.find(e => e._id.toString() === tc.fixedTimetableEntry?.toString());
      room = ftEntry?.classroomNo || tc.classroomNo || null;
    }
    if (!room || room === 'TBD') continue;

    const existing = await RoomAllocation.findOne({ roomNumber: room });
    if (!existing || existing.manualBooking) continue;

    await RoomAllocation.updateOne(
      { roomNumber: room },
      {
        $set: {
          status: 'occupied',
          occupiedByClass: fs.teacher?.name || 'Extra Class',
          occupancyLabel: `Extra: ${fs.subject?.name || ''} | ${fs.teacher?.name || ''}`,
          bookedByRole: 'extra_class',
          bookedByName: fs.teacher?.name || 'Extra Class',
          bookingSource: 'extra_class',
          lastUpdatedAt: new Date()
        }
      }
    );
    synced++;
  }

  return { synced, period: currentPeriod, dayName };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getTodayCancellations(now = new Date()) {
  const todayStart = midnight(now);
  const todayEnd   = new Date(todayStart.getTime() + 86399999);

  const changes = await TimetableChange.find({
    changeDate: { $gte: todayStart, $lte: todayEnd },
    status:     'cancelled'
  })
    .populate('teacher', 'name email')
    .populate('subject', 'name code')
    .populate('claimedBy', 'name email')
    .populate({
      path: 'fixedTimetableEntry',
      populate: [{ path: 'subject', select: 'name code' }, { path: 'teacher', select: 'name email' }]
    })
    .sort({ periodNumber: 1 });

  return changes.map(c => ({
    _id: c._id,
    periodNumber: c.periodNumber,
    startTime:    c.startTime,
    endTime:      c.endTime,
    className:    c.className,
    subject:      c.subject,
    teacher:      c.teacher,
    reason:       c.reason,
    // Feature 5: prefer TimetableChange.classroomNo → FixedTimetable.classroomNo → 'TBD'
    classroomNo:  c.classroomNo || c.fixedTimetableEntry?.classroomNo || 'TBD',
    changeDate:   c.changeDate,
    status:       c.status,
    offerable:    c.offerable,
    claimedBy:    c.claimedBy,
    cancelledAt:  c.cancelledAt,
  }));
}

function computeCounters(rooms) {
  return {
    total:              rooms.length,
    available:          rooms.filter(r => r.status === 'free').length,
    occupied:           rooms.filter(r => r.status === 'occupied').length,
    manualBookings:     rooms.filter(r => r.isManualBooking).length,
    labOccupied:        rooms.filter(r => r.isLab).length,
    extraClassOccupied: rooms.filter(r => r.source === 'extra_class').length,
    timetableOccupied:  rooms.filter(r => (r.source === 'timetable' || r.source === 'timetable_scheduled') && !r.isLab).length
  };
}

module.exports = {
  computeRoomStatuses,
  syncRoomAllocationsFromTimetable,
  getTodayCancellations,
  computeCounters,
  getCurrentPeriod,
  PERIOD_TIMES
};
