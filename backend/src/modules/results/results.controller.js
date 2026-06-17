const Result  = require('../../models/Result');
const Student = require('../../models/Student');
const Subject = require('../../models/Subject');
const Class   = require('../../models/Class');
const Attendance = require('../../models/Attendance');
const mongoose = require('mongoose');
const ApiError   = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const paginate   = require('../../utils/paginate');
const { getGrade, isPassing } = require('../../../services/gradeEngine');
const { getStudentAttendanceStats } = require('../../utils/attendanceHelper');

// Helper — compute total, grade, remark from ca + exam
function computeResult(ca, exam) {
  var total = ca + exam;
  var g = getGrade(total);
  return { total: total, grade: g.grade, remark: g.remark };
}


// ─── Upload single result ─────────────────────────────────────────────────────
exports.uploadResult = catchAsync(async function(req, res, next) {
  var studentId = req.body.studentId;
  var subjectId = req.body.subjectId;
  var classId   = req.body.classId;
  var term      = req.body.term;
  var session   = req.body.session;
  var ca        = Number(req.body.ca);
  var exam      = Number(req.body.exam);

  if (!studentId || !subjectId || !classId || !term || !session) {
    return next(new ApiError(400, 'Please provide studentId, subjectId, classId, term and session'));
  }
  if (isNaN(ca) || isNaN(exam)) return next(new ApiError(400, 'CA and exam must be numbers'));
  if (ca < 0   || ca > 40)     return next(new ApiError(400, 'CA score must be between 0 and 40'));
  if (exam < 0 || exam > 60)   return next(new ApiError(400, 'Exam score must be between 0 and 60'));

  var student = await Student.findById(studentId);
  if (!student) return next(new ApiError(404, 'Student not found'));

  var subject = await Subject.findById(subjectId);
  if (!subject) return next(new ApiError(404, 'Subject not found'));

  if (req.user.role === 'teacher' && String(subject.teacherId) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only upload results for subjects assigned to you'));
  }

  var computed = computeResult(ca, exam);

  var result = await Result.findOneAndUpdate(
    { studentId: studentId, subjectId: subjectId, term: term, session: session },
    {
      studentId:  studentId,
      subjectId:  subjectId,
      classId:    classId,
      term:       term,
      session:    session,
      ca:         ca,
      exam:       exam,
      total:      computed.total,
      grade:      computed.grade,
      remark:     computed.remark,
      uploadedBy: req.user._id,
    },
    { new: true, upsert: true, runValidators: false }
  )
    .populate('studentId', 'admissionNumber')
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .populate('uploadedBy','name');

  res.status(200).json({ success: true, message: 'Result uploaded successfully', data: result });
});

// ─── Bulk upload ──────────────────────────────────────────────────────────────
exports.bulkUpload = catchAsync(async function(req, res, next) {
  var classId  = req.body.classId;
  var term     = req.body.term;
  var session  = req.body.session;
  var results  = req.body.results;

  if (!classId || !term || !session) {
    return next(new ApiError(400, 'Please provide classId, term and session'));
  }
  if (!Array.isArray(results) || results.length === 0) {
    return next(new ApiError(400, 'results must be a non-empty array'));
  }

  var saved  = [];
  var errors = [];

  for (var i = 0; i < results.length; i++) {
    var r    = results[i];
    var ca   = Number(r.ca);
    var exam = Number(r.exam);

    try {
      if (!r.studentId || !r.subjectId) throw new Error('studentId and subjectId are required');
      if (isNaN(ca)   || ca < 0   || ca > 40)   throw new Error('CA must be 0-40');
      if (isNaN(exam) || exam < 0 || exam > 60)  throw new Error('Exam must be 0-60');

      var computed = computeResult(ca, exam);

      var doc = await Result.findOneAndUpdate(
        { studentId: r.studentId, subjectId: r.subjectId, term: term, session: session },
        {
          studentId:  r.studentId,
          subjectId:  r.subjectId,
          classId:    classId,
          term:       term,
          session:    session,
          ca:         ca,
          exam:       exam,
          total:      computed.total,
          grade:      computed.grade,
          remark:     computed.remark,
          uploadedBy: req.user._id,
        },
        { new: true, upsert: true, runValidators: false }
      );
      saved.push(doc);
    } catch (err) {
      errors.push({ index: i, studentId: r.studentId, subjectId: r.subjectId, error: err.message });
    }
  }

  res.status(200).json({
    success: true,
    message: saved.length + ' result(s) uploaded. ' + errors.length + ' error(s).',
    saved:  saved.length,
    errors: errors,
  });
});

// ─── Get results for a student ────────────────────────────────────────────────
exports.getStudentResults = catchAsync(async function(req, res, next) {
  var studentId = req.params.studentId;
  var term      = req.query.term;
  var session   = req.query.session;

  var student = await Student.findById(studentId)
    .populate('userId', 'name')
    .populate('classId', 'name section');
  if (!student) return next(new ApiError(404, 'Student not found'));

  if (req.user.role === 'student') {
    var own = await Student.findOne({ userId: req.user._id });
    if (!own || String(own._id) !== String(studentId)) {
      return next(new ApiError(403, 'You can only view your own results'));
    }
  }

  if (req.user.role === 'parent') {
    if (!student.parentId || String(student.parentId) !== String(req.user._id)) {
      return next(new ApiError(403, 'You can only view your child\'s results'));
    }
  }

  var filter = { studentId: studentId };
  if (term)    filter.term    = term;
  if (session) filter.session = session;

  var results = await Result.find(filter)
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .sort({ createdAt: 1 });

  var totalScore = 0;
  var passCount  = 0;
  results.forEach(function(r) {
    totalScore += r.total;
    if (isPassing(r.grade)) passCount++;
  });

  var average = results.length > 0 ? Number((totalScore / results.length).toFixed(1)) : 0;

  var attendanceStats = await getStudentAttendanceStats(studentId, term, session);

  res.status(200).json({
    success: true,
    student: { 
      name: student.userId.name, 
      admissionNumber: student.admissionNumber,
      classId: student.classId
    },
    summary: {
      totalSubjects: results.length,
      passed:  passCount,
      failed:  results.length - passCount,
      average: average,
      totalScore: totalScore,
      attendance: attendanceStats
    },
    data: results,
  });
});

// ─── Get class results — raw populated docs for frontend table + report card
exports.getClassResults = catchAsync(async function(req, res, next) {
  var classId   = req.params.classId;
  var term      = req.query.term;
  var session   = req.query.session;
  var studentId = req.query.studentId;

  var cls = await Class.findById(classId);
  if (!cls) return next(new ApiError(404, 'Class not found'));

  if (!term || !session) {
    return next(new ApiError(400, 'Please provide term and session as query params'));
  }

  var filter = { classId: classId, term: term, session: session };
  if (studentId) filter.studentId = studentId;

  var results = await Result.find(filter)
    .populate({
      path:     'studentId',
      select:   'admissionNumber userId classId',
      populate: { path: 'userId', select: 'name email' },
    })
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .sort({ createdAt: -1 })
    .limit(500);

  res.status(200).json({
    success: true,
    count:   results.length,
    data:    results,
  });
});

// ─── Get single result ────────────────────────────────────────────────────────
exports.getResult = catchAsync(async function(req, res, next) {
  var result = await Result.findById(req.params.id)
    .populate('studentId', 'admissionNumber')
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .populate('uploadedBy','name');

  if (!result) return next(new ApiError(404, 'Result not found'));
  res.status(200).json({ success: true, data: result });
});

// ─── Update result ────────────────────────────────────────────────────────────
exports.updateResult = catchAsync(async function(req, res, next) {
  var result = await Result.findById(req.params.id);
  if (!result) return next(new ApiError(404, 'Result not found'));

  var ca   = req.body.ca   !== undefined ? Number(req.body.ca)   : result.ca;
  var exam = req.body.exam !== undefined ? Number(req.body.exam) : result.exam;

  if (isNaN(ca)   || ca < 0   || ca > 40)   return next(new ApiError(400, 'CA must be 0-40'));
  if (isNaN(exam) || exam < 0 || exam > 60)  return next(new ApiError(400, 'Exam must be 0-60'));

  var computed = computeResult(ca, exam);

  var updated = await Result.findByIdAndUpdate(
    req.params.id,
    { ca: ca, exam: exam, total: computed.total, grade: computed.grade, remark: computed.remark },
    { new: true }
  )
    .populate('subjectId', 'name code')
    .populate('studentId', 'admissionNumber');

  res.status(200).json({ success: true, message: 'Result updated successfully', data: updated });
});

// ─── Delete result ────────────────────────────────────────────────────────────
exports.deleteResult = catchAsync(async function(req, res, next) {
  var result = await Result.findByIdAndDelete(req.params.id);
  if (!result) return next(new ApiError(404, 'Result not found'));
  res.status(200).json({ success: true, message: 'Result deleted successfully' });
});