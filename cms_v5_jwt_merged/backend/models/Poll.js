/**
 * Poll Model
 * Created by CR to check student attendance strength for a class
 */
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answer:    { type: String, enum: ['yes', 'no'], required: true },
  answeredAt:{ type: Date, default: Date.now },
});

const pollSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // CR
  subject:   { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pollDate:  { type: Date, required: true },   // Which date is the class
  periodNumber: { type: Number, required: true },
  question:  { type: String, required: true },
  deadline:  { type: Date, required: true },   // Poll closes at this time
  status:    { type: String, enum: ['active', 'closed', 'reported'], default: 'active' },
  responses: [responseSchema],
  reportSentAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
