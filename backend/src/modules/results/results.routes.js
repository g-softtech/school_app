const express = require('express');
const router  = express.Router();
const {
  uploadResult,
  bulkUpload,
  getStudentResults,
  getClassResults,
  getResult,
  updateResult,
  deleteResult,
} = require('./results.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

// Upload
router.post('/',      restrictTo('admin', 'teacher'), uploadResult);
router.post('/bulk',  restrictTo('admin', 'teacher'), bulkUpload);

// Read
router.get('/student/:studentId', restrictTo('admin', 'teacher', 'student', 'parent'), getStudentResults);
router.get('/class/:classId',     restrictTo('admin', 'teacher'), getClassResults);
router.get('/:id',                restrictTo('admin', 'teacher'), getResult);

// Modify
router.patch('/:id',  restrictTo('admin', 'teacher'), updateResult);
router.delete('/:id', restrictTo('admin'), deleteResult);

module.exports = router;