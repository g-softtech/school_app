const express = require('express');
const router = express.Router();
const { createClass, getAllClasses, getClass, updateClass, deleteClass, getClassStudents } = require('./classes.controller');
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/', restrictTo('admin', 'teacher'), getAllClasses);
router.post('/', restrictTo('admin'), createClass);
router.get('/:id', restrictTo('admin', 'teacher'), getClass);
router.patch('/:id', restrictTo('admin'), updateClass);
router.delete('/:id', restrictTo('admin'), deleteClass);
router.get('/:id/students', restrictTo('admin', 'teacher'), getClassStudents);

module.exports = router;