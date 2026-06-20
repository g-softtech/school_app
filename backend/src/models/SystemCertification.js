const mongoose = require('mongoose');

const systemCertificationSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true, immutable: true }, // e.g. "v1.0.0" or commit hash
  batchId: { type: String, required: true, index: true, immutable: true }, // The batch ID linking the ChaosRunReports
  status: { type: String, enum: ['PASS', 'FAIL'], required: true, immutable: true },
  
  runIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChaosRunReport', immutable: true }],
  
  metrics: {
    maxJobLossRate: { type: Number, immutable: true }, // 0 is passing
    maxDuplicateExecution: { type: Number, immutable: true }, // 0 is passing
    workerFailureToleranceLevel: { type: Number, immutable: true }, // Max kills survived
    concurrencyCeiling: { type: Number, immutable: true },
    transactionIntegrity: { type: String, immutable: true } // PASS / FAIL
  },
  
  certifiedAt: { type: Date, default: Date.now, immutable: true }
}, { timestamps: true });

module.exports = mongoose.model('SystemCertification', systemCertificationSchema);
