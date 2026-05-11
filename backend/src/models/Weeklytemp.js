const mongoose = require('mongoose');

const weeklyPlannerSchema = new mongoose.Schema(
  {
    teacherId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: [true, 'Teacher ID is required'] },
    classId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: [true, 'Class ID is required'] },
    subjectId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: [true, 'Subject ID is required'] },
    week:           { type: Number, required: [true, 'Week number is required'], min: 1, max: 20 },
    term:           { type: String, required: [true, 'Term is required'], enum: ['first', 'second', 'third'] },
    session:        { type: String, required: [true, 'Session is required'], trim: true },
    topicsCovered:  { type: [String], default: [] },
    notes:          { type: String, default: null, trim: true },
    completionStatus: {
      type: String,
      enum: ['planned', 'in_progress', 'completed'],
      default: 'planned',
    },
  },
  { timestamps: true }
);

weeklyPlannerSchema.index({ teacherId: 1, classId: 1, subjectId: 1, week: 1, term: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyPlanner', weeklyPlannerSchema);