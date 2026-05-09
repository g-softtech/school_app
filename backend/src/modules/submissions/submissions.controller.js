const Submission = require('../../models/Submission');
const Assignment = require('../../models/Assignment');
const Student    = require('../../models/Student');
const ApiError   = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');

function getFileInfo(req) {
  if (!req.file) return { fileUrl: null, fileName: null };
  return { fileUrl: '/uploads/submissions/' + req.file.filename, fileName: req.file.originalname };
}

// POST /api/submissions — Student submits
exports.submitAssignment = catchAsync(async function(req, res, next) {
  var assignmentId = req.body.assignmentId;
  var answer       = req.body.answer;
  var fileInfo     = getFileInfo(req);

  if (!assignmentId) return next(new ApiError(400, 'Please provide assignmentId'));
  if (!answer && !fileInfo.fileUrl) return next(new ApiError(400, 'Please provide an answer (text or file)'));

  var assignment = await Assignment.findById(assignmentId);
  if (!assignment) return next(new ApiError(404, 'Assignment not found'));
  if (!assignment.isActive) return next(new ApiError(400, 'This assignment is no longer accepting submissions'));

  // Check due date
  if (new Date() > new Date(assignment.dueDate)) {
    return next(new ApiError(400, 'Assignment due date has passed'));
  }

  // Find the student profile for this user
  var student = await Student.findOne({ userId: req.user._id });
  if (!student) return next(new ApiError(404, 'Student profile not found'));

  // Check student belongs to the assignment class
  if (String(student.classId) !== String(assignment.classId)) {
    return next(new ApiError(403, 'This assignment is not for your class'));
  }

  // Upsert — student can resubmit before due date
  var existing = await Submission.findOne({ assignmentId, studentId: student._id });

  var submission;
  if (existing) {
    if (existing.status === 'graded') return next(new ApiError(400, 'Your submission has already been graded'));
    existing.answer    = answer || existing.answer;
    existing.fileUrl   = fileInfo.fileUrl || existing.fileUrl;
    existing.fileName  = fileInfo.fileName || existing.fileName;
    existing.submittedAt = new Date();
    await existing.save();
    submission = existing;
  } else {
    submission = await Submission.create({
      assignmentId,
      studentId: student._id,
      answer:    answer || null,
      fileUrl:   fileInfo.fileUrl,
      fileName:  fileInfo.fileName,
    });
  }

  res.status(201).json({ success: true, message: 'Assignment submitted successfully', data: submission });
});

// GET /api/submissions/my — Student sees their own submissions
exports.getMySubmissions = catchAsync(async function(req, res, next) {
  var student = await Student.findOne({ userId: req.user._id });
  if (!student) return next(new ApiError(404, 'Student profile not found'));

  var submissions = await Submission.find({ studentId: student._id })
    .populate({ path: 'assignmentId', select: 'title dueDate maxScore subjectId', populate: { path: 'subjectId', select: 'name' } })
    .sort({ submittedAt: -1 });

  res.status(200).json({ success: true, data: submissions });
});

// PATCH /api/submissions/:id/grade — Teacher grades
exports.gradeSubmission = catchAsync(async function(req, res, next) {
  var score    = req.body.score;
  var feedback = req.body.feedback;

  if (score === undefined) return next(new ApiError(400, 'Please provide a score'));

  var submission = await Submission.findById(req.params.id).populate('assignmentId');
  if (!submission) return next(new ApiError(404, 'Submission not found'));

  var assignment = submission.assignmentId;

  // Verify teacher owns this assignment
  if (req.user.role === 'teacher' && String(assignment.teacherId) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only grade submissions for your own assignments'));
  }

  if (Number(score) > assignment.maxScore) {
    return next(new ApiError(400, 'Score cannot exceed maximum score of ' + assignment.maxScore));
  }

  // Fire assignment graded notification (non-blocking)
  notifSvc.onAssignmentGraded(
    submission.studentId, assignment.title,
    Number(score), assignment.maxScore, feedback || null
  ).catch(() => {});

  var updated = await Submission.findByIdAndUpdate(
    req.params.id,
    { score: Number(score), feedback: feedback || null, status: 'graded', gradedAt: new Date(), gradedBy: req.user._id },
    { new: true }
  )
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name' } })
    .populate('gradedBy', 'name');

  res.status(200).json({ success: true, message: 'Submission graded successfully', data: updated });
});

// GET /api/submissions/:id — Single submission
exports.getSubmission = catchAsync(async function(req, res, next) {
  var submission = await Submission.findById(req.params.id)
    .populate('assignmentId', 'title maxScore dueDate')
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .populate('gradedBy', 'name');

  if (!submission) return next(new ApiError(404, 'Submission not found'));
  res.status(200).json({ success: true, data: submission });
});