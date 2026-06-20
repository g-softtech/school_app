const mongoose = require('mongoose');

const chaosRunReportSchema = new mongoose.Schema({
  testName: { type: String, required: true }, // e.g. "SNIPER", "CONCURRENCY", "ROLLBACK"
  batchId: { type: String, required: true, index: true }, // Ties multiple tests together into one suite run
  status: { type: String, enum: ['PASS', 'FAIL'], required: true },
  
  // High-level statistics
  totalJobs: { type: Number },
  completedJobs: { type: Number },
  failedJobs: { type: Number },
  
  // Specific telemetry
  workerKills: { type: Number, default: 0 },
  executionTimeMs: { type: Number, required: true },
  
  // Custom metrics specific to the test
  metrics: { type: mongoose.Schema.Types.Mixed },
  
  // Error messages or specific failures
  anomalies: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('ChaosRunReport', chaosRunReportSchema);
