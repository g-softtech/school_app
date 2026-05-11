const mongoose = require('mongoose');

const lessonNoteSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Teacher ID is required'] },
    classId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: [true, 'Class ID is required'] },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: [true, 'Subject ID is required'] },
    topic:     { type: String, required: [true, 'Topic is required'], trim: true },
    week:      { type: Number, required: [true, 'Week number is required'], min: 1, max: 20 },
    term:      { type: String, required: [true, 'Term is required'], enum: ['first', 'second', 'third'] },
    session:   { type: String, required: [true, 'Session is required'], trim: true },
    content:   { type: String, default: null, trim: true },
    fileUrl:   { type: String, default: null },
    fileName:  { type: String, default: null },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

lessonNoteSchema.index({ classId: 1, subjectId: 1, term: 1, session: 1 });
lessonNoteSchema.index({ teacherId: 1 });

module.exports = mongoose.model('LessonNote', lessonNoteSchema);