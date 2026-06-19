const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., "REBUILD_BILL"
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentBill', required: true },
  eventKey: { type: String, required: true }, // Deduplication key: e.g., "REBUILD_BILL:{billId}:{revision}"
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'retry_wait', 'completed', 'dead_letter'], 
    default: 'pending' 
  },
  attempts: { type: Number, default: 0 },
  nextRetryAt: { type: Date, default: Date.now },
  
  // Concurrency & Lease Ownership (Single lock mechanism)
  leaseExpiresAt: { type: Date, default: null },
  workerId: { type: String, default: null },
  
  // Observability & Auditing
  lastAttemptAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  lastErrorAt: { type: Date, default: null },
  errorReason: { type: String, default: null }
}, { timestamps: true });

// Composite indexes for ultra-fast polling and lease sweeps
outboxEventSchema.index({ status: 1, nextRetryAt: 1 });
outboxEventSchema.index({ status: 1, leaseExpiresAt: 1 });

// Deduplication index to prevent event flooding
outboxEventSchema.index({ eventKey: 1 }, { unique: true });

module.exports = mongoose.model('OutboxEvent', outboxEventSchema);
