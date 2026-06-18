const express = require('express');
const router  = express.Router();
const {
  getDashboard, getClasses, createClass, updateClass, deleteClass,
  getUsers, createUser, updateUser, deleteUser,
  getTimetableOverview, updateProjectorCount
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const adminOnly = [protect, authorize('admin')];

router.get('/dashboard',            ...adminOnly, getDashboard);
router.get('/classes',              ...adminOnly, getClasses);
router.post('/classes',             ...adminOnly, createClass);
router.put('/classes/:id',          ...adminOnly, updateClass);
router.delete('/classes/:id',       ...adminOnly, deleteClass);
router.get('/users',                ...adminOnly, getUsers);
router.post('/users',               ...adminOnly, createUser);
router.put('/users/:id',            ...adminOnly, updateUser);
router.delete('/users/:id',         ...adminOnly, deleteUser);
router.get('/timetable-overview',   ...adminOnly, getTimetableOverview);
router.put('/projectors',           ...adminOnly, updateProjectorCount);

module.exports = router;
