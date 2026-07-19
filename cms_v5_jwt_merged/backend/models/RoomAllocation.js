/**
 * RoomAllocation Model — v3
 *
 * Tracks the live status of every physical classroom (101–130).
 * A room can be:
 *   - free     : not occupied
 *   - occupied : currently in use by a class
 *
 * Who can change: CR (of that class) or any Teacher.
 * Admin: read-only monitoring.
 * Students: read-only view.
 *
 * projectorAvailable: whether the projector in this room is currently
 * available. When CR checks out a projector the global projector
 * count drops; when returned it goes back up.
 */
const mongoose = require('mongoose');

const roomAllocationSchema = new mongoose.Schema({
  // Room number string: "101" … "130"
  roomNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Current occupancy status
  status: {
    type: String,
    enum: ['free', 'occupied'],
    default: 'free'
  },

  // Which class is currently using this room (e.g. "CSE-A")
  occupiedByClass: {
    type: String,
    default: null
  },

  // Friendly label shown in the table (e.g. "CSE-A | Batch-1 | Math")
  occupancyLabel: {
    type: String,
    default: null
  },

  // Does this room currently have a projector?
  projectorPresent: {
    type: Boolean,
    default: false
  },

  // Who last updated this room record
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastUpdatedAt: { type: Date, default: null },

  // ── NEW: Explicit CR manual booking flag ────────────────────────
  // When true, this room's status is a deliberate manual CR booking
  // and overrides any timetable-derived status.
  manualBooking: {
    type: Boolean,
    default: false
  },
  manualBookingNote: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);
