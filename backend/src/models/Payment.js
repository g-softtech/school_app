const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Student',
    required: [true, 'Student ID is required'],
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'StudentBill', default: null,
  },
  amount: {
    type: Number, required: [true, 'Amount is required'], min: [1, 'Amount must be > 0'],
  },
  feeType: {
    type: String, required: [true, 'Fee type is required'],
    enum: ['tuition','exam','sports','library','development','transport',
           'hostel','pta','uniform','feeding','ict','other'],
  },
  term:    { type: String, required: true, enum: ['first','second','third'] },
  session: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending','paid','failed','cancelled','awaiting_approval','reversed'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['paystack','flutterwave','cash','bank_transfer','pos','cheque','wallet'],
    default: 'paystack',
  },
  reference:     { type: String, unique: true, sparse: true },
  glReference:   { type: String, index: true },
  paystackData:  { type: Object, default: null },
  receiptNumber: { type: String, unique: true, sparse: true },
  bankName:       { type: String, default: null },
  accountName:    { type: String, default: null },
  transactionRef: { type: String, default: null },
  requiresApproval: { type: Boolean, default: false },
  approvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:       { type: Date, default: null },
  rejectedReason:   { type: String, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paidAt:     { type: Date, default: null },
  notes:      { type: String, default: null },
}, { timestamps: true });

paymentSchema.index({ studentId: 1, term: 1, session: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ billId: 1 });
paymentSchema.index({ reference: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
