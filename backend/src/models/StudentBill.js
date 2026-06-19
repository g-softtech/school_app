const mongoose = require('mongoose');

const billLineSchema = new mongoose.Schema({
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  feeName:   { type: String, required: true },
  feeType:   { type: String, required: true },
  amount:    { type: Number, required: true, min: 0 },
  discount:  { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  paid:      { type: Number, default: 0 },
  balance:   { type: Number, default: 0 },
  status:    { type: String, enum: ['unpaid','partial','paid','waived'], default: 'unpaid' },
}, { _id: true });

const studentBillSchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true },
  session:      { type: String, required: true, trim: true },
  term:         { type: String, enum: ['first','second','third'], required: true },
  items:        { type: [billLineSchema], default: [] },
  totalAmount:  { type: Number, default: 0 },
  totalPaid:    { type: Number, default: 0 },
  totalBalance: { type: Number, default: 0 },
  status:       { type: String, enum: ['unpaid','partial','paid','overpaid'], default: 'unpaid' },
  carryOver:    { type: Number, default: 0 },
  carryOverSourceBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentBill', default: null },
  carryOverAmountSnapshot: { type: Number, default: 0 },
  discountNote: { type: String, default: null },
  isLocked:     { type: Boolean, default: false },
  revision:     { type: Number, default: 0 },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastProcessedOutboxEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'OutboxEvent', default: null }
}, { timestamps: true });

studentBillSchema.index({ studentId: 1, session: 1, term: 1 }, { unique: true });
studentBillSchema.index({ session: 1, term: 1 });
studentBillSchema.index({ classId: 1, session: 1, term: 1 });

// FIX: use async pre-save with NO next parameter
studentBillSchema.pre('save', async function() {
  this.totalAmount  = this.items.reduce(function(s, i) { return s + i.netAmount; }, 0);
  this.totalPaid    = this.items.reduce(function(s, i) { return s + i.paid; }, 0);
  this.totalBalance = this.totalAmount - this.totalPaid;

  if      (this.totalBalance <  0) this.status = 'overpaid';
  else if (this.totalBalance === 0) this.status = 'paid';
  else if (this.totalPaid    >  0) this.status = 'partial';
  else                              this.status = 'unpaid';

  this.items.forEach(function(item) {
    if (item.status === 'waived') return;
    if      (item.paid >= item.netAmount) item.status = 'paid';
    else if (item.paid >  0)             item.status = 'partial';
    else                                 item.status = 'unpaid';
    item.balance = Math.max(0, item.netAmount - item.paid);
  });
});

module.exports = mongoose.model('StudentBill', studentBillSchema);
