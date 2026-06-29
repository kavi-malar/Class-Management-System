/**
 * Fixed Timetable Model
 * Stores the weekly fixed timetable — NEVER modified directly.
 * Changes are stored in TimetableChanges collection.
 *
 * v2: Added classroomNo field — editable by CR or Teacher only.
 */
const mongoose = require('mongoose');

const fixedTimetableSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  periodNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  startTime:  { type: String, required: true },   // e.g. "09:00"
  endTime:    { type: String, required: true },   // e.g. "09:45"
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  className: {
    type: String,
    default: 'Class-10A'
  },

  // ── NEW: Classroom / Room number ─────────────────────────────
  // Only CR and Teachers are permitted to set/change this field.
  classroomNo: {
    type: String,
    default: 'TBD',
    trim: true
  },
  classroomUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  classroomUpdatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index: one period per day per class
fixedTimetableSchema.index({ dayOfWeek: 1, periodNumber: 1, className: 1 }, { unique: true });

module.exports = mongoose.model('FixedTimetable', fixedTimetableSchema);
