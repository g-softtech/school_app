const express = require('express');
const router = express.Router();
const { createStudent, getAllStudents, getStudent, getMyProfile, updateStudent, deleteStudent } = require('./students.controller');
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/me', restrictTo('student'), getMyProfile);
router.get('/', restrictTo('admin', 'teacher'), getAllStudents);
router.post('/', restrictTo('admin'), createStudent);
router.get('/:id', restrictTo('admin', 'teacher', 'student'), getStudent);
router.patch('/:id', restrictTo('admin'), updateStudent);
router.delete('/:id', restrictTo('admin'), deleteStudent);

module.exports = router;