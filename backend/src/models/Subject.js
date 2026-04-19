// Lives at: backend/src/models/Subject.js

const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      // e.g. "Mathematics", "English Language"
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      // e.g. "MATH", "ENG", "BIO"
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class ID is required — every subject belongs to a class'],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // The teacher assigned to teach this subject in this class
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookup of all subjects in a class
subjectSchema.index({ classId: 1 });
subjectSchema.index({ teacherId: 1 });

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;