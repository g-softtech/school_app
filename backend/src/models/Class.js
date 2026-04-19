// Lives at: backend/src/models/Class.js

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      // e.g. "JSS 1", "SS 2", "Primary 4"
    },
    section: {
      type: String,
      trim: true,
      default: null,
      // e.g. "A", "B", "Gold" — optional arm/section
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      // e.g. "2025/2026"
    },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // The teacher assigned as form teacher for this class
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: full display name e.g. "JSS 1 A"
classSchema.virtual('fullName').get(function () {
  return this.section ? `${this.name} ${this.section}` : this.name;
});

// Prevent duplicate class+section+academicYear combinations
classSchema.index({ name: 1, section: 1, academicYear: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);
module.exports = Class;