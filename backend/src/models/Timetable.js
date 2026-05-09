const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  day:       { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday'], required: true },
  period:    { type: Number, min: 1, max: 10, required: true }, // period number in the day
  startTime: { type: String, required: true }, // e.g. "08:00"
  endTime:   { type: String, required: true }, // e.g. "08:40"
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    default: null },
  label:     { type: String, default: null }, // e.g. "Break", "Assembly"
}, { _id: true });

const timetableSchema = new mongoose.Schema({
  classId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true },
  academicSession:{ type: String, required: true }, // e.g. "2025/2026"
  term:           { type: String, enum: ['first','second','third'], required: true },
  periods:        [periodSchema],
  periodConfig:   { type: mongoose.Schema.Types.Mixed, default: null }, // stores custom period time config
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

timetableSchema.index({ classId: 1, academicSession: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
