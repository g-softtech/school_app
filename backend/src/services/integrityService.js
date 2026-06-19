const mongoose = require('mongoose');
const CreditLedger = require('../models/CreditLedger');
const CreditTransaction = require('../models/CreditTransaction');
const ScanJob = require('../models/ScanJob');

/**
 * Verify mathematical integrity of a specific ledger by summing all events.
 */
exports.verifyLedgerIntegrity = async (userId) => {
  const ledger = await CreditLedger.findOne({ userId });
  if (!ledger) throw new Error('Ledger not found for user');

  const transactions = await CreditTransaction.find({ ledgerId: ledger._id });
  const calculatedBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
  const driftAmount = Math.abs(calculatedBalance - ledger.balance);
  const isClean = driftAmount === 0;

  return {
    isClean,
    userId,
    ledgerId: ledger._id,
    currentBalance: ledger.balance,
    calculatedBalance,
    driftAmount
  };
};

/**
 * Reconstruct a corrupted ledger strictly from its immutable event stream.
 * Employs a hard distributed lock `rebuildInProgress` to freeze writes during the rebuild.
 */
exports.rebuildLedgerFromEvents = async (userId) => {
  let result;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Acquire hard lock
    const ledger = await CreditLedger.findOneAndUpdate(
      { userId, rebuildInProgress: false },
      { $set: { rebuildInProgress: true } },
      { new: true, session }
    );

    if (!ledger) {
      throw new Error('Ledger not found or already locked by another rebuild process.');
    }

    // Replay chronological event stream
    const transactions = await CreditTransaction.find({ ledgerId: ledger._id })
      .sort({ createdAt: 1 })
      .session(session);

    let calculatedBalance = 0;
    for (const tx of transactions) {
      calculatedBalance += tx.amount;
    }

    // Committing the true materialized state and releasing the lock
    ledger.balance = calculatedBalance;
    ledger.rebuildInProgress = false;
    await ledger.save({ session });

    await session.commitTransaction();
    
    result = {
      success: true,
      userId,
      newBalance: calculatedBalance,
      transactionsReplayed: transactions.length
    };
  } catch (error) {
    await session.abortTransaction();
    // Emergency release lock if something exploded
    try {
      await CreditLedger.updateOne({ userId }, { $set: { rebuildInProgress: false } });
    } catch(e) {}
    throw error;
  } finally {
    session.endSession();
  }
  
  return result;
};

/**
 * Batch processor to scan large datasets safely without memory explosion.
 * Uses cursor pagination to iterate over system ledgers.
 */
exports.verifySystemWideIntegrity = async (batchSize = 100, cursorId = null, scanTimestamp = new Date()) => {
  const query = {};
  if (cursorId) {
    query._id = { $gt: cursorId };
  }

  const ledgers = await CreditLedger.find(query)
    .sort({ _id: 1 })
    .limit(batchSize);

  const anomalies = [];
  let processedCount = 0;
  let lastCursor = cursorId;

  for (const ledger of ledgers) {
    const transactions = await CreditTransaction.find({ 
      ledgerId: ledger._id,
      createdAt: { $lte: scanTimestamp }
    });
    const calculatedBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const driftAmount = Math.abs(calculatedBalance - ledger.balance);
    
    if (driftAmount !== 0) {
      let driftLevel = 'minor'; // Rounding/Cache issues (<= 100)
      if (driftAmount > 100 && driftAmount <= 10000) driftLevel = 'moderate'; // Missing event
      if (driftAmount > 10000) driftLevel = 'critical'; // Tampering/Data loss

      anomalies.push({
        userId: ledger.userId,
        ledgerId: ledger._id,
        currentBalance: ledger.balance,
        calculatedBalance,
        driftAmount,
        driftLevel
      });
    }
    
    processedCount++;
    lastCursor = ledger._id;
  }

  return {
    processedCount,
    hasMore: processedCount === batchSize,
    nextCursor: processedCount === batchSize ? lastCursor : null,
    anomaliesFound: anomalies.length,
    anomalies
  };
};

/**
 * Executes the background worker for an async integrity scan.
 */
exports.runAsyncIntegrityScan = async (jobId, scanTimestamp) => {
  try {
    const job = await ScanJob.findById(jobId);
    if (!job) return;
    
    const totalExpected = await CreditLedger.countDocuments();
    job.status = 'processing';
    job.progress.totalExpected = totalExpected;
    await job.save();

    let hasMore = true;
    let cursorId = null;

    while (hasMore) {
      const batchResult = await exports.verifySystemWideIntegrity(100, cursorId, scanTimestamp);
      
      job.progress.processedCount += batchResult.processedCount;
      if (batchResult.anomalies.length > 0) {
        job.anomalies.push(...batchResult.anomalies);
        job.anomaliesFound += batchResult.anomalies.length;
      }
      
      await job.save();

      hasMore = batchResult.hasMore;
      cursorId = batchResult.nextCursor;
      
      // Yield to event loop to avoid blocking main thread completely
      await new Promise(r => setImmediate(r));
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
  } catch (error) {
    console.error('[runAsyncIntegrityScan error]', error);
    await ScanJob.findByIdAndUpdate(jobId, { status: 'failed', errorReason: error.message, completedAt: new Date() });
  }
};
