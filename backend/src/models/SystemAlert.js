const mongoose = require('mongoose');

const systemAlertSchema = new mongoose.Schema({
  alertKey: {
    type: String,
    required: true,
    index: true
  },
  fingerprint: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['warning', 'critical', 'escalated_critical'],
    required: true
  },
  source: {
    type: String,
    default: 'financial_outbox'
  },
  status: {
    type: String,
    enum: ['active', 'resolved'],
    default: 'active',
    index: true
  },
  message: {
    type: String,
    required: true
  },
  firstTriggeredAt: {
    type: Date,
    default: Date.now
  },
  lastSentAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  triggerCount: {
    type: Number,
    default: 1
  },
  currentValue: {
    type: Number
  },
  peakValue: {
    type: Number
  },
  pendingResolutionSince: {
    type: Date
  }
}, { timestamps: true });

systemAlertSchema.index({ status: 1 });
systemAlertSchema.index({ severity: 1 });
systemAlertSchema.index({ createdAt: -1 });
systemAlertSchema.index({ resolvedAt: -1 });

module.exports = mongoose.model('SystemAlert', systemAlertSchema);
