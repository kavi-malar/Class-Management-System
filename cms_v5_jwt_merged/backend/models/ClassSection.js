/**
 * ClassSection Model — v3
 *
 * Represents a class/section managed by the system.
 * Admin creates these; each has its own CR and students.
 * e.g. CSE-A, CSE-B, ECE-A, MECH-A …
 */
const mongoose = require('mongoose');

const classSectionSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true, trim: true },  // "CSE-A"
  department: { type: String, required: true, trim: true },                // "CSE"
  batch:      { type: String, default: '' },                               // "2022-2026"
  semester:   { type: Number, default: 1 },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ClassSection', classSectionSchema);
