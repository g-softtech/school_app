const mongoose = require('mongoose');

const paymentIntentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Student',
    required: true,
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'StudentBill',
    required: true,
  },
  walletAmount: {
    type: Number, default: 0,
  },
  paystackAmount: {
    type: Number, required: true,
  },
  feeType: {
    type: String, required: true,
  },
  term: {
    type: String, required: true,
  },
  session: {
    type: String, required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  reference: {
    type: String, required: true, unique: true,
  }
}, { timestamps: true });

paymentIntentSchema.index({ reference: 1 });
paymentIntentSchema.index({ status: 1 });

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
