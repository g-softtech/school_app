require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const mongoose = require('mongoose');
const { evaluateSRE } = require('./src/workers/sreEvaluatorWorker');
const OutboxEvent = require('./src/models/OutboxEvent');
const SreStatus = require('./src/models/SreStatus');
const sreGuard = require('./src/utils/sreGuard');
const { getRedisClient } = require('./src/config/redis');

async function runBreakGlassTest() {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  await mongoose.connect(uri);

  console.log('--- Phase 10: SRE Guard & Break-Glass Verification ---');

  // Clear queues
  const redis = getRedisClient();
  await redis.flushall();
  await OutboxEvent.deleteMany({});
  await SreStatus.deleteMany({});

  console.log('[SRE TEST] Seeding 500 failed jobs to trigger fast-burn error budget exhaustion...');
  const failedJobs = [];
  for (let i = 0; i < 500; i++) {
    failedJobs.push({
      type: 'REBUILD_BILL',
      billId: new mongoose.Types.ObjectId(),
      eventKey: `CHAOS_SRE_TEST:${i}`,
      status: 'dead_letter'
    });
  }
  await OutboxEvent.insertMany(failedJobs);

  console.log('[SRE TEST] Running SRE Evaluator Worker cycle...');
  await evaluateSRE();

  const status = await SreStatus.findOne();
  console.log(`[SRE TEST] Post-Evaluation SRE State: ${status.sreState}`);

  if (status.sreState !== 'FROZEN') {
    console.error('❌ FAILURE: SRE Evaluator failed to freeze the system on massive error spike!');
    process.exit(1);
  }

  console.log('[SRE TEST] Asserting /replay-dlq route is structurally locked (423)...');
  const sreCheck = await sreGuard.checkSreAccess('replayDlq');
  
  if (sreCheck.decision !== sreGuard.RESPONSES.LOCKED_423) {
    console.error(`❌ FAILURE: Guard returned ${sreCheck.decision} instead of LOCKED_423`);
    process.exit(1);
  }

  console.log('✅ GUARD VERIFIED: Operations locked successfully.');

  console.log('[SRE TEST] Simulating Admin Break-Glass invocation...');
  const policy = require('./src/config/sre_policy.json');
  const expiresAt = new Date(Date.now() + policy.breakGlass.maxDurationMs);
  
  await SreStatus.updateOne({}, {
    $set: {
      sreState: 'EMERGENCY_BYPASS',
      breakGlassActive: true,
      breakGlassExpiresAt: expiresAt,
      breakGlassReason: 'System outage test',
      breakGlassAdminId: new mongoose.Types.ObjectId()
    }
  });

  const overrideCheck = await sreGuard.checkSreAccess('replayDlq');
  
  if (overrideCheck.decision !== sreGuard.RESPONSES.ALLOW_EMERGENCY) {
    console.error(`❌ FAILURE: Guard returned ${overrideCheck.decision} instead of ALLOW_EMERGENCY after Break-Glass`);
    process.exit(1);
  }

  console.log('✅ BREAK-GLASS VERIFIED: Operations unlocked successfully under emergency bypass.');

  console.log('[SRE TEST] Simulating Break-Glass expiration...');
  await SreStatus.updateOne({}, {
    $set: { breakGlassExpiresAt: new Date(Date.now() - 1000) }
  });

  const expiredCheck = await sreGuard.checkSreAccess('replayDlq');
  
  if (expiredCheck.decision === sreGuard.RESPONSES.ALLOW_EMERGENCY) {
    console.error('❌ FAILURE: Guard allowed access even though Break-Glass expired!');
    process.exit(1);
  }

  console.log('✅ EXPIRATION VERIFIED: System correctly returned to locked state after Break-Glass TTL.');
  
  console.log('\n✅ PASS: Phase 10 SRE Contract layer fully enforced.');
  process.exit(0);
}

if (require.main === module) {
  runBreakGlassTest().catch(console.error);
}
