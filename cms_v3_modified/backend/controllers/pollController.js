/**
 * Poll Controller
 * CR creates polls, students respond, report auto-sends after deadline
 */
const Poll    = require('../models/Poll');
const User    = require('../models/User');
const Subject = require('../models/Subject');

// ── Helper: build report text ─────────────────────────────────────────────
function buildReport(poll, yesCount, noCount, total) {
  const dateStr = new Date(poll.pollDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const pct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
  return (
    `📊 POLL REPORT\n` +
    `Subject: ${poll.subject?.name}\n` +
    `Date: ${dateStr} — Period ${poll.periodNumber}\n` +
    `Teacher: ${poll.teacher?.name}\n` +
    `─────────────────\n` +
    `✅ Will attend : ${yesCount} / ${total} (${pct}%)\n` +
    `❌ Won't attend: ${noCount} / ${total}\n` +
    `⏳ No response : ${total - yesCount - noCount} students\n` +
    `─────────────────\n` +
    `- Class Management System`
  );
}

// ── CR: Create a poll ─────────────────────────────────────────────────────
exports.createPoll = async (req, res) => {
  try {
    const { subjectId, teacherId, pollDate, periodNumber, question, deadlineMinutes } = req.body;

    if (!subjectId || !teacherId || !pollDate || !periodNumber || !question || !deadlineMinutes) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const subject = await Subject.findById(subjectId);
    const teacher = await User.findById(teacherId);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found.' });
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found.' });

    const deadline = new Date(Date.now() + Number(deadlineMinutes) * 60 * 1000);

    const poll = await Poll.create({
      createdBy:    req.user._id,
      subject:      subjectId,
      teacher:      teacherId,
      pollDate:     new Date(pollDate),
      periodNumber: Number(periodNumber),
      question,
      deadline,
    });

    // Notify all students via WhatsApp
    const smsService = require('../services/smsService');
    const students   = await User.find({ role: 'student', isActive: true });
    const dateStr    = new Date(pollDate).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const msg =
      `📋 ATTENDANCE POLL\n` +
      `${question}\n` +
      `Subject: ${subject.name} — Period ${periodNumber} on ${dateStr}\n` +
      `Please respond on the Class Management app before ${deadline.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.\n` +
      `- Class Management System`;

    await Promise.all(students.map(s =>
      smsService.sendSMS(s.phone, msg).catch(err =>
        console.error(`Poll notify failed ${s.phone}:`, err.message)
      )
    ));

    // Notify teacher too
    const teacherMsg =
      `📋 POLL LAUNCHED\n` +
      `CR has launched an attendance poll for your ${subject.name} class.\n` +
      `Date: ${dateStr} — Period ${periodNumber}\n` +
      `You will receive a report after the deadline.\n` +
      `- Class Management System`;
    smsService.sendSMS(teacher.phone, teacherMsg).catch(console.error);

    // Schedule auto-close & report after deadline
    const delay = deadline.getTime() - Date.now();
    setTimeout(async () => {
      try {
        await exports._closePollAndReport(poll._id);
      } catch (e) {
        console.error('Auto-close poll error:', e);
      }
    }, delay);

    const populated = await Poll.findById(poll._id)
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .populate('createdBy', 'name');

    res.status(201).json({ success: true, message: 'Poll created and students notified!', poll: populated });
  } catch (err) {
    console.error('createPoll error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating poll.' });
  }
};

// ── Internal: close poll and send report ─────────────────────────────────
exports._closePollAndReport = async (pollId) => {
  const poll = await Poll.findById(pollId)
    .populate('subject', 'name code')
    .populate('teacher', 'name phone')
    .populate('createdBy', 'name phone')
    .populate('responses.student', 'name');

  if (!poll || poll.status === 'reported') return;

  poll.status = 'reported';
  poll.reportSentAt = new Date();
  await poll.save();

  const total    = await User.countDocuments({ role: 'student', isActive: true });
  const yesCount = poll.responses.filter(r => r.answer === 'yes').length;
  const noCount  = poll.responses.filter(r => r.answer === 'no').length;
  const report   = buildReport(poll, yesCount, noCount, total);

  const smsService = require('../services/smsService');

  // Send report to teacher with action prompt
  const teacherReport = report + '\n\n📲 Login to ClassMS → Poll Reports to cancel the period if needed.';
  await smsService.sendSMS(poll.teacher.phone, teacherReport).catch(console.error);

  // Send report to CR
  await smsService.sendSMS(poll.createdBy.phone, report).catch(console.error);

  console.log(`✅ Poll ${pollId} closed and report sent.`);
};

// ── Student: respond to poll ──────────────────────────────────────────────
exports.respondToPoll = async (req, res) => {
  try {
    const { id }     = req.params;
    const { answer } = req.body;
    const studentId  = req.user._id;

    if (!['yes', 'no'].includes(answer)) {
      return res.status(400).json({ success: false, message: 'Answer must be yes or no.' });
    }

    const poll = await Poll.findById(id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
    if (poll.status !== 'active') return res.status(400).json({ success: false, message: 'This poll is closed.' });
    if (new Date() > poll.deadline) return res.status(400).json({ success: false, message: 'Poll deadline has passed.' });

    // Check already responded
    const existing = poll.responses.find(r => r.student.toString() === studentId.toString());
    if (existing) {
      existing.answer = answer;
      existing.answeredAt = new Date();
    } else {
      poll.responses.push({ student: studentId, answer });
    }
    await poll.save();

    // Check if all active students have responded
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    if (poll.responses.length >= totalStudents) {
      // All responded — close immediately and send report
      setTimeout(() => exports._closePollAndReport(poll._id).catch(console.error), 1000);
    }

    res.json({ success: true, message: 'Response recorded!', answer });
  } catch (err) {
    console.error('respondToPoll error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Get all polls (CR sees all, students see active ones) ─────────────────
exports.getPolls = async (req, res) => {
  try {
    const query = req.user.role === 'cr'
      ? { createdBy: req.user._id }
      : { status: 'active' };

    const polls = await Poll.find(query)
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .populate('createdBy', 'name')
      .populate('responses.student', 'name')
      .sort({ createdAt: -1 });

    // For each poll, attach student's own answer
    const userId = req.user._id.toString();
    const result = polls.map(p => {
      const obj = p.toObject();
      obj.myAnswer = p.responses.find(r => r.student?._id?.toString() === userId)?.answer || null;
      obj.yesCount = p.responses.filter(r => r.answer === 'yes').length;
      obj.noCount  = p.responses.filter(r => r.answer === 'no').length;
      return obj;
    });

    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    res.json({ success: true, polls: result, totalStudents });
  } catch (err) {
    console.error('getPolls error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Get single poll ───────────────────────────────────────────────────────
exports.getPoll = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .populate('createdBy', 'name')
      .populate('responses.student', 'name');

    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });

    const obj = poll.toObject();
    const userId = req.user._id.toString();
    obj.myAnswer = poll.responses.find(r => r.student?._id?.toString() === userId)?.answer || null;
    obj.yesCount = poll.responses.filter(r => r.answer === 'yes').length;
    obj.noCount  = poll.responses.filter(r => r.answer === 'no').length;

    res.json({ success: true, poll: obj });
  } catch (err) {
    console.error('getSubjectsAndTeachers error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// ── CR: manually close poll and send report ───────────────────────────────
exports.closePoll = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
    if (poll.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your poll.' });
    }
    if (poll.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Poll already closed.' });
    }
    await exports._closePollAndReport(poll._id);
    res.json({ success: true, message: 'Poll closed and report sent to teacher and CR!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Get subjects and teachers for poll creation form ──────────────────────
exports.getSubjectsAndTeachers = async (req, res) => {
  try {
    const subjects = await Subject.find().sort('name');
    const teachers = await User.find({ role: 'teacher', isActive: true }, 'name assignedSubject')
      .populate('assignedSubject', 'name code');
    res.json({ success: true, subjects, teachers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Teacher: get polls for their subjects ─────────────────────────────────
exports.getTeacherPolls = async (req, res) => {
  try {
    const polls = await Poll.find({ teacher: req.user._id })
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .populate('createdBy', 'name')
      .populate('responses.student', 'name')
      .sort({ createdAt: -1 });

    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });

    const result = polls.map(p => {
      const obj = p.toObject();
      obj.yesCount     = p.responses.filter(r => r.answer === 'yes').length;
      obj.noCount      = p.responses.filter(r => r.answer === 'no').length;
      obj.totalStudents = totalStudents;
      obj.pendingCount = totalStudents - obj.yesCount - obj.noCount;
      return obj;
    });

    res.json({ success: true, polls: result, totalStudents });
  } catch (err) {
    console.error('getTeacherPolls error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// ── Teacher: cancel period directly from poll report ─────────────────────
exports.cancelPeriodFromPoll = async (req, res) => {
  try {
    const { pollId, reason } = req.body;

    const poll = await Poll.findById(pollId)
      .populate('subject', 'name')
      .populate('teacher', 'name');

    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });

    if (poll.teacher._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own periods.' });
    }

    // Find the fixed timetable entry for this teacher + period + day
    const FixedTimetable  = require('../models/FixedTimetable');
    const TimetableChange = require('../models/TimetableChange');
    const smsService      = require('../services/smsService');

    const pollDate  = new Date(poll.pollDate);
    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName   = DAY_NAMES[pollDate.getDay()];

    const fixedEntry = await FixedTimetable.findOne({
      teacher:      req.user._id,
      periodNumber: poll.periodNumber,
      dayOfWeek:    dayName,
    });

    if (!fixedEntry) {
      return res.status(404).json({ success: false, message: 'No fixed timetable entry found for this period.' });
    }

    // Check if already cancelled
    const dayStart = new Date(pollDate); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(pollDate); dayEnd.setHours(23,59,59,999);

    const existing = await TimetableChange.findOne({
      fixedTimetableEntry: fixedEntry._id,
      changeDate: { $gte: dayStart, $lte: dayEnd },
    });

    if (existing && existing.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This period is already cancelled.' });
    }

    // Create or update cancellation
    let change;
    if (existing) {
      existing.status     = 'cancelled';
      existing.changeType = 'teacher_unavailable';
      existing.reason     = reason || `Low attendance — Poll: ${poll.question}`;
      await existing.save();
      change = existing;
    } else {
      change = await TimetableChange.create({
        changeDate:          dayStart,
        fixedTimetableEntry: fixedEntry._id,
        teacher:             req.user._id,
        subject:             poll.subject._id,
        periodNumber:        poll.periodNumber,
        startTime:           fixedEntry.startTime,
        endTime:             fixedEntry.endTime,
        className:           fixedEntry.className,
        status:              'cancelled',
        changeType:          'teacher_unavailable',
        reason:              reason || `Low attendance — Poll: ${poll.question}`,
        lastUpdatedBy:       req.user._id,
        lastUpdatedAt:       new Date(),
      });
    }

    // Notify students
    smsService.notifyStudentsAboutChange(change).catch(console.error);

    res.json({ success: true, message: 'Period cancelled! Students notified via WhatsApp.', change });
  } catch (err) {
    console.error('cancelPeriodFromPoll error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};