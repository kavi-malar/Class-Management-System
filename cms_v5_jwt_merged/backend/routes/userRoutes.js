const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.get('/students', protect, authorize('teacher'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching students' });
  }
});

module.exports = router;
