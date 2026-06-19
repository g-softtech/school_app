const mongoose = require('mongoose');

const billAdjustmentSchema = new mongoose.Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentBill', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['discount', 'waiver', 'penalty', 'scholarship', 'transfer_in', 'transfer_out'], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  transferGroupId: { type: String, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['applied', 'reversed'], default: 'applied' }
}, { timestamps: true });

billAdjustmentSchema.index({ billId: 1, status: 1 });
billAdjustmentSchema.index({ billId: 1, itemId: 1, status: 1 });

module.exports = mongoose.model('BillAdjustment', billAdjustmentSchema);
