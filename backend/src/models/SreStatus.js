const mongoose = require('mongoose');

const sreStatusSchema = new mongoose.Schema({
  sreState: {
    type: String,
    enum: ['NORMAL', 'PENDING_FREEZE', 'DEGRADED', 'FROZEN', 'EMERGENCY_BYPASS'],
    default: 'NORMAL'
  },
  freezeReason: { type: String, default: null },
  freezeStartedAt: { type: Date, default: null },
  pendingFreezeStartedAt: { type: Date, default: null },
  recoveryStartedAt: { type: Date, default: null },
  errorBudgetUsed: { type: Number, default: 0 },
  errorBudgetLimit: { type: Number, default: 0 },
  
  breakGlassActive: { type: Boolean, default: false },
  breakGlassExpiresAt: { type: Date, default: null },
  breakGlassReason: { type: String, default: null },
  breakGlassScope: [{ type: String }],
  breakGlassAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  currentTransitionId: { type: String, default: null },
  previousTransitionId: { type: String, default: null },

  currentFastBurn: { type: Number, default: 0 },
  currentMediumBurn: { type: Number, default: 0 },
  currentSlowBurn: { type: Number, default: 0 },
  currentAcceleration: { type: Number, default: 0 },
  
  evaluationVersion: { type: String, default: 'v1.0' },

  lastEvaluatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('SreStatus', sreStatusSchema);
