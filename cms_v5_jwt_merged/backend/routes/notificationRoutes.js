const express = require('express');
const router  = express.Router();
const {
  getNotifications,
  getAllNotifications,
  triggerDailyReminder,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',                 protect, getNotifications);
router.get('/all',              protect, getAllNotifications);
router.post('/daily-reminder',  protect, authorize('teacher'), triggerDailyReminder);

module.exports = router;
