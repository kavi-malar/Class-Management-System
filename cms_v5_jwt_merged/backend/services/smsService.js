/**
 * SMS Service
 *
 * Supports multiple providers — set SMS_MODE in .env:
 *
 *   SMS_MODE=fast2sms  → Fast2SMS (RECOMMENDED for India — free ₹50 credits on signup)
 *                        Sign up: https://fast2sms.com → Dev API → copy API key
 *
 *   SMS_MODE=twilio    → Twilio regular SMS
 *                        (blocked for Indian +91 numbers on trial accounts)
 *
 *   SMS_MODE=whatsapp  → Twilio WhatsApp sandbox
 *                        (student must send "join <keyword>" to Twilio sandbox number first)
 *
 *   SMS_MODE=mock      → Print to terminal only, no real SMS (default if nothing set)
 */

const https        = require('https');
const User         = require('../models/User');
const Notification = require('../models/Notification');

// ─── Provider: Fast2SMS ───────────────────────────────────────────────────────
// Best option for Indian +91 numbers — no DLT registration needed for testing
async function sendFast2SMS(to, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey || apiKey === 'your_fast2sms_api_key_here' || apiKey.trim() === '') {
    throw new Error('FAST2SMS_API_KEY not set in .env — get it from fast2sms.com → Dev API');
  }

  // Fast2SMS needs 10-digit number — strip +91 or 91 prefix
  const number = to.replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');

  if (number.length !== 10) {
    throw new Error(`Invalid Indian phone number: ${to} (must be 10 digits after +91)`);
  }

  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      authorization: apiKey.trim(),
      message:       message,
      language:      'english',
      route:         'q',       // Quick/Transactional route
      numbers:       number,
    });

    const options = {
      hostname: 'www.fast2sms.com',
      path:     `/dev/bulkV2?${params.toString()}`,
      method:   'GET',
      headers:  {
        'cache-control': 'no-cache',
        'Content-Type':  'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Fast2SMS response:', JSON.stringify(json));
          if (json.return === true) {
            console.log(`✅ Fast2SMS sent to ${to} | Request ID: ${json.request_id}`);
            resolve({ sid: String(json.request_id || 'F2S_' + Date.now()), status: 'sent' });
          } else {
            const errMsg = Array.isArray(json.message) ? json.message.join(', ') : (json.message || 'Fast2SMS API error');
            reject(new Error(errMsg));
          }
        } catch (e) {
          reject(new Error('Fast2SMS parse error: ' + data));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error('Fast2SMS network error: ' + err.message));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Fast2SMS request timed out'));
    });

    req.end();
  });
}

// ─── Provider: Twilio SMS ────────────────────────────────────────────────────
async function sendTwilioSMS(to, body) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const msg = await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });
  console.log(`✅ Twilio SMS sent to ${to} | SID: ${msg.sid}`);
  return { sid: msg.sid, status: msg.status };
}

// ─── Provider: Twilio WhatsApp ───────────────────────────────────────────────
async function sendTwilioWhatsApp(to, body) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const msg = await client.messages.create({
    body,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to:   `whatsapp:${to}`,
  });
  console.log(`✅ WhatsApp sent to ${to} | SID: ${msg.sid}`);
  return { sid: msg.sid, status: msg.status };
}

// ─── Main send dispatcher ────────────────────────────────────────────────────
async function sendSMS(to, body) {
  const mode = (process.env.SMS_MODE || 'mock').toLowerCase().trim();

  switch (mode) {

    case 'fast2sms':
      return await sendFast2SMS(to, body);

    case 'twilio':
      return await sendTwilioSMS(to, body);

    case 'whatsapp':
      return await sendTwilioWhatsApp(to, body);

    case 'mock':
    default:
      console.log('\n📱 [MOCK SMS] ─────────────────────────────────────────');
      console.log(`   To     : ${to}`);
      console.log(`   Message:\n${body.split('\n').map(l => '   ' + l).join('\n')}`);
      console.log('───────────────────────────────────────────────────────\n');
      return { sid: `MOCK_${Date.now()}`, status: 'sent' };
  }
}

// ─── Send to all students + save Notification records ────────────────────────
async function notifyAllStudents(message, type, referenceId) {
  const students = await User.find({ role: 'student', isActive: true });

  if (!students.length) {
    console.log('ℹ️  No active students found to notify');
    return;
  }

  const mode = (process.env.SMS_MODE || 'mock').toUpperCase();
  console.log(`📤 Sending ${type} to ${students.length} students via ${mode}...`);

  const promises = students.map(async (student) => {
    let status = 'pending', twilioSid = null, errorMessage = null;

    try {
      const result = await sendSMS(student.phone, message);
      status    = 'sent';
      twilioSid = result.sid;
    } catch (err) {
      status       = 'failed';
      errorMessage = err.message;
      console.error(`❌ Failed to ${student.phone}: ${err.message}`);
    }

    // Always save notification record regardless of success/failure
    return Notification.create({
      recipient:       student._id,
      recipientPhone:  student.phone,
      message,
      type,
      timetableChange: referenceId || null,
      status,
      twilioSid,
      errorMessage,
    });
  });

  await Promise.all(promises);
  console.log(`✅ Notification complete for ${students.length} students`);
}

// ─── Exported functions ───────────────────────────────────────────────────────

exports.sendSMS = sendSMS;

/** Teacher cancels a period → notify all students */
exports.notifyStudentsAboutChange = async (change) => {
  try {
    const TimetableChange = require('../models/TimetableChange');
    const pop = await TimetableChange.findById(change._id)
      .populate('teacher', 'name').populate('subject', 'name');

    const dateStr = new Date(change.changeDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const message =
      `CLASS ALERT!\n` +
      `On ${dateStr}, Period ${change.periodNumber} (${change.startTime}-${change.endTime})\n` +
      `${pop.subject.name} class is CANCELLED.\n` +
      `Teacher: ${pop.teacher.name} is unavailable.\n` +
      `Reason: ${change.reason || 'Not specified'}\n` +
      `- Class Management System`;

    await notifyAllStudents(message, 'timetable_change', change._id);

    await TimetableChange.findByIdAndUpdate(change._id, {
      smsSent: true, smsSentAt: new Date(),
    });
  } catch (err) {
    console.error('❌ notifyStudentsAboutChange error:', err);
  }
};

/** Teacher restores a cancelled period → notify all students */
exports.notifyStudentsAboutRestoration = async (change) => {
  try {
    const TimetableChange = require('../models/TimetableChange');
    const pop = await TimetableChange.findById(change._id)
      .populate('teacher', 'name').populate('subject', 'name');

    const dateStr = new Date(change.changeDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const message =
      `CLASS RESTORED!\n` +
      `On ${dateStr}, Period ${change.periodNumber} (${change.startTime}-${change.endTime})\n` +
      `${pop.subject.name} class is BACK ON.\n` +
      `Teacher: ${pop.teacher.name} is now available.\n` +
      `- Class Management System`;

    await notifyAllStudents(message, 'timetable_change', change._id);
  } catch (err) {
    console.error('❌ notifyStudentsAboutRestoration error:', err);
  }
};

/** Teacher offers extra class on free period → notify all students */
exports.notifyStudentsAboutFreeSlot = async (freeSlot) => {
  try {
    const FreeSlot = require('../models/FreeSlot');
    const pop = await FreeSlot.findById(freeSlot._id)
      .populate('teacher', 'name').populate('subject', 'name');

    const dateStr = new Date(freeSlot.slotDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const message =
      `EXTRA CLASS ANNOUNCED!\n` +
      `${pop.teacher.name} is offering an EXTRA class on ${dateStr}.\n` +
      `Period ${freeSlot.periodNumber} (${freeSlot.startTime}-${freeSlot.endTime}): ${pop.subject.name}.\n` +
      (freeSlot.note ? `Note: ${freeSlot.note}\n` : '') +
      `- Class Management System`;

    await notifyAllStudents(message, 'timetable_change', freeSlot._id);

    await FreeSlot.findByIdAndUpdate(freeSlot._id, {
      smsSent: true, smsSentAt: new Date(),
    });
  } catch (err) {
    console.error('❌ notifyStudentsAboutFreeSlot error:', err);
  }
};

/** Teacher withdraws free slot offer → notify all students */
exports.notifyStudentsAboutFreeSlotWithdrawal = async (freeSlot) => {
  try {
    const FreeSlot = require('../models/FreeSlot');
    const pop = await FreeSlot.findById(freeSlot._id)
      .populate('teacher', 'name').populate('subject', 'name');

    const dateStr = new Date(freeSlot.slotDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const message =
      `EXTRA CLASS CANCELLED!\n` +
      `The extra ${pop.subject.name} class by ${pop.teacher.name} on ${dateStr},\n` +
      `Period ${freeSlot.periodNumber} (${freeSlot.startTime}-${freeSlot.endTime}) has been WITHDRAWN.\n` +
      `- Class Management System`;

    await notifyAllStudents(message, 'timetable_change', freeSlot._id);
  } catch (err) {
    console.error('❌ notifyStudentsAboutFreeSlotWithdrawal error:', err);
  }
};

/** CR or Teacher updates a classroom number → notify all students */
exports.notifyStudentsAboutClassroomChange = async (entry, oldRoom) => {
  try {
    const FixedTimetable = require('../models/FixedTimetable');
    const pop = await FixedTimetable.findById(entry._id)
      .populate('teacher', 'name')
      .populate('subject', 'name')
      .populate('classroomUpdatedBy', 'name role');

    const updaterName = pop.classroomUpdatedBy?.name || 'Staff';
    const updaterRole = pop.classroomUpdatedBy?.role === 'cr' ? 'CR' : 'Teacher';

    const message =
      `📍 CLASSROOM UPDATE!\n` +
      `${pop.subject.name} — ${pop.dayOfWeek}, Period ${pop.periodNumber} (${pop.startTime}-${pop.endTime})\n` +
      `Room changed: ${oldRoom || 'TBD'} → ${entry.classroomNo}\n` +
      `Updated by ${updaterRole} ${updaterName}.\n` +
      `- Class Management System`;

    await notifyAllStudents(message, 'timetable_change', null);
  } catch (err) {
    console.error('❌ notifyStudentsAboutClassroomChange error:', err);
  }
};

/** Daily reminder — runs at 7 AM via cron */
exports.sendDailyReminders = async () => {
  try {
    const FixedTimetable  = require('../models/FixedTimetable');
    const TimetableChange = require('../models/TimetableChange');

    const today   = new Date();
    const DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = DAYS[today.getDay()];
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const timetable = await FixedTimetable.find({ dayOfWeek: dayName })
      .populate('subject', 'name').sort({ periodNumber: 1 });

    if (!timetable.length) {
      console.log(`ℹ️  No timetable for ${dayName} — skipping daily reminder`);
      return;
    }

    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const end   = new Date(today); end.setHours(23, 59, 59, 999);

    const changes = await TimetableChange.find({
      changeDate: { $gte: start, $lte: end }, status: 'cancelled',
    });
    const cancelledPeriods = new Set(changes.map(c => c.periodNumber));

    let msg = `TODAY'S SCHEDULE\n${dateStr} - ${dayName}\n`;
    timetable.forEach(e => {
      const room = e.classroomNo && e.classroomNo !== 'TBD' ? ` | Room: ${e.classroomNo}` : '';
      msg += `P${e.periodNumber} ${e.startTime}-${e.endTime}: ${e.subject.name}${room} ${cancelledPeriods.has(e.periodNumber) ? '[CANCELLED]' : '[Active]'}\n`;
    });
    msg += `- Class Management System`;

    const students = await User.find({ role: 'student', isActive: true });
    await Promise.all(students.map(s =>
      sendSMS(s.phone, msg).catch(err => console.error(`Reminder failed ${s.phone}:`, err.message))
    ));

    console.log(`✅ Daily reminders sent to ${students.length} students`);
  } catch (err) {
    console.error('❌ sendDailyReminders error:', err);
    throw err;
  }
};
