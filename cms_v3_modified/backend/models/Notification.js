/**
 * Notification Model
 * Tracks all SMS notifications sent to students
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientPhone: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['timetable_change', 'daily_reminder', 'general'],
    default: 'timetable_change'
  },
  // Reference to what triggered this notification
  timetableChange: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimetableChange',
    default: null
  },
  // Twilio delivery status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  twilioSid: {
    type: String,
    default: null   // Twilio message SID for tracking
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
