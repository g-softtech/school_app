require('dotenv').config();
const mongoose = require('mongoose');

// Import all models so they register and build indexes
require('./src/models/OutboxEvent');
require('./src/models/StudentBill');
require('./src/models/Payment');
require('./src/models/SystemAlert');
require('./src/models/Auditlog');
require('./src/models/WorkerNode');
require('./src/models/OperationalMetricsDaily');
require('./src/models/AdminActionLock');

const StudentBill = mongoose.model('StudentBill');

async function resetChaosDb() {
  if (process.env.NODE_ENV !== 'chaos') {
    throw new Error('Chaos tests must never run outside sandbox DB. Set NODE_ENV=chaos');
  }

  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  console.log(`[CHAOS] Connecting to ${uri}`);
  await mongoose.connect(uri);

  console.log('[CHAOS] Dropping database...');
  await mongoose.connection.db.dropDatabase();

  console.log('[CHAOS] Rebuilding indexes...');
  // Ensure all models create their indexes
  const models = mongoose.modelNames();
  for (const modelName of models) {
    await mongoose.model(modelName).ensureIndexes();
  }

  console.log('[CHAOS] Seeding baseline data...');
  const testBill = await StudentBill.create({
    studentId: 'STU-CHAOS-1',
    term: 'Fall 2026',
    amountTotal: 10000,
    amountPaid: 0,
    amountDue: 10000,
    status: 'unpaid'
  });

  console.log(`[CHAOS] Seeded StudentBill: ${testBill._id}`);
  console.log('[CHAOS] Database reset complete.\n');
  await mongoose.disconnect();
}

if (require.main === module) {
  resetChaosDb().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { resetChaosDb };
