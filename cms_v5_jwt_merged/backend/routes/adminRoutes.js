const express = require('express');
const router  = express.Router();
const {
  getDashboard, getClasses, createClass, updateClass, deleteClass,
  getUsers, createUser, updateUser, deleteUser,
  getTimetableOverview, updateProjectorCount,
  getTimetableClasses, getTimetableForClass,
  upsertTimetableEntry, deleteTimetableEntry,
  duplicateTimetable, getSubjectsAndTeachers,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const adminOnly = [protect, authorize('admin')];

router.get('/dashboard',              ...adminOnly, getDashboard);
router.get('/classes',                ...adminOnly, getClasses);
router.post('/classes',               ...adminOnly, createClass);
router.put('/classes/:id',            ...adminOnly, updateClass);
router.delete('/classes/:id',         ...adminOnly, deleteClass);
router.get('/users',                  ...adminOnly, getUsers);
router.post('/users',                 ...adminOnly, createUser);
router.put('/users/:id',              ...adminOnly, updateUser);
router.delete('/users/:id',           ...adminOnly, deleteUser);
router.get('/timetable-overview',     ...adminOnly, getTimetableOverview);
router.put('/projectors',             ...adminOnly, updateProjectorCount);

// ── Feature 3: Admin Timetable CRUD ──────────────────────────────────────────
// IMPORTANT: specific routes BEFORE the :className param route to avoid Express shadowing
router.get('/timetable-classes',      ...adminOnly, getTimetableClasses);
router.get('/subjects-teachers',      ...adminOnly, getSubjectsAndTeachers);
router.put('/timetable/entry',        ...adminOnly, upsertTimetableEntry);   // must be before /:className
router.delete('/timetable/entry',     ...adminOnly, deleteTimetableEntry);   // must be before /:className
router.post('/timetable/duplicate',   ...adminOnly, duplicateTimetable);     // must be before /:className
router.get('/timetable/:className',   ...adminOnly, getTimetableForClass);   // param route LAST

module.exports = router;
