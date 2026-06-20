const mongoose = require('mongoose');

const sreTransitionEventSchema = new mongoose.Schema({
  transitionId: { type: String, required: true, unique: true },
  fromState: { type: String, required: true },
  toState: { type: String, required: true },
  triggerSource: { type: String, required: true }, // e.g. FAST_BURN, MEDIUM_BURN, BREAK_GLASS
  
  burnRateFast: { type: Number, required: true },
  burnRateMedium: { type: Number, required: true },
  burnRateSlow: { type: Number, required: true },
  
  errorAcceleration: { type: Number, required: true },
  normalizedAcceleration: { type: Number, required: true },
  
  timestamp: { type: Date, default: Date.now, immutable: true }
}, { timestamps: true });

module.exports = mongoose.model('SreTransitionEvent', sreTransitionEventSchema);
