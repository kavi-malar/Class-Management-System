/**
 * User Model — v3
 * Roles: teacher | student | cr | admin
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  role: { type: String, enum: ['teacher', 'student', 'cr', 'admin'], required: true },
  phone: { type: String, required: [true, 'Phone number is required'], trim: true },
  assignedSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  // class/section this user belongs to (e.g. "CSE-A", "CSE-B")
  className: { type: String, default: 'CSE-A' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
