/**
 * Main Server Entry Point
 * Integrated Class Management System with SMS Alerts
 */
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');
const cron     = require('node-cron');

// Load .env from backend folder
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Database ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_management_db')
  .then(async () => {
    console.log('✅ MongoDB connected:', process.env.MONGODB_URI);
    const { seedIfEmpty } = require('./utils/seedData');
    await seedIfEmpty();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/timetable',     require('./routes/timetableRoutes'));
app.use('/api/changes',       require('./routes/changeRoutes'));
app.use('/api/free-slots',    require('./routes/freeSlotRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/polls',         require('./routes/pollRoutes'));
app.use('/api/rooms',         require('./routes/roomRoutes'));
app.use('/api/admin',         require('./routes/adminRoutes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const mode = (process.env.SMS_MODE || 'mock').toLowerCase();
  let smsReady = false;

  if (mode === 'fast2sms') {
    smsReady = !!(process.env.FAST2SMS_API_KEY &&
                  process.env.FAST2SMS_API_KEY !== 'your_fast2sms_api_key_here' &&
                  process.env.FAST2SMS_API_KEY.trim() !== '');
  } else if (mode === 'twilio' || mode === 'whatsapp') {
    smsReady = !!(process.env.TWILIO_ACCOUNT_SID &&
                  process.env.TWILIO_ACCOUNT_SID !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  }

  res.json({
    status:        'OK',
    smsMode:       mode,
    smsConfigured: smsReady,
    timestamp:     new Date(),
  });
});

// ── Cron: daily reminder 7 AM IST ─────────────────────────────────────────────
const smsService = require('./services/smsService');
cron.schedule('0 7 * * *', async () => {
  console.log('⏰ Running daily timetable reminders...');
  try { await smsService.sendDailyReminders(); }
  catch (err) { console.error('❌ Daily reminder error:', err); }
}, { timezone: 'Asia/Kolkata' });

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  const mode = (process.env.SMS_MODE || 'mock').toUpperCase();
  console.log(`\n🚀 Server running on http://localhost:${PORT}/api`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`📱 SMS Mode: ${mode}`);

  if (mode === 'FAST2SMS') {
    const ok = process.env.FAST2SMS_API_KEY &&
               process.env.FAST2SMS_API_KEY !== 'your_fast2sms_api_key_here' &&
               process.env.FAST2SMS_API_KEY.trim() !== '';
    if (ok) {
      console.log(`📱 Fast2SMS: ✅ CONFIGURED — real SMS will be sent to students`);
    } else {
      console.log(`📱 Fast2SMS: ❌ API KEY MISSING`);
      console.log(`   → Open backend/.env and set FAST2SMS_API_KEY`);
      console.log(`   → Get key from: https://fast2sms.com → Dashboard → Dev API`);
    }
  } else if (mode === 'MOCK') {
    console.log(`📱 Mock mode — SMS printed to terminal, no real messages sent`);
    console.log(`   → To enable real SMS: set SMS_MODE=fast2sms in backend/.env`);
  }
  console.log('');
});

module.exports = app;
