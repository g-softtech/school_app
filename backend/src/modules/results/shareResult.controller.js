const jwt    = require('jsonwebtoken');
const Result = require('../../models/Result');
const Student= require('../../models/Student');
const ApiError   = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const { getStudentAttendanceStats } = require('../../utils/attendanceHelper');
const { isPassing } = require('../../../services/gradeEngine');
const CLIENT_URL = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://smartschool-app.onrender.com' : 'http://localhost:5173');

// POST /api/results/share-token — generates a shareable token
// Student or Admin
exports.generateShareToken = catchAsync(async function(req, res, next) {
  var studentId = req.body.studentId;
  var term      = req.body.term;
  var session   = req.body.session;

  if (!studentId || !term || !session) {
    return next(new ApiError(400, 'Please provide studentId, term and session'));
  }

  // Students can only share their own results
  if (req.user.role === 'student') {
    var own = await Student.findOne({ userId: req.user._id });
    if (!own || String(own._id) !== String(studentId)) {
      return next(new ApiError(403, 'You can only share your own results'));
    }
  }

  // Sign a JWT that expires in 24 hours
  var token = jwt.sign(
    { studentId, term, session },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  var shareUrl = CLIENT_URL + '/results/shared/' + token;

  res.status(200).json({
    success:  true,
    message:  'Shareable link generated. Valid for 24 hours.',
    shareUrl: shareUrl,
    token:    token,
    expiresIn: '24 hours',
  });
});

// GET /api/results/share/:token — backward compat redirect to frontend page
exports.viewSharedResult = catchAsync(async function(req, res) {
  var token = req.params.token;
  return res.redirect(302, CLIENT_URL + '/results/share/' + token);
});

// GET /api/results/share-data/:token — public, no auth, returns JSON for the SharedResult frontend page
exports.viewSharedResultData = catchAsync(async function(req, res, next) {
  var token = req.params.token;

  var decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new ApiError(401, 'This result link has expired or is invalid'));
  }

  var student = await Student.findById(decoded.studentId)
    .populate('userId',  'name')
    .populate('classId', 'name section');

  if (!student) return next(new ApiError(404, 'Student not found'));

  var results = await Result.find({ studentId: decoded.studentId, term: decoded.term, session: decoded.session })
    .populate('subjectId', 'name code')
    .sort({ createdAt: 1 });

  var totalScore = 0;
  var passCount  = 0;
  results.forEach(function(r) {
    totalScore += r.total;
    if (isPassing(r.grade)) passCount++;
  });

  var attendanceStats = await getStudentAttendanceStats(student._id, decoded.term, decoded.session);

  res.status(200).json({
    success: true,
    student: {
      userId:          { name: student.userId ? student.userId.name : 'N/A' },
      admissionNumber: student.admissionNumber,
      classId:         student.classId || null,
    },
    term:    decoded.term,
    session: decoded.session,
    summary: {
      totalSubjects: results.length,
      totalScore,
      average: results.length > 0 ? Number((totalScore / results.length).toFixed(1)) : 0,
      passed:  passCount,
      failed:  results.length - passCount,
      attendance: attendanceStats
    },
    data: results,
  });
});