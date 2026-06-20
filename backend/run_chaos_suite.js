require('dotenv').config();

if (process.env.NODE_ENV !== 'chaos') {
  console.error('Chaos tests must never run outside sandbox DB');
  process.exit(1);
}

const { spawn } = require('child_process');
const { buildCertification } = require('./src/utils/certificationBuilder');

function runTest(scriptName, batchId) {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================`);
    console.log(`🚀 RUNNING: ${scriptName}`);
    console.log(`========================================\n`);

    const child = spawn('node', [scriptName], {
      env: { ...process.env, CHAOS_BATCH_ID: batchId },
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} failed with code ${code}`));
    });
  });
}

async function runSuite() {
  const batchId = `BATCH_${Date.now()}`;
  console.log(`Starting Chaos Engineering Suite [Batch ID: ${batchId}]`);

  try {
    // 1. Rollback Verification
    await runTest('test_chaos_transaction_rollback.js', batchId);
    
    // 2. Concurrency Blast
    await runTest('test_chaos_concurrency.js', batchId);
    
    // 3. Sniper Test
    await runTest('test_chaos_sniper.js', batchId);

    console.log(`\n========================================`);
    console.log(`🛡️ CHAOS SUITE COMPLETED SUCCESSFULLY`);
    console.log(`========================================\n`);

    console.log('Generating Certification Artifact...');
    await buildCertification(batchId);

    console.log('\n✅ System is certified ready.');
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ SUITE ABORTED: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runSuite().catch(console.error);
}
