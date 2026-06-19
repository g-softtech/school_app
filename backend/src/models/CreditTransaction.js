const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  ledgerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CreditLedger', 
    required: true, 
    index: true 
  },
  glReference: { 
    type: String, 
    required: true, 
    index: true 
  },
  sourceEventId: { 
    type: String 
  }, // ID of the upstream event causing this transaction
  sourceEventType: {
    type: String,
    enum: ['payment', 'waiver', 'refund', 'manual_adjustment', 'wallet_merge']
  },
  relatedBillId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'StudentBill' 
  }, // if used for a bill or from a waiver
  relatedBillItemId: { 
    type: mongoose.Schema.Types.ObjectId 
  }, // specifically which item was waived/allocated to
  amount: { 
    type: Number, 
    required: true 
  }, // Positive = deposit, Negative = withdrawal
  type: { 
    type: String, 
    enum: ['overpayment', 'waiver_reversal', 'allocation', 'refund', 'correction'], 
    required: true 
  },
  balanceAfter: { 
    type: Number, 
    required: true, 
    min: [0, 'Balance after transaction cannot be negative'] 
  },
  notes: { 
    type: String 
  }
}, { timestamps: true });

// Ensure transactions are append-only/immutable at the schema level.
// Mongoose middleware to prevent updates and deletes.
creditTransactionSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be updated'));
});
creditTransactionSchema.pre('updateOne', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be updated'));
});
creditTransactionSchema.pre('updateMany', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be updated'));
});
creditTransactionSchema.pre('deleteOne', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be deleted'));
});
creditTransactionSchema.pre('deleteMany', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be deleted'));
});
creditTransactionSchema.pre('findOneAndDelete', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be deleted'));
});
creditTransactionSchema.pre('findOneAndRemove', function(next) {
  next(new Error('CreditTransaction is immutable and cannot be deleted'));
});

// Legacy Migration Normalizer
creditTransactionSchema.pre('validate', function(next) {
  if (this.sourcePaymentId && !this.sourceEventId) {
    this.sourceEventType = 'legacy_payment';
    this.sourceEventId = this.sourcePaymentId.toString();
  }
  next();
});

// Idempotency guarantee: prevent duplicate processing of the same financial event
creditTransactionSchema.index(
  { sourceEventType: 1, sourceEventId: 1 },
  { unique: true, partialFilterExpression: { sourceEventId: { $type: 'string' } } }
);

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

module.exports = CreditTransaction;
