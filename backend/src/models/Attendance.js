const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    required: true,
  },
  notes: {
    type: String,
    default: '',
  }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  term: {
    type: String,
    required: true,
    enum: ['first', 'second', 'third']
  },
  session: {
    type: String,
    required: true,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  records: [recordSchema]
}, { timestamps: true });

// Prevent duplicate attendance sheets for the same class on the same day
attendanceSchema.index({ classId: 1, date: 1, term: 1, session: 1 }, { unique: true });

// Fast report card queries
attendanceSchema.index({ 'records.studentId': 1, term: 1, session: 1 });

// Ensure date is always normalized to UTC midnight before saving
attendanceSchema.pre('save', async function () {
  if (this.isModified('date')) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  
  // Basic validation to ensure no duplicate student entries in the same sheet
  if (this.isModified('records')) {
    const studentIds = this.records.map(r => r.studentId.toString());
    const uniqueIds = new Set(studentIds);
    if (uniqueIds.size !== studentIds.length) {
      throw new Error('Duplicate studentId found in attendance records.');
    }
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
