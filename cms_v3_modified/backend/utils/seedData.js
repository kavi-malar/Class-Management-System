/**
 * Seed Data — v3
 * Multi-class, Admin, Room Allocation, Projector Inventory
 */
const path     = require('path');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User               = require('../models/User');
const Subject            = require('../models/Subject');
const FixedTimetable     = require('../models/FixedTimetable');
const ClassSection       = require('../models/ClassSection');
const RoomAllocation     = require('../models/RoomAllocation');
const ProjectorInventory = require('../models/ProjectorInventory');

const subjects = [
  { name: 'Mathematics',        code: 'MATH' },
  { name: 'Physics',            code: 'PHY'  },
  { name: 'Chemistry',          code: 'CHEM' },
  { name: 'English',            code: 'ENG'  },
  { name: 'Computer Science',   code: 'CS'   },
  { name: 'Biology',            code: 'BIO'  },
  { name: 'History',            code: 'HIST' },
  { name: 'Physical Education', code: 'PE'   },
];

const PERIOD_TIMES = {
  1: { start: '09:00', end: '09:45' },
  2: { start: '09:45', end: '10:30' },
  3: { start: '10:45', end: '11:30' },
  4: { start: '11:30', end: '12:15' },
  5: { start: '13:00', end: '13:45' },
  6: { start: '13:45', end: '14:30' },
  7: { start: '14:30', end: '15:15' },
  8: { start: '15:15', end: '16:00' },
};

const timetableData = [
  ['Monday',1,0],['Monday',2,1],['Monday',3,2],['Monday',4,3],['Monday',6,4],['Monday',8,5],
  ['Tuesday',1,3],['Tuesday',3,6],['Tuesday',4,0],['Tuesday',5,1],['Tuesday',7,4],['Tuesday',8,7],
  ['Wednesday',1,4],['Wednesday',2,5],['Wednesday',4,0],['Wednesday',5,2],['Wednesday',7,3],['Wednesday',8,1],
  ['Thursday',1,1],['Thursday',2,6],['Thursday',3,3],['Thursday',5,4],['Thursday',6,0],['Thursday',8,7],
  ['Friday',1,2],['Friday',2,3],['Friday',3,1],['Friday',4,5],['Friday',5,6],['Friday',7,0],
  ['Saturday',1,5],['Saturday',3,4],['Saturday',4,1],['Saturday',5,3],['Saturday',6,0],['Saturday',8,2],
];

const seed = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/class_management_db';
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');

  await Promise.all([
    User.deleteMany({}),
    Subject.deleteMany({}),
    FixedTimetable.deleteMany({}),
    ClassSection.deleteMany({}),
    RoomAllocation.deleteMany({}),
    ProjectorInventory.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Admin user ──────────────────────────────────────────────────────────────
  await User.create({
    name: 'Admin User', email: 'admin@school.edu', password: 'admin123',
    role: 'admin', phone: '+919000000000', className: 'ADMIN'
  });
  console.log('✅ Admin user created: admin@school.edu / admin123');

  // ── Subjects ────────────────────────────────────────────────────────────────
  const createdSubjects = await Subject.insertMany(subjects);
  console.log(`✅ ${createdSubjects.length} subjects inserted`);

  // ── Teachers ─────────────────────────────────────────────────────────────────
  const teacherData = [
    { name: 'Mr. Arjun Kumar',  email: 'arjun@school.edu',   password: 'teacher123', role: 'teacher', phone: '+919994127068' },
    { name: 'Ms. Priya Sharma', email: 'priya@school.edu',   password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Dr. Rajan Nair',   email: 'rajan@school.edu',   password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Ms. Sneha Patel',  email: 'sneha@school.edu',   password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Mr. Vikram Singh', email: 'vikram@school.edu',  password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Dr. Anita Menon',  email: 'anita@school.edu',   password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Mr. Suresh Rao',   email: 'suresh@school.edu',  password: 'teacher123', role: 'teacher', phone: '+919715261032' },
    { name: 'Ms. Kavitha Devi', email: 'kavitha@school.edu', password: 'teacher123', role: 'teacher', phone: '+919715261032' },
  ];
  const teacherDocs = [];
  for (let i = 0; i < teacherData.length; i++) {
    const doc = await User.create({ ...teacherData[i], assignedSubject: createdSubjects[i]._id, className: 'CSE-A' });
    teacherDocs.push(doc);
  }
  console.log(`✅ ${teacherDocs.length} teachers inserted`);

  // ── Class Sections ───────────────────────────────────────────────────────────
  const classes = [
    { name: 'CSE-A',  department: 'CSE',  batch: '2022-2026', semester: 4, isActive: true },
    { name: 'CSE-B',  department: 'CSE',  batch: '2022-2026', semester: 4, isActive: true },
    { name: 'ECE-A',  department: 'ECE',  batch: '2023-2027', semester: 2, isActive: true },
    { name: 'MECH-A', department: 'MECH', batch: '2023-2027', semester: 2, isActive: true },
  ];
  const createdClasses = await ClassSection.insertMany(classes);
  console.log(`✅ ${createdClasses.length} class sections inserted`);

  // ── Students & CRs per class ─────────────────────────────────────────────────
  const classStudents = [
    { class: 'CSE-A', students: [
      { name: 'Rahul Verma',    email: 'rahul@student.edu',   password: 'student123', phone: '+919578436689' },
      { name: 'Anjali Gupta',   email: 'anjali@student.edu',  password: 'student123', phone: '+919715261031' },
      { name: 'Mohan Das',      email: 'mohan@student.edu',   password: 'student123', phone: '+919789233639' },
    ], cr: { name: 'Preethi CR-A', email: 'cr.csea@student.edu', password: 'cr123456', phone: '+917639375316' }},
    { class: 'CSE-B', students: [
      { name: 'Deepa Krishnan', email: 'deepa@student.edu',   password: 'student123', phone: '+919715261032' },
      { name: 'Arun Pillai',    email: 'arun@student.edu',    password: 'student123', phone: '+919578436689' },
    ], cr: { name: 'Kumar CR-B',   email: 'cr.cseb@student.edu', password: 'cr123456', phone: '+917639375317' }},
    { class: 'ECE-A', students: [
      { name: 'Sita Ram',       email: 'sita@student.edu',    password: 'student123', phone: '+919578436690' },
    ], cr: { name: 'Meena CR-ECE', email: 'cr.ece@student.edu',  password: 'cr123456', phone: '+917639375318' }},
    { class: 'MECH-A', students: [
      { name: 'Ravi Shankar',   email: 'ravi@student.edu',    password: 'student123', phone: '+919578436691' },
    ], cr: { name: 'Sunil CR-MECH',email: 'cr.mech@student.edu', password: 'cr123456', phone: '+917639375319' }},
  ];

  for (const cls of classStudents) {
    for (const s of cls.students) {
      await User.create({ ...s, role: 'student', className: cls.class });
    }
    await User.create({ ...cls.cr, role: 'cr', className: cls.class });
  }
  console.log(`✅ Students and CRs inserted`);

  // ── Timetable for CSE-A ──────────────────────────────────────────────────────
  let count = 0;
  for (const [day, periodNum, subIdx] of timetableData) {
    const slot = PERIOD_TIMES[periodNum];
    await FixedTimetable.create({
      dayOfWeek: day, periodNumber: periodNum,
      startTime: slot.start, endTime: slot.end,
      subject: createdSubjects[subIdx]._id,
      teacher: teacherDocs[subIdx]._id,
      className: 'CSE-A',
      classroomNo: 'TBD'
    });
    count++;
  }
  // Simple timetable for CSE-B
  const cseB = [['Monday',1,4],['Monday',3,0],['Tuesday',2,1],['Wednesday',4,2],['Thursday',1,3]];
  for (const [day, periodNum, subIdx] of cseB) {
    const slot = PERIOD_TIMES[periodNum];
    await FixedTimetable.create({
      dayOfWeek: day, periodNumber: periodNum,
      startTime: slot.start, endTime: slot.end,
      subject: createdSubjects[subIdx]._id,
      teacher: teacherDocs[subIdx]._id,
      className: 'CSE-B',
      classroomNo: 'TBD'
    });
    count++;
  }
  console.log(`✅ ${count} timetable entries inserted`);

  // ── Room Allocations (101–130) ───────────────────────────────────────────────
  const roomDocs = [];
  for (let r = 101; r <= 130; r++) {
    roomDocs.push({ roomNumber: String(r), status: 'free', projectorPresent: false });
  }
  await RoomAllocation.insertMany(roomDocs);
  console.log(`✅ 30 rooms (101–130) created`);

  // ── Projector Inventory ──────────────────────────────────────────────────────
  await ProjectorInventory.create({ totalProjectors: 10, availableProjectors: 10 });
  console.log('✅ Projector inventory: 10 total, 10 available');

  console.log('\n📋 LOGIN CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN:      admin@school.edu          / admin123');
  console.log('TEACHER:    arjun@school.edu           / teacher123');
  console.log('CR CSE-A:   cr.csea@student.edu        / cr123456');
  console.log('CR CSE-B:   cr.cseb@student.edu        / cr123456');
  console.log('STUDENT:    rahul@student.edu           / student123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
  console.log('\n✅ Seeding complete!');
};

exports.seedIfEmpty = async () => {
  try {
    const count = await FixedTimetable.countDocuments();
    if (count === 0) {
      console.log('📦 Database empty — running initial seed...');
      await seed();
    } else {
      console.log(`✅ Database has ${count} timetable entries — skipping seed`);
    }
  } catch (err) {
    console.error('❌ seedIfEmpty error:', err);
  }
};

if (require.main === module) {
  seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
}
