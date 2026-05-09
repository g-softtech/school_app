const express    = require('express');
const router     = express.Router();
const User       = require('../../models/User');
const Student    = require('../../models/Student');
const Subject    = require('../../models/Subject');
const catchAsync = require('../../utils/catchAsync');
const protect    = require('../../middleware/authMiddleware');

/**
 * GET /api/users/directory
 * Returns messageable users scoped by the caller's role and class relationships.
 *
 * SCOPING RULES:
 *   admin   → all teachers, all students (via User), all parents
 *   teacher → students in their assigned classes + parents of those students + admins
 *   student → teachers assigned to their class + admins
 *   parent  → teachers assigned to their child's class + admins
 *
 * Query params:
 *   ?search=emeka   — filter by name (case-insensitive)
 *   ?limit=50
 */
router.get('/directory', protect, catchAsync(async function(req, res) {
  var me     = req.user;
  var search = req.query.search || '';
  var limit  = Math.min(Number(req.query.limit) || 60, 100);

  var nameFilter = search ? { name: { $regex: search, $options: 'i' } } : {};
  var users = [];

  // ── ADMIN → everyone (or filtered by ?role=) ───────────────────────────
  if (me.role === 'admin') {
    var roleFilter = req.query.role
      ? { role: req.query.role }
      : { role: { $in: ['admin', 'teacher', 'student', 'parent'] } };
    users = await User.find({
      _id: { $ne: me._id },
      ...roleFilter,
      ...nameFilter,
    }, 'name email role').sort({ name: 1 }).limit(limit);
  }

  // ── TEACHER → students & parents in their classes + admins ───────────────
  else if (me.role === 'teacher') {
    // Find all classes this teacher teaches (via Subject model)
    var teacherSubjects = await Subject.find({ teacherId: me._id }).distinct('classId');

    // Get student User IDs in those classes
    var studentsInClass = await Student.find(
      { classId: { $in: teacherSubjects } },
      'userId parentId'
    );

    var studentUserIds = studentsInClass.map(function(s) { return s.userId; });
    var parentUserIds  = studentsInClass
      .filter(function(s) { return s.parentId; })
      .map(function(s) { return s.parentId; });

    var adminIds = await User.find({ role: 'admin' }, '_id');
    var allowedIds = [
      ...studentUserIds,
      ...parentUserIds,
      ...adminIds.map(function(a) { return a._id; }),
    ];

    users = await User.find({
      _id: { $in: allowedIds, $ne: me._id },
      ...nameFilter,
    }, 'name email role').sort({ role: 1, name: 1 }).limit(limit);
  }

  // ── STUDENT → teachers of their class + admins ───────────────────────────
  else if (me.role === 'student') {
    // Find this student's class
    var myStudent = await Student.findOne({ userId: me._id });

    var teacherUserIds = [];
    if (myStudent && myStudent.classId) {
      // Get teacher User IDs from subjects in their class
      var classSubjects = await Subject.find(
        { classId: myStudent.classId, teacherId: { $ne: null } },
        'teacherId'
      );
      teacherUserIds = classSubjects.map(function(s) { return s.teacherId; });
    }

    var admins = await User.find({ role: 'admin' }, '_id');
    var allowedIds = [
      ...teacherUserIds,
      ...admins.map(function(a) { return a._id; }),
    ];

    users = await User.find({
      _id: { $in: allowedIds, $ne: me._id },
      ...nameFilter,
    }, 'name email role').sort({ role: 1, name: 1 }).limit(limit);
  }

  // ── PARENT → teachers of their child's class + admins ────────────────────
  else if (me.role === 'parent') {
    // Find the child linked to this parent
    var myChild = await Student.findOne({ parentId: me._id });

    var childTeacherIds = [];
    if (myChild && myChild.classId) {
      var childSubjects = await Subject.find(
        { classId: myChild.classId, teacherId: { $ne: null } },
        'teacherId'
      );
      childTeacherIds = childSubjects.map(function(s) { return s.teacherId; });
    }

    var adminUsers = await User.find({ role: 'admin' }, '_id');
    var allowedIds = [
      ...childTeacherIds,
      ...adminUsers.map(function(a) { return a._id; }),
    ];

    users = await User.find({
      _id: { $in: allowedIds, $ne: me._id },
      ...nameFilter,
    }, 'name email role').sort({ role: 1, name: 1 }).limit(limit);
  }

  res.status(200).json({
    success: true,
    count:   users.length,
    data:    users,
  });
}));

module.exports = router;
