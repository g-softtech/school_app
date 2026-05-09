const mongoose = require('mongoose');

const termSchema = new mongoose.Schema({
  name:      { type: String, enum: ['first','second','third'], required: true },
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  isActive:  { type: Boolean, default: false },
}, { _id: true });

const academicSessionSchema = new mongoose.Schema({
  name: {
    type: String, required: true, trim: true, unique: true,
    // e.g. "2025/2026"
  },
  startDate:  { type: Date, required: true },
  endDate:    { type: Date, required: true },
  isCurrent:  { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },
  terms:      [termSchema],
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Only one session can be current at a time
academicSessionSchema.pre('save', async function(next) {
  if (this.isModified('isCurrent') && this.isCurrent) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isCurrent: false });
  }
  next();
});

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
