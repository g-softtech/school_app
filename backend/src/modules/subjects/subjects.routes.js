const express = require('express');
const router = express.Router();
const { createSubject, getAllSubjects, getSubject, updateSubject, assignTeacher, deleteSubject } = require('./subjects.controller');
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/', restrictTo('admin', 'teacher'), getAllSubjects);
router.post('/', restrictTo('admin'), createSubject);
router.get('/:id', restrictTo('admin', 'teacher'), getSubject);
router.patch('/:id', restrictTo('admin'), updateSubject);
router.patch('/:id/assign-teacher', restrictTo('admin'), assignTeacher);
router.delete('/:id', restrictTo('admin'), deleteSubject);

module.exports = router;