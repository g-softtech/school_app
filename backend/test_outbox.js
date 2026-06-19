require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const StudentBill = require('./src/models/StudentBill');
const OutboxEvent = require('./src/models/OutboxEvent');
const ledgerService = require('./src/services/ledgerService');
const syncWorker = require('./src/workers/syncWorker');

async function runTests() {
  await connectDB();
  console.log('Connected to MongoDB');

  // Clear outbox for testing
  await OutboxEvent.deleteMany({});
  
  // 1. Get an existing bill
  const bill = await StudentBill.findOne().lean();
  if (!bill) {
    console.log('No bills found to test');
    process.exit(0);
  }

  console.log(`[TEST] Using Bill ${bill._id} - Revision ${bill.revision}`);

  // Test: Insert duplicate eventKeys
  console.log('--- TEST 1: Duplicate Event Key Rejection ---');
  try {
    await OutboxEvent.create([
      { type: 'REBUILD_BILL', billId: bill._id, eventKey: `REBUILD_BILL:${bill._id}:${bill.revision}` },
      { type: 'REBUILD_BILL', billId: bill._id, eventKey: `REBUILD_BILL:${bill._id}:${bill.revision}` } // Should fail
    ], { ordered: false });
    console.log('FAIL: Allowed duplicate eventKey');
  } catch (err) {
    if (err.code === 11000) {
      console.log('PASS: Successfully rejected duplicate eventKey');
    } else {
      console.log('FAIL: Unexpected error', err);
    }
  }

  // Test: Sync Worker Atomic Claim
  console.log('\n--- TEST 2: Worker Processing ---');
  syncWorker.start();
  
  // Wait for worker to pick it up
  await new Promise(r => setTimeout(r, 2000));
  
  const processedEvent = await OutboxEvent.findOne({ billId: bill._id });
  console.log(`Event status: ${processedEvent.status} (expected: completed)`);

  const updatedBill = await StudentBill.findById(bill._id);
  console.log(`Bill lastProcessedOutboxEventId: ${updatedBill.lastProcessedOutboxEventId}`);
  if (String(updatedBill.lastProcessedOutboxEventId) === String(processedEvent._id)) {
    console.log('PASS: Idempotency marker saved to bill');
  } else {
    console.log('FAIL: Idempotency marker not saved');
  }

  syncWorker.stop();
  mongoose.disconnect();
}

runTests().catch(console.error);
