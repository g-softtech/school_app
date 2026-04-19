const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: [true, 'Student ID is required'] },
    subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: [true, 'Subject ID is required'] },
    classId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: [true, 'Class ID is required'] },
    term: {
      type: String,
      required: [true, 'Term is required'],
      enum: { values: ['first', 'second', 'third'], message: 'Term must be first, second or third' },
    },
    session:    { type: String, required: [true, 'Session is required'], trim: true },
    ca:         { type: Number, required: [true, 'CA score is required'],   min: 0, max: 40 },
    exam:       { type: Number, required: [true, 'Exam score is required'], min: 0, max: 60 },
    total:      { type: Number },
    grade:      { type: String },
    remark:     { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Only use pre-save — no pre-findOneAndUpdate hook needed
// The controller calculates total/grade before calling findOneAndUpdate
resultSchema.pre('save', function(next) {
  this.total = this.ca + this.exam;
  var g = require('../../services/gradeEngine').getGrade(this.total);
  this.grade  = g.grade;
  this.remark = g.remark;
  next();
});

resultSchema.index({ studentId: 1, subjectId: 1, term: 1, session: 1 }, { unique: true });
resultSchema.index({ classId: 1, term: 1, session: 1 });
resultSchema.index({ studentId: 1 });

module.exports = mongoose.model('Result', resultSchema);