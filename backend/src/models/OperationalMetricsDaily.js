const mongoose = require('mongoose');

const operationalMetricsDailySchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD format (UTC)
    required: true,
    unique: true
  },
  throughput: {
    type: Number,
    default: 0
  },
  dlqCount: {
    type: Number,
    default: 0
  },
  activeWorkers: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('OperationalMetricsDaily', operationalMetricsDailySchema);
