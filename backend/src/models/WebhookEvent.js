const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  eventId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['paystack', 'flutterwave', 'system'],
    default: 'paystack'
  },
  status: { 
    type: String, 
    enum: ['processing', 'processed', 'failed'], 
    default: 'processing' 
  },
  eventType: {
    type: String
  },
  payload: {
    type: Object,
    default: {}
  },
  errorReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = WebhookEvent;
