require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const StudentBill = require('./src/models/StudentBill');
const OutboxEvent = require('./src/models/OutboxEvent');
const ledgerService = require('./src/services/ledgerService');

async function runTests() {
  await connectDB();
  console.log('Connected to MongoDB');

  // Find a target bill to race
  const bill = await StudentBill.findOne().lean();
  if (!bill) {
    console.log('No bills found');
    process.exit(0);
  }

  await OutboxEvent.deleteMany({ billId: bill._id });

  console.log(`[RACE TEST] Using Bill ${bill._id}. Starting concurrent simulate...`);

  // We will simulate the `allocatePaymentToBill` concurrent updates by bumping revision inside a mongoose transaction
  const performUpdate = async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const doc = await StudentBill.findById(bill._id).session(session);
        doc.revision = (doc.revision || 0) + 1;
        await doc.save({ session });

        const eventKey = `REBUILD_BILL:${doc._id}:${doc.revision}`;
        await OutboxEvent.create([{
          type: 'REBUILD_BILL',
          billId: doc._id,
          eventKey: eventKey,
          status: 'pending',
          nextRetryAt: new Date()
        }], { session });
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      session.endSession();
    }
  };

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(performUpdate());
  }

  const results = await Promise.all(promises);
  
  const successes = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success);

  console.log(`Executed 10 concurrent requests. Successes: ${successes}, Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.log('Failures:', failures.map(f => f.error));
  }

  const finalBill = await StudentBill.findById(bill._id);
  const outboxEvents = await OutboxEvent.find({ billId: bill._id }).sort({ createdAt: 1 });
  
  console.log(`Final Bill Revision: ${finalBill.revision}`);
  console.log(`Total Outbox Events created: ${outboxEvents.length}`);

  const keys = outboxEvents.map(e => e.eventKey);
  console.log('Event Keys created:');
  console.dir(keys);

  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size === 10 && finalBill.revision === (bill.revision || 0) + 10) {
    console.log('PASS: Exact 10 atomic outbox events generated cleanly!');
  } else if (successes === uniqueKeys.size && finalBill.revision === (bill.revision || 0) + successes) {
    console.log(`PASS: MongoDB WriteConflicts successfully aborted overlapping transactions, resulting in ${successes} perfectly atomic events. No data corruption!`);
  } else {
    console.log('FAIL: Race condition detected!');
  }

  mongoose.disconnect();
}

runTests().catch(console.error);
