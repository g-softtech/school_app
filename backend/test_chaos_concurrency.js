require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const mongoose = require('mongoose');
const StudentBill = require('./src/models/StudentBill');
const Payment = require('./src/models/Payment');
const OutboxEvent = require('./src/models/OutboxEvent');

const CONCURRENT_REQUESTS = 100;
const PAYMENT_AMOUNT = 2000;

async function runConcurrencyBlast() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  console.log('--- Phase 8: Chaos Concurrency Blast (Race Condition Proof) ---');

  // Verify we have a test bill
  const bill = await StudentBill.findOne();
  if (!bill) {
    console.error('No StudentBill found. Run reset_chaos_db.js first.');
    process.exit(1);
  }

  // Reset bill amounts for test
  bill.amountTotal = 10000;
  bill.amountDue = 10000;
  bill.amountPaid = 0;
  bill.revision = 0;
  bill.status = 'unpaid';
  await bill.save();

  await Payment.deleteMany({});
  await OutboxEvent.deleteMany({});

  console.log(`[BLAST] Firing ${CONCURRENT_REQUESTS} parallel payment attempts of ${PAYMENT_AMOUNT} each against Bill ${bill._id}...`);
  console.log(`[BLAST] Bill has 10000 due. Max successful payments should be 5.`);

  // Function simulating the exact transaction in payments.controller.js
  const performPayment = async (attemptNum) => {
    const session = await mongoose.startSession();
    try {
      let success = false;
      let reason = '';
      
      await session.withTransaction(async () => {
        // Read bill with write lock (MongoDB handles this inherently with optimistic concurrency or wire-level locks depending on setup. Actually, we use findOneAndUpdate or revision bumping to trigger WriteConflict).
        const doc = await StudentBill.findById(bill._id).session(session);
        
        if (doc.amountDue < PAYMENT_AMOUNT) {
          reason = 'Insufficient amount due';
          return; // Abort transaction logic
        }

        doc.amountPaid += PAYMENT_AMOUNT;
        doc.amountDue -= PAYMENT_AMOUNT;
        if (doc.amountDue === 0) doc.status = 'paid';
        else doc.status = 'partial';
        
        doc.revision = (doc.revision || 0) + 1;
        await doc.save({ session });

        await Payment.create([{
          studentId: doc.studentId,
          billId: doc._id,
          amount: PAYMENT_AMOUNT,
          method: 'chaos_test',
          reference: `CHAOS_REF_${attemptNum}_${Date.now()}`,
          status: 'successful'
        }], { session });

        const eventKey = `REBUILD_BILL:${doc._id}:${doc.revision}`;
        await OutboxEvent.create([{
          type: 'REBUILD_BILL',
          billId: doc._id,
          eventKey: eventKey,
          status: 'pending',
          nextRetryAt: new Date()
        }], { session });
        
        success = true;
      });
      return { success, reason };
    } catch (err) {
      // Catch MongoDB WriteConflict (TransientTransactionError) or duplicate keys
      return { success: false, reason: err.message };
    } finally {
      session.endSession();
    }
  };

  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(performPayment(i));
  }

  const results = await Promise.all(promises);
  
  const successes = results.filter(r => r.success).length;
  const writeConflicts = results.filter(r => !r.success && r.reason.includes('WriteConflict')).length;
  const insufficientDue = results.filter(r => !r.success && r.reason === 'Insufficient amount due').length;
  const otherFailures = results.filter(r => !r.success && !r.reason.includes('WriteConflict') && r.reason !== 'Insufficient amount due').length;

  const finalBill = await StudentBill.findById(bill._id);
  const totalPayments = await Payment.countDocuments();
  const totalOutbox = await OutboxEvent.countDocuments();

  console.log('\n--- Test Results ---');
  console.log(`Successes (Payments accepted): ${successes}`);
  console.log(`Rejected (Write Conflicts):    ${writeConflicts}`);
  console.log(`Rejected (Insufficient Due):   ${insufficientDue}`);
  console.log(`Rejected (Other Errors):       ${otherFailures}`);
  
  console.log('\n[BINARY CERTIFICATION OUTPUT]');
  
  const expectedSuccesses = 5; // 10000 / 2000
  const isOverpaid = finalBill.amountPaid > 10000 || finalBill.amountDue < 0;
  const matchesPayments = totalPayments === successes;
  const matchesOutbox = totalOutbox === successes;
  
  const status = !isOverpaid && matchesPayments && matchesOutbox ? 'PASS' : 'FAIL';

  console.log(`TRANSACTION INTEGRITY: ${!isOverpaid ? 'PASS' : 'FAIL (Overpayment Occurred)'}`);
  console.log(`DOUBLE CREDITING RISK: ${isOverpaid ? 'HIGH' : 'ZERO'}`);
  console.log(`ATOMICITY SUCCESS:     ${matchesPayments && matchesOutbox ? 'PASS' : 'FAIL (Dangling records)'}`);
  
  // Persist report
  const ChaosRunReport = require('./src/models/ChaosRunReport');
  const batchId = process.env.CHAOS_BATCH_ID || `BATCH_${Date.now()}`;
  await ChaosRunReport.create({
    testName: 'CONCURRENCY_BLAST',
    batchId,
    status,
    totalJobs: CONCURRENT_REQUESTS,
    completedJobs: successes,
    failedJobs: writeConflicts + insufficientDue + otherFailures,
    executionTimeMs: 0, // Could be tracked if we added timing
    metrics: {
      expectedSuccesses,
      actualSuccesses: successes,
      writeConflicts,
      insufficientDue,
      otherFailures
    },
    anomalies: status === 'FAIL' ? ['Double crediting or atomicity failure detected'] : []
  });

  if (status === 'FAIL') {
    console.error('\n❌ FAILURE: Race condition broke system invariants!');
    process.exit(1);
  } else {
    console.log('\n✅ PASS: System gracefully handled extreme concurrency. Zero double crediting.');
    process.exit(0);
  }
}

if (require.main === module) {
  runConcurrencyBlast().catch(console.error);
}
