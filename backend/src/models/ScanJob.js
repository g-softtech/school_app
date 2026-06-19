const mongoose = require('mongoose');

const scanJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  progress: {
    processedCount: { type: Number, default: 0 },
    totalExpected: { type: Number, default: 0 }
  },
  anomalies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditLedger' },
    currentBalance: Number,
    calculatedBalance: Number,
    driftAmount: Number,
    driftLevel: { type: String, enum: ['minor', 'moderate', 'critical'] }
  }],
  anomaliesFound: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  errorReason: { type: String },
  scanTimestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ScanJob', scanJobSchema);
