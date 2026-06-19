const catchAsync = require('../../utils/catchAsync');
const CreditTransaction = require('../../models/CreditTransaction');
const CreditLedger = require('../../models/CreditLedger');

exports.getLedgerAuditChain = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const ledger = await CreditLedger.findOne({ userId });
  if (!ledger) {
    return res.status(404).json({ success: false, message: 'Ledger not found for user' });
  }

  const transactions = await CreditTransaction.find({ ledgerId: ledger._id })
    .sort({ createdAt: -1 })
    .populate('relatedBillId', 'term session status')
    .lean();

  // Map to human-readable origins
  const auditChain = transactions.map(tx => {
    let originDescription = tx.sourceEventType;
    if (tx.sourceEventType === 'payment') originDescription = 'Cash Receipt Overpayment';
    if (tx.sourceEventType === 'waiver') originDescription = 'Admin Waiver Reversal';
    if (tx.sourceEventType === 'legacy_payment') originDescription = 'Legacy Payment Conversion';

    if (tx.type === 'allocation') originDescription = 'Bill Allocation';
    if (tx.type === 'refund') originDescription = 'Cash Refund';
    if (tx.type === 'correction') originDescription = 'System Correction / Merge';

    return {
      _id: tx._id,
      date: tx.createdAt,
      glReference: tx.glReference,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      type: tx.type,
      sourceEventType: tx.sourceEventType,
      sourceEventId: tx.sourceEventId,
      originDescription,
      notes: tx.notes
    };
  });

  res.status(200).json({
    success: true,
    data: {
      ledgerStatus: ledger.status,
      currentBalance: ledger.balance,
      auditChain
    }
  });
});
