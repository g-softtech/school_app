const Subject = require('../../models/Subject');
const Class = require('../../models/Class');
const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const paginate = require('../../utils/paginate');

exports.createSubject = catchAsync(async function(req, res, next) {
  var name = req.body.name, code = req.body.code;
  var classId = req.body.classId, teacherId = req.body.teacherId, description = req.body.description;

  if (!name || !code || !classId) return next(new ApiError(400, 'Please provide subject name, code and classId'));

  var cls = await Class.findById(classId);
  if (!cls) return next(new ApiError(404, 'Class not found. Please provide a valid classId'));

  if (teacherId) {
    var teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) return next(new ApiError(404, 'Teacher not found. teacherId must belong to a user with role: teacher'));
  }

  var subject = await Subject.create({ name, code, classId, teacherId, description });
  var populated = await Subject.findById(subject._id)
    .populate('classId', 'name section academicYear')
    .populate('teacherId', 'name email');

  res.status(201).json({ success: true, message: 'Subject created successfully', data: populated });
});

exports.getAllSubjects = catchAsync(async function(req, res, next) {
  var p = paginate(req.query);
  var filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.user.role === 'teacher') filter.teacherId = req.user._id;

  var total = await Subject.countDocuments(filter);
  var subjects = await Subject.find(filter)
    .populate('classId', 'name section academicYear')
    .populate('teacherId', 'name email')
    .sort({ name: 1 })
    .skip(p.skip)
    .limit(p.limit);

  res.status(200).json({
    success: true,
    pagination: { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: subjects,
  });
});

exports.getSubject = catchAsync(async function(req, res, next) {
  var subject = await Subject.findById(req.params.id)
    .populate('classId', 'name section academicYear')
    .populate('teacherId', 'name email');

  if (!subject) return next(new ApiError(404, 'Subject not found'));
  res.status(200).json({ success: true, data: subject });
});

exports.updateSubject = catchAsync(async function(req, res, next) {
  var body = req.body;

  if (body.classId) {
    var cls = await Class.findById(body.classId);
    if (!cls) return next(new ApiError(404, 'Class not found'));
  }
  if (body.teacherId) {
    var teacher = await User.findOne({ _id: body.teacherId, role: 'teacher' });
    if (!teacher) return next(new ApiError(404, 'Teacher not found'));
  }

  var fields = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.code !== undefined) fields.code = body.code.toUpperCase();
  if (body.classId !== undefined) fields.classId = body.classId;
  if (body.teacherId !== undefined) fields.teacherId = body.teacherId;
  if (body.description !== undefined) fields.description = body.description;
  if (body.isActive !== undefined) fields.isActive = body.isActive;

  var subject = await Subject.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
    .populate('classId', 'name section academicYear')
    .populate('teacherId', 'name email');

  if (!subject) return next(new ApiError(404, 'Subject not found'));
  res.status(200).json({ success: true, message: 'Subject updated successfully', data: subject });
});

exports.assignTeacher = catchAsync(async function(req, res, next) {
  var teacherId = req.body.teacherId;
  if (!teacherId) return next(new ApiError(400, 'Please provide teacherId'));

  var teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
  if (!teacher) return next(new ApiError(404, 'Teacher not found. teacherId must belong to a user with role: teacher'));

  var subject = await Subject.findByIdAndUpdate(req.params.id, { teacherId }, { new: true })
    .populate('classId', 'name section')
    .populate('teacherId', 'name email');

  if (!subject) return next(new ApiError(404, 'Subject not found'));
  res.status(200).json({ success: true, message: teacher.name + ' assigned to ' + subject.name + ' successfully', data: subject });
});

exports.deleteSubject = catchAsync(async function(req, res, next) {
  var subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) return next(new ApiError(404, 'Subject not found'));
  res.status(200).json({ success: true, message: 'Subject deleted successfully' });
});