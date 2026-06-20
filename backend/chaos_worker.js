require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const mongoose = require('mongoose');
const syncWorker = require('./src/workers/syncWorker');
const ledgerService = require('./src/services/ledgerService');

// Mock ledgerService to simulate slow processing
ledgerService.rebuildBillBalances = async (billId) => {
  // Simulate 300ms processing time
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Randomly fail 5% of the time to simulate transient errors
  if (Math.random() < 0.05) {
    throw new Error('Chaos simulated transient ledger failure');
  }
  return true;
};

const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';

mongoose.connect(uri).then(() => {
  console.log(`[CHAOS WORKER PID ${process.pid}] Started and connected to DB.`);
  syncWorker.start();
}).catch(err => {
  console.error('Worker failed to connect to DB', err);
  process.exit(1);
});

// Handle graceful shutdown if requested (though Sniper will SIGKILL)
process.on('SIGTERM', async () => {
  console.log(`[CHAOS WORKER PID ${process.pid}] SIGTERM received, shutting down gracefully.`);
  await syncWorker.stop();
  await mongoose.disconnect();
  process.exit(0);
});
