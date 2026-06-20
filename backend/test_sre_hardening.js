require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const mongoose = require('mongoose');
const { evaluateSRE } = require('./src/workers/sreEvaluatorWorker');
const OutboxEvent = require('./src/models/OutboxEvent');
const SreStatus = require('./src/models/SreStatus');
const SreTransitionEvent = require('./src/models/SreTransitionEvent');
const sreGuard = require('./src/utils/sreGuard');
const { getRedisClient } = require('./src/config/redis');

async function runHardeningTest() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  console.log('--- Phase 10 Extension: Hardening Verification ---');

  const redis = getRedisClient();
  await redis.flushall();
  await OutboxEvent.deleteMany({});
  await SreStatus.deleteMany({});
  await SreTransitionEvent.deleteMany({});

  console.log('[TEST] 1. Debounce Window Verification');
  
  // Create state to evaluate NORMAL
  await SreStatus.create({ sreState: 'NORMAL' });
  
  // Seed massive failure
  const failedJobs = [];
  for (let i = 0; i < 500; i++) {
    failedJobs.push({
      type: 'REBUILD_BILL',
      billId: new mongoose.Types.ObjectId(),
      eventKey: `CHAOS_HARDENING_TEST:${i}`,
      status: 'dead_letter'
    });
  }
  await OutboxEvent.insertMany(failedJobs);

  console.log('   Running Evaluator 1...');
  await evaluateSRE();
  
  let state = await SreStatus.findOne();
  if (state.sreState !== 'PENDING_FREEZE') {
    console.error(`❌ FAILURE: System bypassed debounce. State is ${state.sreState} instead of PENDING_FREEZE.`);
    process.exit(1);
  }
  console.log('   ✅ System correctly entered PENDING_FREEZE debounce state.');

  console.log('   Simulating 121 seconds passing...');
  await SreStatus.updateOne({}, { $set: { pendingFreezeStartedAt: new Date(Date.now() - 121000) } });
  
  console.log('   Running Evaluator 2...');
  await evaluateSRE();
  
  state = await SreStatus.findOne();
  if (state.sreState !== 'FROZEN') {
    console.error(`❌ FAILURE: System failed to escalate to FROZEN after debounce elapsed. State: ${state.sreState}`);
    process.exit(1);
  }
  console.log('   ✅ System confirmed FROZEN state after debounce delay.');

  console.log('\n[TEST] 2. Transition Audit Graph Verification');
  const transitions = await SreTransitionEvent.find().sort({ timestamp: 1 });
  if (transitions.length < 2) {
    console.error(`❌ FAILURE: Expected at least 2 transitions, found ${transitions.length}`);
    process.exit(1);
  }
  console.log(`   ✅ Found ${transitions.length} transition events.`);
  console.log(`   ✅ Latest Event Error Acceleration: ${transitions[transitions.length - 1].errorAcceleration}`);

  console.log('\n[TEST] 3. Fast-Path Cache Bypass Verification');
  
  // Reset guard cache by forcing a check
  const guardCheck1 = await sreGuard.checkSreAccess('replayDlq');
  if (guardCheck1.decision !== sreGuard.RESPONSES.LOCKED_423) {
    console.error('❌ FAILURE: Guard did not lock.');
    process.exit(1);
  }

  // Simulate an admin immediately breaking glass (writes to DB)
  await SreStatus.updateOne({}, {
    $set: {
      sreState: 'EMERGENCY_BYPASS',
      breakGlassActive: true,
      breakGlassExpiresAt: new Date(Date.now() + 600000),
      breakGlassScope: ['replayDlq']
    }
  });

  // Guard is called within 2000ms TTL. It MUST bypass cache because cached state is FROZEN
  const guardCheck2 = await sreGuard.checkSreAccess('replayDlq');
  if (guardCheck2.decision !== sreGuard.RESPONSES.ALLOW_EMERGENCY) {
    console.error(`❌ FAILURE: Cache bypass failed! Guard returned ${guardCheck2.decision} instead of ALLOW_EMERGENCY.`);
    process.exit(1);
  }
  console.log('   ✅ Fast-path cache bypass successfully picked up emergency override.');

  console.log('\n[TEST] 4. Scoped Governance Verification');
  // Our scope is ['replayDlq']
  const scopedCheck = await sreGuard.checkSreAccess('retryJob');
  if (scopedCheck.decision === sreGuard.RESPONSES.ALLOW_EMERGENCY) {
    console.error(`❌ FAILURE: Guard allowed an out-of-scope action under break-glass!`);
    process.exit(1);
  }
  console.log('   ✅ Guard correctly enforced scope boundaries (retryJob rejected, replayDlq allowed).');


  console.log('\n✅ ALL HARDENING TESTS PASSED.');
  process.exit(0);
}

if (require.main === module) {
  runHardeningTest().catch(console.error);
}
