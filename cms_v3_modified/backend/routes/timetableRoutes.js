const express = require('express');
const router  = express.Router();
const {
  getFixedTimetable,
  getTimetableForDate,
  getTeacherTimetable,
  getTeacherClasses,
  updateClassroomNo
} = require('../controllers/timetableController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',                protect, getFixedTimetable);
router.get('/teacher/classes', protect, authorize('teacher'), getTeacherClasses);
router.get('/teacher',         protect, authorize('teacher'), getTeacherTimetable);
router.get('/date/:date',      protect, getTimetableForDate);

// ── NEW: Update classroom number — only teacher (own period) or CR ──
router.patch('/:id/classroom', protect, authorize('teacher', 'cr'), updateClassroomNo);

module.exports = router;
