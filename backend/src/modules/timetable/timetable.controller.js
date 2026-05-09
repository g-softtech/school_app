const Timetable  = require('../../models/Timetable');
const ApiError   = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');

// GET /api/timetable?classId=&session=&term=
exports.get = catchAsync(async (req, res, next) => {
  const { classId, session, term } = req.query;
  if (!classId) return next(new ApiError(400, 'classId is required'));

  const timetable = await Timetable.findOne({
    classId, academicSession: session, term,
  })
    .populate('periods.subjectId', 'name code')
    .populate('periods.teacherId', 'name');

  res.json({ success: true, data: timetable || null });
});

// POST /api/timetable  — create or replace
exports.upsert = catchAsync(async (req, res, next) => {
  const { classId, academicSession, term, periods, periodConfig } = req.body;
  if (!classId || !academicSession || !term) {
    return next(new ApiError(400, 'classId, academicSession and term are required'));
  }

  const timetable = await Timetable.findOneAndUpdate(
    { classId, academicSession, term },
    { classId, academicSession, term, periods: periods || [], periodConfig: periodConfig || null, createdBy: req.user._id },
    { upsert: true, new: true, runValidators: true }
  )
    .populate('periods.subjectId', 'name code')
    .populate('periods.teacherId', 'name');

  res.json({ success: true, message: 'Timetable saved', data: timetable });
});

// DELETE /api/timetable/:id
exports.remove = catchAsync(async (req, res, next) => {
  const t = await Timetable.findByIdAndDelete(req.params.id);
  if (!t) return next(new ApiError(404, 'Timetable not found'));
  res.json({ success: true, message: 'Timetable deleted' });
});
