require('dotenv').config();
const mongoose = require('mongoose');

require('./src/models/OutboxEvent');
require('./src/models/StudentBill');
require('./src/models/Payment');
require('./src/models/SystemAlert');
require('./src/models/Auditlog');
require('./src/models/WorkerNode');
require('./src/models/OperationalMetricsDaily');
require('./src/models/AdminActionLock');

async function verifyIndexes() {
  const uri = process.env.NODE_ENV === 'chaos' 
    ? (process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos')
    : (process.env.MONGO_URI || 'mongodb://localhost:27017/school_app');
  
  console.log(`Connecting to ${uri}`);
  await mongoose.connect(uri);

  console.log('\n--- Synchronizing Indexes ---');
  
  const models = mongoose.modelNames();
  for (const modelName of models) {
    const Model = mongoose.model(modelName);
    console.log(`Synchronizing indexes for ${modelName}...`);
    // syncIndexes drops indexes that are not defined in the schema and creates missing ones
    const result = await Model.syncIndexes();
    console.log(`  [OK] ${modelName} - Added: ${result.added || 0}, Dropped: ${result.dropped || 0}`);
  }

  console.log('\n--- Verifying Core Production Indexes ---');
  const outboxIndexes = await mongoose.model('OutboxEvent').collection.indexes();
  
  const hasStatusRetry = outboxIndexes.some(i => i.key.status === 1 && i.key.nextRetryAt === 1);
  const hasStatusLease = outboxIndexes.some(i => i.key.status === 1 && i.key.leaseExpiresAt === 1);
  const hasEventKey = outboxIndexes.some(i => i.key.eventKey === 1 && i.unique);

  console.log(`OutboxEvent { status: 1, nextRetryAt: 1 } : ${hasStatusRetry ? '✅' : '❌'}`);
  console.log(`OutboxEvent { status: 1, leaseExpiresAt: 1 } : ${hasStatusLease ? '✅' : '❌'}`);
  console.log(`OutboxEvent { eventKey: 1 } (Unique) : ${hasEventKey ? '✅' : '❌'}`);

  const workerNodeIndexes = await mongoose.model('WorkerNode').collection.indexes();
  const hasWorkerTtl = workerNodeIndexes.some(i => i.key.lastSeenAt === 1 && i.expireAfterSeconds !== undefined);
  console.log(`WorkerNode { lastSeenAt: 1 } (TTL) : ${hasWorkerTtl ? '✅' : '❌'}`);

  const adminLockIndexes = await mongoose.model('AdminActionLock').collection.indexes();
  const hasLockTtl = adminLockIndexes.some(i => i.key.expiresAt === 1 && i.expireAfterSeconds !== undefined);
  console.log(`AdminActionLock { expiresAt: 1 } (TTL) : ${hasLockTtl ? '✅' : '❌'}`);

  console.log('\nIndex Hardening Complete.');
  await mongoose.disconnect();
}

if (require.main === module) {
  verifyIndexes().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { verifyIndexes };
