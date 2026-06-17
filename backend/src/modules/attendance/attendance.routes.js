const express = require('express');
const router = express.Router();
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');
const { getAttendance, saveAttendance } = require('./attendance.controller');

router.use(protect);
router.use(restrictTo('admin', 'teacher'));

router.route('/')
  .get(getAttendance)
  .post(saveAttendance);

module.exports = router;
