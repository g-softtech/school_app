const Result   = require('../../models/Result');
const Student  = require('../../models/Student');
const Teacher  = require('../../models/User');
const User     = require('../../models/User');
const Class    = require('../../models/Class');
const Subject  = require('../../models/Subject');
const Payment  = require('../../models/Payment');
const Message  = require('../../models/Message');
const ApiError   = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const { isPassing } = require('../../../services/gradeEngine');

// ─── School-wide analytics (Admin) ───────────────────────────────────────────
// GET /api/analytics/school
// Admin only
exports.getSchoolAnalytics = catchAsync(async function(req, res, next) {
  var term    = req.query.term;
  var session = req.query.session;

  // Counts
  var totalStudents = await Student.countDocuments({ isActive: true });
  var totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
  var totalParents  = await User.countDocuments({ role: 'parent',  isActive: true });
  var totalClasses  = await Class.countDocuments({ isActive: true });
  var totalSubjects = await Subject.countDocuments({ isActive: true });

  // Result stats (filtered by term/session if provided)
  var resultFilter = {};
  if (term)    resultFilter.term    = term;
  if (session) resultFilter.session = session;

  var resultStats = await Result.aggregate([
    { $match: resultFilter },
    {
      $group: {
        _id:        null,
        avgScore:   { $avg: '$total' },
        totalExams: { $sum: 1 },
        passCount:  {
          $sum: {
            $cond: [{ $in: ['$grade', ['A1','B2','B3','C4','C5','C6']] }, 1, 0]
          }
        },
        failCount: {
          $sum: {
            $cond: [{ $in: ['$grade', ['D7','E8','F9']] }, 1, 0]
          }
        },
      },
    },
  ]);

  var stats = resultStats.length > 0 ? resultStats[0] : { avgScore: 0, totalExams: 0, passCount: 0, failCount: 0 };
  var passRate = stats.totalExams > 0 ? Number(((stats.passCount / stats.totalExams) * 100).toFixed(1)) : 0;

  // Best and worst subjects
  var subjectPerformance = await Result.aggregate([
    { $match: resultFilter },
    {
      $group: {
        _id:      '$subjectId',
        avgScore: { $avg: '$total' },
        count:    { $sum: 1 },
      },
    },
    { $sort: { avgScore: -1 } },
    {
      $lookup: {
        from:         'subjects',
        localField:   '_id',
        foreignField: '_id',
        as:           'subject',
      },
    },
    { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        subjectName: '$subject.name',
        subjectCode: '$subject.code',
        avgScore:    { $round: ['$avgScore', 1] },
        count:       1,
      },
    },
  ]);

  var bestSubject  = subjectPerformance.length > 0 ? subjectPerformance[0] : null;
  var worstSubject = subjectPerformance.length > 0 ? subjectPerformance[subjectPerformance.length - 1] : null;

  // Grade distribution
  var gradeDistribution = await Result.aggregate([
    { $match: resultFilter },
    { $group: { _id: '$grade', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Revenue stats
  var revenueStats = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalPayments: { $sum: 1 } } },
  ]);
  var revenue = revenueStats.length > 0 ? revenueStats[0] : { totalRevenue: 0, totalPayments: 0 };

  // Recent payments (last 5)
  var recentPayments = await Payment.find({ status: 'paid' })
    .populate('studentId', 'admissionNumber')
    .sort({ paidAt: -1 })
    .limit(5);

  res.status(200).json({
    success: true,
    data: {
      counts: {
        students: totalStudents,
        teachers: totalTeachers,
        parents:  totalParents,
        classes:  totalClasses,
        subjects: totalSubjects,
      },
      academic: {
        totalExams:        stats.totalExams,
        averageScore:      Number((stats.avgScore || 0).toFixed(1)),
        passRate:          passRate,
        totalPassed:       stats.passCount,
        totalFailed:       stats.failCount,
        bestSubject:       bestSubject,
        worstSubject:      worstSubject,
        gradeDistribution: gradeDistribution,
        subjectPerformance: subjectPerformance,
      },
      financial: {
        totalRevenue:  revenue.totalRevenue,
        totalPayments: revenue.totalPayments,
        recentPayments: recentPayments,
      },
    },
  });
});

// ─── Class analytics (Teacher / Admin) ───────────────────────────────────────
// GET /api/analytics/class/:classId
exports.getClassAnalytics = catchAsync(async function(req, res, next) {
  var classId = req.params.classId;
  var term    = req.query.term;
  var session = req.query.session;

  var cls = await Class.findById(classId);
  if (!cls) return next(new ApiError(404, 'Class not found'));

  if (!term || !session) {
    return next(new ApiError(400, 'Please provide term and session as query params'));
  }

  var filter = { classId: classId, term: term, session: session };

  // Overall class performance
  var classStats = await Result.aggregate([
    { $match: { classId: require('mongoose').Types.ObjectId.createFromHexString(classId), term: term, session: session } },
    {
      $group: {
        _id:       null,
        avgScore:  { $avg: '$total' },
        highScore: { $max: '$total' },
        lowScore:  { $min: '$total' },
        total:     { $sum: 1 },
        passed: {
          $sum: { $cond: [{ $in: ['$grade', ['A1','B2','B3','C4','C5','C6']] }, 1, 0] }
        },
      },
    },
  ]);

  var stats = classStats.length > 0 ? classStats[0] : { avgScore: 0, highScore: 0, lowScore: 0, total: 0, passed: 0 };

  // Per-subject averages for this class
  var subjectAverages = await Result.aggregate([
    { $match: { classId: require('mongoose').Types.ObjectId.createFromHexString(classId), term: term, session: session } },
    { $group: { _id: '$subjectId', avgScore: { $avg: '$total' }, passCount: { $sum: { $cond: [{ $in: ['$grade', ['A1','B2','B3','C4','C5','C6']] }, 1, 0] } }, count: { $sum: 1 } } },
    { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
    { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
    { $project: { subjectName: '$subject.name', avgScore: { $round: ['$avgScore', 1] }, passCount: 1, count: 1 } },
    { $sort: { avgScore: -1 } },
  ]);

  // Student ranking — each student's average
  var studentRankings = await Result.aggregate([
    { $match: { classId: require('mongoose').Types.ObjectId.createFromHexString(classId), term: term, session: session } },
    { $group: { _id: '$studentId', avgScore: { $avg: '$total' }, totalScore: { $sum: '$total' }, subjects: { $sum: 1 } } },
    { $sort: { avgScore: -1 } },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'student.userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        studentName:      '$user.name',
        admissionNumber:  '$student.admissionNumber',
        avgScore:         { $round: ['$avgScore', 1] },
        totalScore:       1,
        subjects:         1,
      },
    },
  ]);

  // Add position
  studentRankings.forEach(function(s, i) { s.position = i + 1; });

  var enrolledCount = await Student.countDocuments({ classId: classId, isActive: true });
  var passRate = stats.total > 0 ? Number(((stats.passed / stats.total) * 100).toFixed(1)) : 0;

  res.status(200).json({
    success: true,
    class:   cls.name + (cls.section ? ' ' + cls.section : ''),
    term:    term,
    session: session,
    data: {
      overview: {
        enrolledStudents: enrolledCount,
        averageScore:     Number((stats.avgScore || 0).toFixed(1)),
        highestScore:     stats.highScore,
        lowestScore:      stats.lowScore,
        passRate:         passRate,
      },
      subjectAverages:  subjectAverages,
      studentRankings:  studentRankings,
    },
  });
});

// ─── Student personal analytics ───────────────────────────────────────────────
// GET /api/analytics/student/:studentId
// Admin, Teacher, Student (own only), Parent (child only)
exports.getStudentAnalytics = catchAsync(async function(req, res, next) {
  var studentId = req.params.studentId;

  var student = await Student.findById(studentId).populate('userId', 'name');
  if (!student) return next(new ApiError(404, 'Student not found'));

  // Access control
  if (req.user.role === 'student') {
    var own = await Student.findOne({ userId: req.user._id });
    if (!own || String(own._id) !== String(studentId)) {
      return next(new ApiError(403, 'You can only view your own analytics'));
    }
  }
  if (req.user.role === 'parent') {
    if (!student.parentId || String(student.parentId) !== String(req.user._id)) {
      return next(new ApiError(403, 'You can only view your child\'s analytics'));
    }
  }

  // Term-by-term average trend
  var termTrend = await Result.aggregate([
    { $match: { studentId: require('mongoose').Types.ObjectId.createFromHexString(studentId) } },
    {
      $group: {
        _id:      { term: '$term', session: '$session' },
        avgScore: { $avg: '$total' },
        passed:   { $sum: { $cond: [{ $in: ['$grade', ['A1','B2','B3','C4','C5','C6']] }, 1, 0] } },
        total:    { $sum: 1 },
      },
    },
    { $sort: { '_id.session': 1, '_id.term': 1 } },
    {
      $project: {
        term:     '$_id.term',
        session:  '$_id.session',
        avgScore: { $round: ['$avgScore', 1] },
        passed:   1,
        total:    1,
        passRate: { $round: [{ $multiply: [{ $divide: ['$passed', '$total'] }, 100] }, 1] },
      },
    },
  ]);

  // Subject strengths — average per subject across all terms
  var subjectStrengths = await Result.aggregate([
    { $match: { studentId: require('mongoose').Types.ObjectId.createFromHexString(studentId) } },
    { $group: { _id: '$subjectId', avgScore: { $avg: '$total' }, count: { $sum: 1 } } },
    { $sort: { avgScore: -1 } },
    { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
    { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
    { $project: { subjectName: '$subject.name', avgScore: { $round: ['$avgScore', 1] }, count: 1 } },
  ]);

  var bestSubject  = subjectStrengths.length > 0 ? subjectStrengths[0] : null;
  var worstSubject = subjectStrengths.length > 0 ? subjectStrengths[subjectStrengths.length - 1] : null;

  // Overall summary
  var overall = await Result.aggregate([
    { $match: { studentId: require('mongoose').Types.ObjectId.createFromHexString(studentId) } },
    {
      $group: {
        _id:      null,
        avgScore: { $avg: '$total' },
        highest:  { $max: '$total' },
        lowest:   { $min: '$total' },
        total:    { $sum: 1 },
        passed:   { $sum: { $cond: [{ $in: ['$grade', ['A1','B2','B3','C4','C5','C6']] }, 1, 0] } },
      },
    },
  ]);

  var o = overall.length > 0 ? overall[0] : { avgScore: 0, highest: 0, lowest: 0, total: 0, passed: 0 };

  res.status(200).json({
    success: true,
    student: {
      name:            student.userId.name,
      admissionNumber: student.admissionNumber,
    },
    data: {
      overall: {
        averageScore:  Number((o.avgScore || 0).toFixed(1)),
        highestScore:  o.highest,
        lowestScore:   o.lowest,
        totalExams:    o.total,
        totalPassed:   o.passed,
        totalFailed:   o.total - o.passed,
        overallPassRate: o.total > 0 ? Number(((o.passed / o.total) * 100).toFixed(1)) : 0,
      },
      bestSubject:      bestSubject,
      worstSubject:     worstSubject,
      termTrend:        termTrend,
      subjectStrengths: subjectStrengths,
    },
  });
});

// ─── Payment analytics (Admin) ────────────────────────────────────────────────
// GET /api/analytics/payments
exports.getPaymentAnalytics = catchAsync(async function(req, res, next) {
  var session = req.query.session;

  var matchFilter = { status: 'paid' };
  if (session) matchFilter.session = session;

  // Revenue by fee type
  var revenueByFeeType = await Payment.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$feeType', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  // Revenue by term
  var revenueByTerm = await Payment.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$term', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Revenue by payment method
  var revenueByMethod = await Payment.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  // Pending payments count and amount
  var pending = await Payment.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  var totalRevenue = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalRevenue:    totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      totalPaid:       totalRevenue.length > 0 ? totalRevenue[0].count : 0,
      pendingAmount:   pending.length > 0 ? pending[0].total : 0,
      pendingCount:    pending.length > 0 ? pending[0].count : 0,
      revenueByFeeType: revenueByFeeType,
      revenueByTerm:    revenueByTerm,
      revenueByMethod:  revenueByMethod,
    },
  });
});