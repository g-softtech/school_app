const mongoose = require('mongoose');
const CreditLedger = require('../models/CreditLedger');
const CreditTransaction = require('../models/CreditTransaction');
const Counter = require('../models/Counter');

class IdempotencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdempotencyError';
    this.isDuplicate = true;
  }
}

class LedgerLockedError extends Error {
  constructor(message = 'Ledger is currently locked for integrity rebuild.') {
    super(message);
    this.name = 'LedgerLockedError';
  }
}

/**
 * Utility wrapper to execute any logic within a managed MongoDB Transaction Session.
 */
exports.withLedgerSession = async (fn) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Factory pattern to enforce session usage.
 */
exports.getLedgerServices = (session) => {
  if (!session) {
    throw new Error('FATAL: Database session is required to instantiate ledger services. This enforces ACID compliance architecture.');
  }

  const generateGLReference = async () => {
    const year = new Date().getFullYear();
    const counterId = `gl_reference_${year}`;
    
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    const sequenceStr = String(counter.seq).padStart(6, '0');
    return `GL-${year}-${sequenceStr}`;
  };

  const waitForRebuild = async (userId, maxWaitMs = 15000) => {
    const start = Date.now();
    while(Date.now() - start < maxWaitMs) {
      const ledger = await CreditLedger.findOne({ userId }).session(session);
      if (!ledger || !ledger.rebuildInProgress) return ledger;
      // Sleep for 1 second before checking again
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new LedgerLockedError('Ledger is currently locked for integrity rebuild (queue timeout).');
  };

  return {
    addToLedger: async ({ userId, amount, sourceEventId, sourceEventType, relatedBillId, relatedBillItemId, type, notes }) => {
      if (amount <= 0) throw new Error('Amount to add must be greater than zero.');

      // 0. Service-level Idempotency Pre-Check using generic FinancialEvent keys
      if (sourceEventId && sourceEventType) {
        const existingTx = await CreditTransaction.findOne({
          sourceEventId,
          sourceEventType,
          ...(relatedBillId && { relatedBillId }),
          ...(relatedBillItemId && { relatedBillItemId })
        }).session(session);

        if (existingTx) {
          const ledger = await CreditLedger.findById(existingTx.ledgerId).session(session);
          return { ledger, transaction: existingTx, isDuplicate: true };
        }
      }

      await waitForRebuild(userId);

      let ledger;
      try {
        ledger = await CreditLedger.findOneAndUpdate(
          { userId, rebuildInProgress: false },
          { $inc: { balance: amount } },
          { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );
      } catch (err) {
        if (err.code === 11000) throw new LedgerLockedError();
        throw err;
      }

      if (ledger.status !== 'active') {
        throw new Error(`Cannot add funds to a ${ledger.status} ledger.`);
      }

      const glReference = await generateGLReference();

      // 3. Append to Immutable Event Stream
      try {
        const transaction = await CreditTransaction.create([{
          ledgerId: ledger._id,
          glReference,
          sourceEventId,
          sourceEventType,
          relatedBillId,
          relatedBillItemId,
          amount,
          type,
          balanceAfter: ledger.balance,
          notes
        }], { session });

        return { ledger, transaction: transaction[0] };
      } catch (error) {
        if (error.code === 11000) {
          throw new IdempotencyError('Duplicate CreditTransaction detected at write-time.');
        }
        throw error;
      }
    },

    allocateCredit: async ({ userId, amount, relatedBillId, relatedBillItemId, notes }) => {
      if (amount <= 0) throw new Error('Amount to consume must be greater than zero.');

      await waitForRebuild(userId);

      const ledger = await CreditLedger.findOneAndUpdate(
        { userId, balance: { $gte: amount }, status: 'active', rebuildInProgress: false },
        { $inc: { balance: -amount } },
        { new: true, session }
      );

      if (!ledger) {
        // Could be insufficient funds OR locked. We already checked lock above, but just in case.
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const glReference = await generateGLReference();

      const transaction = await CreditTransaction.create([{
        ledgerId: ledger._id,
        glReference,
        relatedBillId,
        relatedBillItemId,
        amount: -amount,
        type: 'allocation',
        balanceAfter: ledger.balance,
        notes
      }], { session });

      return { ledger, transaction: transaction[0] };
    },

    refundCredit: async ({ userId, amount, notes }) => {
      if (amount <= 0) throw new Error('Refund amount must be greater than zero.');

      await waitForRebuild(userId);

      const ledger = await CreditLedger.findOneAndUpdate(
        { userId, balance: { $gte: amount }, status: 'active', rebuildInProgress: false },
        { $inc: { balance: -amount } },
        { new: true, session }
      );

      if (!ledger) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const glReference = await generateGLReference();

      const transaction = await CreditTransaction.create([{
        ledgerId: ledger._id,
        glReference,
        amount: -amount,
        type: 'refund',
        balanceAfter: ledger.balance,
        notes
      }], { session });

      return { ledger, transaction: transaction[0] };
    },

    reversalCorrection: async ({ userId, amount, sourceEventId, sourceEventType, notes }) => {
      if (amount <= 0) throw new Error('Amount must be greater than zero.');

      await waitForRebuild(userId);

      const ledger = await CreditLedger.findOneAndUpdate(
        { userId, balance: { $gte: amount }, status: 'active', rebuildInProgress: false },
        { $inc: { balance: -amount } },
        { new: true, session }
      );

      if (!ledger) throw new Error('INSUFFICIENT_FUNDS');

      const glReference = await generateGLReference();

      const transaction = await CreditTransaction.create([{
        ledgerId: ledger._id,
        glReference,
        sourceEventId,
        sourceEventType,
        amount: -amount,
        type: 'correction',
        balanceAfter: ledger.balance,
        notes
      }], { session });

      return { ledger, transaction: transaction[0] };
    },

    
    rebuildBillBalances: async (billId, session) => {
      const StudentBill = require('../models/StudentBill');
      const BillAdjustment = require('../models/BillAdjustment');
      const Payment = require('../models/Payment');

      const bill = await StudentBill.findById(billId).session(session);
      if (!bill) throw new Error('Bill not found');

      // 1. Fetch all applied adjustments
      const adjustments = await BillAdjustment.find({ billId, status: 'applied' }).session(session);
      
      // Compute adjustments per item
      const itemAdjustments = {};
      bill.items.forEach(item => {
        itemAdjustments[item._id] = { discount: 0, penalty: 0 };
      });

      adjustments.forEach(adj => {
        if (!itemAdjustments[adj.itemId]) return;
        if (['discount', 'waiver', 'scholarship', 'transfer_in'].includes(adj.type)) {
          itemAdjustments[adj.itemId].discount += adj.amount;
        } else if (['penalty', 'transfer_out'].includes(adj.type)) {
          itemAdjustments[adj.itemId].penalty += adj.amount;
        }
      });

      // 2. Recalculate netAmount
      bill.items.forEach(item => {
        const adj = itemAdjustments[item._id];
        item.discount = adj.discount;
        // The netAmount is base amount + penalty - discount
        item.netAmount = Math.max(0, item.amount + adj.penalty - adj.discount);
        
      });

      // 3. Payment allocation is handled synchronously in Phase 2. 
      // We do NOT replay or recalculate item.paid, totalPaid, or remaining balances here.

      await bill.save({ session });
      return bill;
    },

    mergeParentWallets: async ({ sourceUserId, targetUserId, notes }) => {
      await waitForRebuild(sourceUserId);
      await waitForRebuild(targetUserId);

      const sourceLedger = await CreditLedger.findOne({ userId: sourceUserId, rebuildInProgress: false }).session(session);
      if (!sourceLedger || sourceLedger.balance === 0) {
        if (sourceLedger) {
            await CreditLedger.findByIdAndUpdate(sourceLedger._id, { status: 'closed' }, { session });
        }
        return { success: true, message: 'Source ledger empty. Closed successfully.' };
      }

      const transferAmount = sourceLedger.balance;

      const closedLedger = await CreditLedger.findOneAndUpdate(
        { _id: sourceLedger._id, balance: transferAmount, rebuildInProgress: false },
        { $set: { balance: 0, status: 'closed' } },
        { new: true, session }
      );
      
      if (!closedLedger) throw new Error('Failed to freeze source ledger during merge. Concurrency conflict.');

      let targetLedger;
      try {
        targetLedger = await CreditLedger.findOneAndUpdate(
          { userId: targetUserId, rebuildInProgress: false },
          { $inc: { balance: transferAmount } },
          { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );
      } catch (err) {
        if (err.code === 11000) throw new LedgerLockedError();
        throw err;
      }

      const glReference = await generateGLReference();
      const mergeSequence = Date.now();

      await CreditTransaction.create([{
        ledgerId: closedLedger._id,
        glReference,
        amount: -transferAmount,
        type: 'correction',
        balanceAfter: 0,
        notes: `[SEQ:${mergeSequence}-A] Wallet merge deduction to User ${targetUserId}. ${notes || ''}`
      }], { session });

      await CreditTransaction.create([{
        ledgerId: targetLedger._id,
        glReference,
        amount: transferAmount,
        type: 'correction',
        balanceAfter: targetLedger.balance,
        notes: `[SEQ:${mergeSequence}-B] Wallet merge addition from User ${sourceUserId}. ${notes || ''}`
      }], { session });

      return { targetLedger };
    }
  };
};

exports.IdempotencyError = IdempotencyError;
exports.LedgerLockedError = LedgerLockedError;
