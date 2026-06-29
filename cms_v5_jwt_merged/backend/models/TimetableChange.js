/**
 * TimetableChange Model — v2
 *
 * status field:
 *   'cancelled'  — teacher marked unavailable (period is OFF)
 *   'available'  — teacher restored availability (period is back ON)
 *
 * Feature 1 additions:
 *   cancelledAt   — exact timestamp when cancelled
 *   effectiveDate — the class date this cancellation is for
 *   offerable     — true when cancelled ≥1 day in advance (other teachers can claim the slot)
 *   claimedBy     — teacher who booked this freed slot for an extra class
 *   claimedAt     — when it was claimed
 */
const mongoose = require('mongoose');

const timetableChangeSchema = new mongoose.Schema({
  changeDate: { type: Date, required: [true, 'Change date is required'] },
  fixedTimetableEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FixedTimetable',
    required: true
  },
  teacher:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  periodNumber: { type: Number, required: true },
  startTime:    { type: String, required: true },
  endTime:      { type: String, required: true },
  className:    { type: String, default: 'Class-10A' },

  status: {
    type: String,
    enum: ['cancelled', 'available'],
    default: 'cancelled'
  },
  changeType: {
    type: String,
    enum: ['teacher_unavailable', 'period_cancelled', 'substitute_assigned', 'teacher_available'],
    default: 'teacher_unavailable'
  },

  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason:            { type: String, default: 'Teacher unavailable' },

  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastUpdatedAt: { type: Date, default: null },

  smsSent:   { type: Boolean, default: false },
  smsSentAt: { type: Date, default: null },

  // classroom override for this specific change date
  classroomNo: { type: String, default: null, trim: true },

  // ── Feature 1: Offerable cancelled slots ─────────────────────────────────
  // Timestamp when the teacher created the cancellation
  cancelledAt: { type: Date, default: null },
  // The actual class date (mirrors changeDate, explicit for clarity)
  effectiveDate: { type: Date, default: null },
  // true  → cancelled ≥ 1 day before effectiveDate → other teachers may offer extra class
  // false → same-day cancellation → NOT offerable
  offerable: { type: Boolean, default: false },
  // Which teacher claimed this freed slot for an extra class
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },

}, { timestamps: true });

timetableChangeSchema.index({ changeDate: 1, fixedTimetableEntry: 1 }, { unique: true });

module.exports = mongoose.model('TimetableChange', timetableChangeSchema);
