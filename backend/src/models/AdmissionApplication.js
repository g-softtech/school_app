const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  // Student info
  fullName:    { type: String, required: true, trim: true },
  dateOfBirth: { type: Date },
  gender:      { type: String, enum: ['male','female','other'] },
  applyingFor: { type: String, required: true }, // class e.g. "JSS 1"

  // Parent/Guardian info
  parentName:  { type: String, required: true, trim: true },
  email:       { type: String, required: true, trim: true, lowercase: true },
  phone:       { type: String, required: true, trim: true },
  address:     { type: String, trim: true },
  notes:       { type: String },

  // Status management
  status: {
    type: String,
    enum: ['pending','reviewing','accepted','rejected'],
    default: 'pending',
  },
  adminNotes:  { type: String },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:  { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('AdmissionApplication', admissionSchema);
