/**
 * Notification Controller
 */
const Notification = require('../models/Notification');
const smsService   = require('../services/smsService');
const User         = require('../models/User');

/**
 * @desc  Get notifications for the logged-in student
 * @route GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('timetableChange')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
};

/**
 * @desc  Get ALL notifications across all students (debug/admin view)
 * @route GET /api/notifications/all
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('recipient', 'name email phone role')
      .populate('timetableChange')
      .sort({ createdAt: -1 })
      .limit(100);

    const summary = {
      total:     notifications.length,
      sent:      notifications.filter(n => n.status === 'sent').length,
      delivered: notifications.filter(n => n.status === 'delivered').length,
      failed:    notifications.filter(n => n.status === 'failed').length,
      pending:   notifications.filter(n => n.status === 'pending').length,
    };

    res.json({ success: true, summary, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching all notifications' });
  }
};

/**
 * @desc  Trigger daily timetable reminder SMS manually (for testing)
 * @route POST /api/notifications/daily-reminder
 */
exports.triggerDailyReminder = async (req, res) => {
  try {
    await smsService.sendDailyReminders();
    res.json({ success: true, message: 'Daily reminders sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error sending daily reminders' });
  }
};

/**
 * @desc  Send a test SMS to verify Twilio is working
 * @route POST /api/notifications/test-sms
 *
 * Sends: "Hello from Class Management System! Twilio SMS is working."
 * to all students — so you can verify delivery on actual phones.
 */
exports.testSms = async (req, res) => {
  try {
    const students = await User.find({ role: 'student', isActive: true });

    if (!students.length) {
      return res.status(400).json({ success: false, message: 'No students found in database' });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const isMock = !sid || sid.startsWith('your_') || sid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    const message =
      `🔔 TEST SMS — Class Management System\n` +
      `This is a test message to confirm SMS delivery is working.\n` +
      `Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
      `— Class Management System`;

    const results = [];

    for (const student of students) {
      let status = 'pending', twilioSid = null, errorMessage = null;

      try {
        const twilio = require('twilio');

        if (isMock) {
          console.log(`📱 [TEST MOCK SMS] To: ${student.phone}\n${message}`);
          twilioSid = `MOCK_TEST_${Date.now()}`;
          status    = 'sent';
        } else {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const msg = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to:   student.phone,
          });
          twilioSid = msg.sid;
          status    = 'sent';
          console.log(`✅ Test SMS sent to ${student.phone} — SID: ${msg.sid}`);
        }
      } catch (err) {
        status       = 'failed';
        errorMessage = err.message;
        console.error(`❌ Test SMS failed for ${student.phone}: ${err.message}`);
      }

      await Notification.create({
        recipient:      student._id,
        recipientPhone: student.phone,
        message,
        type:           'general',
        status,
        twilioSid,
        errorMessage,
      });

      results.push({
        student: student.name,
        phone:   student.phone,
        status,
        twilioSid,
        errorMessage,
      });
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      mode:    isMock ? 'mock' : 'real_twilio',
      message: isMock
        ? `Mock mode — ${sent} messages printed to backend terminal`
        : `Real SMS — ${sent} sent, ${failed} failed`,
      results,
    });
  } catch (err) {
    console.error('testSms error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
