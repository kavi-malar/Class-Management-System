const express = require('express');
const router  = express.Router();
const {
  createPoll,
  respondToPoll,
  getPolls,
  getPoll,
  closePoll,
  getSubjectsAndTeachers,
  getTeacherPolls,
  cancelPeriodFromPoll,
} = require('../controllers/pollController');
const { protect, authorize } = require('../middleware/auth');

router.get('/form-data',       protect,                              getSubjectsAndTeachers);
router.get('/',                protect, authorize('cr', 'student'),  getPolls);
router.get('/:id',             protect, authorize('cr', 'student'),  getPoll);
router.post('/',               protect, authorize('cr'),             createPoll);
router.patch('/:id/respond',   protect, authorize('student'),        respondToPoll);
router.patch('/:id/close',     protect, authorize('cr'),             closePoll);
router.get('/teacher/my-polls',  protect, authorize('teacher'),       getTeacherPolls);
router.post('/cancel-from-poll', protect, authorize('teacher'),       cancelPeriodFromPoll);

module.exports = router;
