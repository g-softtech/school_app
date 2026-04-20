const express = require('express');
const router  = express.Router();
const {
  getSchoolAnalytics,
  getClassAnalytics,
  getStudentAnalytics,
  getPaymentAnalytics,
} = require('./analytics.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/school',              restrictTo('admin'), getSchoolAnalytics);
router.get('/payments',            restrictTo('admin'), getPaymentAnalytics);
router.get('/class/:classId',      restrictTo('admin', 'teacher'), getClassAnalytics);
router.get('/student/:studentId',  restrictTo('admin', 'teacher', 'student', 'parent'), getStudentAnalytics);

module.exports = router;