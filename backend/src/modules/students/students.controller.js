const User = require('../../models/User');
const Student = require('../../models/Student');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const paginate = require('../../utils/paginate');
const generateAdmissionNumber = require('../../utils/generateAdmissionNumber');

exports.createStudent = catchAsync(async function(req, res, next) {
  var name = req.body.name, email = req.body.email, password = req.body.password;
  var gender = req.body.gender, dateOfBirth = req.body.dateOfBirth;
  var phone = req.body.phone, address = req.body.address, parentId = req.body.parentId;

  if (!name || !email || !password || !gender || !dateOfBirth) {
    return next(new ApiError(400, 'Please provide name, email, password, gender and dateOfBirth'));
  }

  var existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) return next(new ApiError(409, 'A user with this email already exists'));

  if (parentId) {
    var parent = await User.findOne({ _id: parentId, role: 'parent' });
    if (!parent) return next(new ApiError(404, 'Parent not found. parentId must belong to a user with role: parent'));
  }

  var user = await User.create({ name, email, password, role: 'student' });
  var admissionNumber = await generateAdmissionNumber();

  var student = await Student.create({
    userId: user._id,
    admissionNumber,
    gender,
    dateOfBirth,
    phone: phone || null,
    address: address || null,
    parentId: parentId || null,
  });

  res.status(201).json({
    success: true,
    message: 'Student created successfully',
    data: { student, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
});

exports.getAllStudents = catchAsync(async function(req, res, next) {
  var p = paginate(req.query);
  var search = req.query.search, gender = req.query.gender;
  var isActive = req.query.isActive, classId = req.query.classId;

  var filter = {};
  if (gender) filter.gender = gender;
  if (classId) filter.classId = classId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  if (search) {
    var matchingUsers = await User.find({ name: { $regex: search, $options: 'i' }, role: 'student' }, { _id: 1 });
    var userIds = matchingUsers.map(function(u) { return u._id; });
    filter.$or = [{ userId: { $in: userIds } }, { admissionNumber: { $regex: search, $options: 'i' } }];
  }

  var total = await Student.countDocuments(filter);
  var students = await Student.find(filter)
    .populate('userId', 'name email')
    .populate('classId', 'name section academicYear')
    .populate('parentId', 'name email')
    .sort({ createdAt: -1 })
    .skip(p.skip)
    .limit(p.limit);

  res.status(200).json({
    success: true,
    pagination: { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: students,
  });
});

exports.getStudent = catchAsync(async function(req, res, next) {
  var student = await Student.findById(req.params.id)
    .populate('userId', 'name email lastLogin')
    .populate('classId', 'name section academicYear')
    .populate('parentId', 'name email');

  if (!student) return next(new ApiError(404, 'Student not found'));

  if (req.user.role === 'student') {
    var own = await Student.findOne({ userId: req.user._id });
    if (!own || own._id.toString() !== student._id.toString()) {
      return next(new ApiError(403, 'You can only view your own profile'));
    }
  }

  res.status(200).json({ success: true, data: student });
});

exports.getMyProfile = catchAsync(async function(req, res, next) {
  var student = await Student.findOne({ userId: req.user._id })
    .populate('userId', 'name email lastLogin')
    .populate('classId', 'name section academicYear')
    .populate('parentId', 'name email');

  if (!student) return next(new ApiError(404, 'Student profile not found. Contact the school admin.'));
  res.status(200).json({ success: true, data: student });
});

exports.updateStudent = catchAsync(async function(req, res, next) {
  var body = req.body;

  if (body.parentId) {
    var parent = await User.findOne({ _id: body.parentId, role: 'parent' });
    if (!parent) return next(new ApiError(404, 'Parent not found'));
  }

  var fields = {};
  if (body.classId !== undefined) fields.classId = body.classId;
  if (body.parentId !== undefined) fields.parentId = body.parentId;
  if (body.gender !== undefined) fields.gender = body.gender;
  if (body.dateOfBirth !== undefined) fields.dateOfBirth = body.dateOfBirth;
  if (body.phone !== undefined) fields.phone = body.phone;
  if (body.address !== undefined) fields.address = body.address;
  if (body.isActive !== undefined) fields.isActive = body.isActive;

  var student = await Student.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
    .populate('userId', 'name email')
    .populate('classId', 'name section academicYear');

  if (!student) return next(new ApiError(404, 'Student not found'));
  res.status(200).json({ success: true, message: 'Student updated successfully', data: student });
});

exports.deleteStudent = catchAsync(async function(req, res, next) {
  var student = await Student.findById(req.params.id);
  if (!student) return next(new ApiError(404, 'Student not found'));

  await User.findByIdAndDelete(student.userId);
  await Student.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Student and associated user account deleted successfully' });
});