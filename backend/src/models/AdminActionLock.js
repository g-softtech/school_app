const mongoose = require('mongoose');

const adminActionLockSchema = new mongoose.Schema({
  actionKey: {
    type: String,
    required: true,
    unique: true
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['running', 'completed'],
    default: 'running'
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

// TTL index to clean up stale/crashed locks
adminActionLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminActionLock', adminActionLockSchema);
