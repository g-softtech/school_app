require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const mongoose = require('mongoose');
const StudentBill = require('./src/models/StudentBill');
const Payment = require('./src/models/Payment');

async function runMidTransactionCrash() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  const bill = await StudentBill.findOne();
  if (!bill) {
    console.error('No StudentBill found.');
    process.exit(1);
  }

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const doc = await StudentBill.findById(bill._id).session(session);
    doc.amountPaid += 1000;
    doc.amountDue -= 1000;
    await doc.save({ session });

    await Payment.create([{
      studentId: doc.studentId,
      billId: doc._id,
      amount: 1000,
      method: 'chaos_rollback',
      reference: 'CHAOS_ROLLBACK_TEST',
      status: 'successful'
    }], { session });

    // Signal master that transaction is open and mutated in-memory
    console.log('[TRANSACTION_OPEN]');

    // Infinite loop, wait to be killed
    await new Promise(r => setTimeout(r, 60000));

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
  } finally {
    session.endSession();
    mongoose.disconnect();
  }
}

runMidTransactionCrash().catch(console.error);
