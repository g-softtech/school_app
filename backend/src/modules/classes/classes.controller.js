const Class = require('../../models/Class');
const User = require('../../models/User');
const Student = require('../../models/Student');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const paginate = require('../../utils/paginate');

exports.createClass = catchAsync(async function(req, res, next) {
  var name = req.body.name, section = req.body.section;
  var academicYear = req.body.academicYear, classTeacherId = req.body.classTeacherId;

  if (!name || !academicYear) return next(new ApiError(400, 'Please provide class name and academicYear'));

  if (classTeacherId) {
    var teacher = await User.findOne({ _id: classTeacherId, role: 'teacher' });
    if (!teacher) return next(new ApiError(404, 'Teacher not found. classTeacherId must belong to a user with role: teacher'));
  }

  var newClass = await Class.create({ name, section, academicYear, classTeacherId });
  res.status(201).json({ success: true, message: 'Class created successfully', data: newClass });
});

exports.getAllClasses = catchAsync(async function(req, res, next) {
  var p = paginate(req.query);
  var filter = {};
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  var total = await Class.countDocuments(filter);
  var classes = await Class.find(filter)
    .populate('classTeacherId', 'name email')
    .sort({ name: 1, section: 1 })
    .skip(p.skip)
    .limit(p.limit);

  res.status(200).json({
    success: true,
    pagination: { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: classes,
  });
});

exports.getClass = catchAsync(async function(req, res, next) {
  var cls = await Class.findById(req.params.id).populate('classTeacherId', 'name email');
  if (!cls) return next(new ApiError(404, 'Class not found'));

  var studentCount = await Student.countDocuments({ classId: req.params.id });
  var data = cls.toJSON();
  data.studentCount = studentCount;

  res.status(200).json({ success: true, data: data });
});

exports.updateClass = catchAsync(async function(req, res, next) {
  var body = req.body;

  if (body.classTeacherId) {
    var teacher = await User.findOne({ _id: body.classTeacherId, role: 'teacher' });
    if (!teacher) return next(new ApiError(404, 'Teacher not found'));
  }

  var fields = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.section !== undefined) fields.section = body.section;
  if (body.academicYear !== undefined) fields.academicYear = body.academicYear;
  if (body.classTeacherId !== undefined) fields.classTeacherId = body.classTeacherId;
  if (body.isActive !== undefined) fields.isActive = body.isActive;

  var cls = await Class.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
    .populate('classTeacherId', 'name email');

  if (!cls) return next(new ApiError(404, 'Class not found'));
  res.status(200).json({ success: true, message: 'Class updated successfully', data: cls });
});

exports.deleteClass = catchAsync(async function(req, res, next) {
  var cls = await Class.findById(req.params.id);
  if (!cls) return next(new ApiError(404, 'Class not found'));

  var studentCount = await Student.countDocuments({ classId: req.params.id });
  if (studentCount > 0) {
    return next(new ApiError(400, 'Cannot delete class — ' + studentCount + ' student(s) are still enrolled. Reassign them first.'));
  }

  await Class.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Class deleted successfully' });
});

exports.getClassStudents = catchAsync(async function(req, res, next) {
  var cls = await Class.findById(req.params.id);
  if (!cls) return next(new ApiError(404, 'Class not found'));

  var p = paginate(req.query);
  var total = await Student.countDocuments({ classId: req.params.id, isActive: true });
  var students = await Student.find({ classId: req.params.id, isActive: true })
    .populate('userId', 'name email')
    .sort({ admissionNumber: 1 })
    .skip(p.skip)
    .limit(p.limit);

  res.status(200).json({
    success: true,
    class: cls.fullName,
    pagination: { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: students,
  });
});