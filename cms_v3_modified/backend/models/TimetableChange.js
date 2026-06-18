/**
 * TimetableChange Model
 * Stores TEMPORARY date-specific changes — does NOT modify the fixed timetable.
 *
 * status field:
 *   'cancelled'  — teacher marked unavailable (period is OFF)
 *   'available'  — teacher restored availability (period is back ON)
 *                  Only allowed if done strictly BEFORE the change date
 */
const mongoose = require('mongoose');

const timetableChangeSchema = new mongoose.Schema({
  changeDate: {
    type: Date,
    required: [true, 'Change date is required']
  },
  fixedTimetableEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FixedTimetable',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  periodNumber:  { type: Number, required: true },
  startTime:     { type: String, required: true },
  endTime:       { type: String, required: true },
  className:     { type: String, default: 'Class-10A' },

  // 'cancelled' = period is off | 'available' = teacher restored it
  status: {
    type: String,
    enum: ['cancelled', 'available'],
    default: 'cancelled'
  },

  // Legacy field kept for backward compat
  changeType: {
    type: String,
    enum: ['teacher_unavailable', 'period_cancelled', 'substitute_assigned', 'teacher_available'],
    default: 'teacher_unavailable'
  },

  substituteTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reason: {
    type: String,
    default: 'Teacher unavailable'
  },

  // Track who acted and when
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastUpdatedAt: {
    type: Date,
    default: null
  },

  smsSent:   { type: Boolean, default: false },
  smsSentAt: { type: Date, default: null },

  // ── NEW: classroom override for this specific change date ──────
  // If set, this overrides the fixed timetable classroomNo for this date.
  // Only CR and Teacher can set this.
  classroomNo: {
    type: String,
    default: null,   // null = use the fixed entry's classroomNo
    trim: true
  }
}, {
  timestamps: true
});

timetableChangeSchema.index({ changeDate: 1, fixedTimetableEntry: 1 }, { unique: true });

module.exports = mongoose.model('TimetableChange', timetableChangeSchema);
