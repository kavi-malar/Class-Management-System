/**
 * FreeSlot Model
 * When a teacher wants to offer a class during one of their FREE periods,
 * they create a FreeSlot record for that specific date + period.
 *
 * This is separate from TimetableChange which only modifies ASSIGNED periods.
 */
const mongoose = require('mongoose');

const freeSlotSchema = new mongoose.Schema({
  // The date the teacher is offering this extra class
  slotDate: {
    type: Date,
    required: [true, 'Date is required'],
  },
  // Which period number (must be a FREE period for this teacher on that day)
  periodNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
  },
  startTime: { type: String, required: true },
  endTime:   { type: String, required: true },

  // The teacher offering the class
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Subject they will teach
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  className: { type: String, default: 'Class-10A' },

  // Optional note / topic
  note: { type: String, default: '' },

  // 'active' = slot is offered | 'withdrawn' = teacher withdrew the offer
  status: {
    type: String,
    enum: ['active', 'withdrawn'],
    default: 'active',
  },

  smsSent:   { type: Boolean, default: false },
  smsSentAt: { type: Date,    default: null  },
}, { timestamps: true });

// One offer per teacher per period per date
freeSlotSchema.index({ slotDate: 1, periodNumber: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model('FreeSlot', freeSlotSchema);
