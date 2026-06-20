require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const { fork } = require('child_process');
const mongoose = require('mongoose');
const { getRedisClient } = require('./src/config/redis');
const { enqueueSyncJob } = require('./src/utils/syncQueue');
const OutboxEvent = require('./src/models/OutboxEvent');
const StudentBill = require('./src/models/StudentBill');
const ChaosRunReport = require('./src/models/ChaosRunReport');

const NUM_WORKERS = 3;
const NUM_JOBS = 500;
const TEST_DURATION_MS = 60000; // Run for 60 seconds
let workers = [];
let totalKills = 0;

// Helper: Generate Poisson-distributed wait time
// lambda is average events per second. For e.g. 0.15 kills/sec (~ 6.6s avg)
function getPoissonWaitMs(lambda) {
  // Inverse transform sampling for exponential distribution (time between Poisson events)
  const u = Math.random();
  const timeSec = -Math.log(1 - u) / lambda;
  return Math.max(1000, timeSec * 1000); // Minimum 1 second wait
}

async function spawnWorker() {
  const child = fork('./chaos_worker.js');
  console.log(`[SNIPER] Spawning new chaos worker PID: ${child.pid}`);
  workers.push(child);
  
  child.on('exit', (code, signal) => {
    console.log(`[SNIPER] Worker ${child.pid} exited with code ${code} / signal ${signal}`);
    workers = workers.filter(w => w.pid !== child.pid);
  });
}

async function runSniperTest() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  console.log('--- Phase 8: Chaos Sniper Test (Worker Kill Recovery) ---');

  // Verify we have a test bill
  const bill = await StudentBill.findOne();
  if (!bill) {
    console.error('No StudentBill found. Run reset_chaos_db.js first.');
    process.exit(1);
  }

  // Clear queues
  const redis = getRedisClient();
  await redis.flushall();
  await OutboxEvent.deleteMany({});

  console.log(`[SNIPER] Enqueuing ${NUM_JOBS} dummy jobs...`);
  for (let i = 0; i < NUM_JOBS; i++) {
    await OutboxEvent.create({
      type: 'REBUILD_BILL',
      billId: bill._id,
      eventKey: `CHAOS_TEST_REBUILD:${bill._id}:${i}`,
      status: 'pending'
    });
    await enqueueSyncJob(bill._id.toString());
  }

  console.log('[SNIPER] Spawning initial workers...');
  for (let i = 0; i < NUM_WORKERS; i++) {
    await spawnWorker();
  }

  // Sniper loop: Randomly kill a worker using Poisson distribution
  let isTesting = true;
  const sniperStrike = async () => {
    if (!isTesting) return;
    
    if (workers.length > 0) {
      const targetIndex = Math.floor(Math.random() * workers.length);
      const target = workers[targetIndex];
      console.log(`[SNIPER 🎯] Terminating worker PID ${target.pid} mid-flight!`);
      
      process.kill(target.pid, 'SIGKILL');
      totalKills++;
      
      setTimeout(() => spawnWorker(), 500);
    }
    
    const waitMs = getPoissonWaitMs(0.15); // Avg ~1 strike every 6.6 seconds, but highly variable
    console.log(`[SNIPER] Next strike in ${(waitMs/1000).toFixed(2)} seconds...`);
    setTimeout(sniperStrike, waitMs);
  };
  
  sniperStrike();

  // Wait for test duration
  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS));
  isTesting = false;

  console.log('[SNIPER] Test duration complete. Shutting down active workers gracefully...');
  workers.forEach(w => w.kill('SIGTERM'));

  // Wait an additional 30 seconds for leases to expire and final sweeps to finish
  console.log('[SNIPER] Waiting 30s for abandoned leases to expire and be swept...');
  
  // Since we killed workers, we need a worker to do the sweep!
  console.log('[SNIPER] Spawning one final sweeper worker...');
  const sweeper = fork('./chaos_worker.js');
  
  await new Promise(resolve => setTimeout(resolve, 30000));
  sweeper.kill('SIGTERM');
  
  console.log('\n--- Test Results ---');
  
  const totalJobs = await OutboxEvent.countDocuments();
  const completed = await OutboxEvent.countDocuments({ status: 'completed' });
  const pending = await OutboxEvent.countDocuments({ status: 'pending' });
  const processing = await OutboxEvent.countDocuments({ status: 'processing' });
  const retryWait = await OutboxEvent.countDocuments({ status: 'retry_wait' });
  const deadLetter = await OutboxEvent.countDocuments({ status: 'dead_letter' });
  
  console.log(`Total Enqueued: ${totalJobs}`);
  console.log(`Completed:      ${completed}`);
  console.log(`Pending:        ${pending}`);
  console.log(`Processing:     ${processing} (Should be 0)`);
  console.log(`Retry Wait:     ${retryWait}`);
  console.log(`Dead Letter:    ${deadLetter}`);

  const executionTimeMs = Date.now() - startTime;
  const unresolved = pending + processing + retryWait;
  const status = processing === 0 && unresolved === 0 ? 'PASS' : 'FAIL';
  
  console.log('\n[BINARY CERTIFICATION OUTPUT]');
  console.log(`OUTBOX INTEGRITY: ${totalJobs === NUM_JOBS ? 'PASS' : 'FAIL'}`);
  console.log(`JOB LOSS RATE:    ${((totalJobs - (completed + deadLetter + unresolved)) / totalJobs * 100).toFixed(2)}%`);
  console.log(`RECOVERY SUCCESS: ${processing === 0 ? 'PASS (100%)' : 'FAIL (Jobs abandoned)'}`);
  
  // Persist report
  const batchId = process.env.CHAOS_BATCH_ID || `BATCH_${Date.now()}`;
  await ChaosRunReport.create({
    testName: 'SNIPER_TEST',
    batchId,
    status,
    totalJobs,
    completedJobs: completed,
    failedJobs: deadLetter,
    workerKills: totalKills,
    executionTimeMs,
    metrics: {
      pending,
      processing,
      retryWait: retryWait
    },
    anomalies: status === 'FAIL' ? ['Jobs stuck in processing or unresolved'] : []
  });
  
  if (status === 'FAIL') {
    console.error('\n❌ FAILURE: Jobs were permanently stuck in processing state after worker crashes.');
    process.exit(1);
  } else {
    console.log('\n✅ PASS: System gracefully recovered from brutal worker termination. No jobs lost or stuck.');
    process.exit(0);
  }
}

if (require.main === module) {
  runSniperTest().catch(console.error);
}
