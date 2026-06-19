const mongoose = require('mongoose');

const creditLedgerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  balance: { 
    type: Number, 
    required: true, 
    default: 0, 
    min: [0, 'Credit balance cannot be negative'] 
  },
  status: { 
    type: String, 
    enum: ['active', 'frozen', 'closed', 'under_review'], 
    default: 'active' 
  },
  rebuildInProgress: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const CreditLedger = mongoose.model('CreditLedger', creditLedgerSchema);

module.exports = CreditLedger;
