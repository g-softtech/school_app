const mongoose = require('mongoose');

const workerNodeSchema = new mongoose.Schema({
  workerId: {
    type: String,
    required: true,
    unique: true
  },
  hostname: {
    type: String,
    required: true
  },
  pid: {
    type: Number,
    required: true
  },
  lastSeenAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { timestamps: true });

// TTL index to automatically remove stale workers after 3 minutes (180 seconds)
workerNodeSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 180 });

module.exports = mongoose.model('WorkerNode', workerNodeSchema);
