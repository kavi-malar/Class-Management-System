/**
 * Room Status Service — v2
 *
 * Priority (highest → lowest):
 *   1. CR Manual Booking
 *   2. Extra Class (FreeSlot) reservation  ← NEW Feature 4
 *   3. Timetable Override (TimetableChange with classroomNo)
 *   4. Timetable Allocation (FixedTimetable.classroomNo for current period)
 *   5. Default Free
 *
 * Feature 4 rules:
 *   Rule A: Class cancelled → room becomes AVAILABLE (already handled: skip cancelled entries)
 *   Rule B: Extra class (FreeSlot active) → room becomes BOOKED
 *   Rule C: Lab periods → original room freed
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

async function computeRoomStatuses(now = new Date()) {
  const { dayName } = getTodayInfo(now);
  const currentPeriod = getCurrentPeriod(now);

  const dbRooms = await RoomAllocation.find()
    .populate('lastUpdatedBy', 'name role')
    .sort({ roomNumber: 1 });
  const dbRoomMap = {};
  dbRooms.forEach(r => { dbRoomMap[r.roomNumber] = r; });

  if (!currentPeriod || dayName === 'Sunday') {
    return dbRooms.map(r => {
      if (r.status === 'occupied' && r.manualBooking) {
        return {
          roomNumber: r.roomNumber, status: 'occupied',
          occupiedBy: r.occupiedByClass, occupancyLabel: r.occupancyLabel || r.occupiedByClass,
          source: 'manual', currentPeriod: null, periodInfo: null,
          projectorPresent: r.projectorPresent, isManualBooking: true,
          lastUpdatedBy: r.lastUpdatedBy, lastUpdatedAt: r.lastUpdatedAt
        };
      }
      return {
        roomNumber: r.roomNumber, status: 'free',
        occupiedBy: null, occupancyLabel: null,
        source: 'free', currentPeriod: null, periodInfo: null,
        projectorPresent: r.projectorPresent, isManualBooking: false,
        lastUpdatedBy: r.lastUpdatedBy, lastUpdatedAt: r.lastUpdatedAt
      };
    });
  }

  const periodSlot = PERIOD_TIMES[currentPeriod];
  const todayStart = midnight(now);
  const todayEnd   = new Date(todayStart.getTime() + 86399999);

  // Fixed timetable entries for current period
  const fixedEntries = await FixedTimetable.find({ dayOfWeek: dayName, periodNumber: currentPeriod })
    .populate('subject', 'name code')
    .populate('teacher', 'name email');

  // Changes for today's current period
  const changes = await TimetableChange.find({ changeDate: { $gte: todayStart, $lte: todayEnd }, periodNumber: currentPeriod })
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

    // Feature 4 Rule A: cancelled → room is free (skip)
    if (change && change.status === 'cancelled' && !change.classroomNo) continue;

    let effectiveRoom = entry.classroomNo;
    let source        = 'timetable';
    const originalRoom = entry.classroomNo;

    if (change && change.classroomNo) {
      const newRoom = change.classroomNo.trim();
      if (newRoom.toLowerCase().startsWith('lab')) {
        // Feature 4 Rule C: Lab movement — original room freed
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

    if (effectiveRoom && effectiveRoom !== 'TBD') {
      if (!roomOccupancy[effectiveRoom]) {
        roomOccupancy[effectiveRoom] = {
          occupiedBy: entry.className,
          label: `${entry.className} | ${entry.subject?.name || ''}`,
          source, className: entry.className, teacher: entry.teacher?.name || ''
        };
      }
    }
  }

  // Feature 4 Rule B: Extra classes occupy rooms
  // FreeSlots don't have a fixed classroomNo by default — they inherit from the TimetableChange
  // or we mark it as TBD. We add them to occupancy only if they have a room.
  // We store them separately to show source='extra_class'
  const extraClassOccupancy = {};
  for (const fs of freeSlots) {
    // Look up TimetableChange to get classroomNo if this is a claimed offerable slot
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
        source: 'extra_class'
      };
    }
  }

  // Build final room status list
  const result = [];
  for (const dbRoom of dbRooms) {
    const rn     = dbRoom.roomNumber;
    const manual = dbRoom.status === 'occupied' && dbRoom.manualBooking;

    if (manual) {
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: dbRoom.occupiedByClass, occupancyLabel: dbRoom.occupancyLabel || dbRoom.occupiedByClass,
        source: 'manual', currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: true,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else if (extraClassOccupancy[rn]) {
      // Feature 4 Rule B: Extra class takes priority over empty
      const occ = extraClassOccupancy[rn];
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: occ.occupiedBy, occupancyLabel: occ.label,
        source: 'extra_class', currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: false,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else if (roomOccupancy[rn]) {
      const occ = roomOccupancy[rn];
      result.push({
        roomNumber: rn, status: 'occupied',
        occupiedBy: occ.occupiedBy, occupancyLabel: occ.label,
        source: occ.source, currentPeriod, periodInfo: periodSlot,
        projectorPresent: dbRoom.projectorPresent, isManualBooking: false,
        lastUpdatedBy: dbRoom.lastUpdatedBy, lastUpdatedAt: dbRoom.lastUpdatedAt
      });
    } else {
      result.push({
        roomNumber: rn, status: 'free',
        occupiedBy: null, occupancyLabel: null,
        source: 'free', currentPeriod, periodInfo: periodSlot,
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
      source: 'lab', currentPeriod, periodInfo: periodSlot,
      projectorPresent: false, isManualBooking: false,
      isLab: true, originalRoom: labInfo.fromRoom,
      lastUpdatedBy: null, lastUpdatedAt: null
    });
  }

  return result;
}

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
    classroomNo:  c.fixedTimetableEntry?.classroomNo || 'TBD',
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
    timetableOccupied:  rooms.filter(r => r.source === 'timetable' && !r.isLab).length
  };
}

module.exports = {
  computeRoomStatuses,
  getTodayCancellations,
  computeCounters,
  getCurrentPeriod,
  PERIOD_TIMES
};
