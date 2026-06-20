require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const { spawn } = require('child_process');
const mongoose = require('mongoose');
const StudentBill = require('./src/models/StudentBill');
const Payment = require('./src/models/Payment');
const ChaosRunReport = require('./src/models/ChaosRunReport');

async function runRollbackTest() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  console.log('--- Phase 9: Chaos Transaction Rollback Verification ---');

  // Capture baseline
  const billBaseline = await StudentBill.findOne();
  if (!billBaseline) {
    console.error('No StudentBill found. Run reset_chaos_db.js first.');
    process.exit(1);
  }

  const baselinePaid = billBaseline.amountPaid;
  const baselinePaymentsCount = await Payment.countDocuments({ billId: billBaseline._id });

  console.log(`[ROLLBACK] Baseline: Bill Paid = ${baselinePaid}, Total Payments = ${baselinePaymentsCount}`);
  
  const startTime = Date.now();

  const child = spawn('node', ['chaos_rollback_worker.js']);

  child.stdout.on('data', async (data) => {
    const output = data.toString();
    if (output.includes('[TRANSACTION_OPEN]')) {
      console.log(`[ROLLBACK] Worker ${child.pid} opened transaction and mutated data. Striking now...`);
      child.kill('SIGKILL');

      // Wait a moment for MongoDB to roll back the aborted socket connection
      await new Promise(r => setTimeout(r, 1000));

      const billFinal = await StudentBill.findById(billBaseline._id);
      const finalPaymentsCount = await Payment.countDocuments({ billId: billBaseline._id });

      console.log(`[ROLLBACK] Final: Bill Paid = ${billFinal.amountPaid}, Total Payments = ${finalPaymentsCount}`);

      const executionTimeMs = Date.now() - startTime;
      const status = (billFinal.amountPaid === baselinePaid && finalPaymentsCount === baselinePaymentsCount) ? 'PASS' : 'FAIL';

      console.log('\n[BINARY CERTIFICATION OUTPUT]');
      console.log(`TRANSACTION ATOMICITY: ${status}`);

      const batchId = process.env.CHAOS_BATCH_ID || `BATCH_${Date.now()}`;
      await ChaosRunReport.create({
        testName: 'TRANSACTION_ROLLBACK',
        batchId,
        status,
        totalJobs: 1,
        completedJobs: status === 'PASS' ? 1 : 0,
        failedJobs: status === 'FAIL' ? 1 : 0,
        workerKills: 1,
        executionTimeMs,
        metrics: {
          baselinePaid,
          finalPaid: billFinal.amountPaid,
          baselinePaymentsCount,
          finalPaymentsCount
        },
        anomalies: status === 'FAIL' ? ['Partial transaction commit detected'] : []
      });

      if (status === 'FAIL') {
        console.error('\n❌ FAILURE: Transaction rollback failed! Partial data was committed.');
        process.exit(1);
      } else {
        console.log('\n✅ PASS: Strict ACID compliance verified. Mid-transaction kill resulted in zero data drift.');
        process.exit(0);
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`[WORKER ERR] ${data.toString()}`);
  });
}

if (require.main === module) {
  runRollbackTest().catch(console.error);
}
