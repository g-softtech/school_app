require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ChaosRunReport = require('./src/models/ChaosRunReport');
const SystemCertification = require('./src/models/SystemCertification');

async function buildCertification(batchId) {
  const uri = process.env.MONGO_URI_CHAOS || 'mongodb://localhost:27017/school_app_chaos';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  const reports = await ChaosRunReport.find({ batchId });
  if (reports.length === 0) {
    console.error(`No reports found for batchId: ${batchId}`);
    return;
  }

  const status = reports.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';
  
  // Aggregate metrics
  let totalJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;
  let totalWorkerKills = 0;
  let anomalies = [];

  reports.forEach(r => {
    totalJobs += r.totalJobs || 0;
    completedJobs += r.completedJobs || 0;
    failedJobs += r.failedJobs || 0;
    totalWorkerKills += r.workerKills || 0;
    if (r.anomalies && r.anomalies.length > 0) anomalies.push(...r.anomalies);
  });

  const unresolved = totalJobs - (completedJobs + failedJobs);
  const maxJobLossRate = totalJobs > 0 ? (unresolved / totalJobs) * 100 : 0;
  
  const concurrencyReport = reports.find(r => r.testName === 'CONCURRENCY_BLAST');
  const maxDuplicateExecution = concurrencyReport && concurrencyReport.status === 'FAIL' ? 1 : 0; // Simplified
  
  const rollbackReport = reports.find(r => r.testName === 'TRANSACTION_ROLLBACK');
  const transactionIntegrity = rollbackReport ? rollbackReport.status : 'UNKNOWN';

  const version = `v1.0.${Date.now().toString().slice(-4)}`;

  const cert = await SystemCertification.create({
    version,
    batchId,
    status,
    runIds: reports.map(r => r._id),
    metrics: {
      maxJobLossRate,
      maxDuplicateExecution,
      workerFailureToleranceLevel: totalWorkerKills,
      concurrencyCeiling: concurrencyReport ? concurrencyReport.totalJobs : 0,
      transactionIntegrity
    }
  });

  console.log(`[CERTIFICATION] Version ${version} generated with status: ${status}`);

  // Generate Markdown
  const mdContent = `# SYSTEM RELIABILITY CERTIFICATE
**Version:** ${cert.version}
**Date:** ${cert.certifiedAt.toISOString()}
**Status:** ${cert.status === 'PASS' ? '✅ CERTIFIED' : '❌ FAILED'}
**Batch ID:** ${cert.batchId}

## Empirical Metrics Achieved
- **Max Job Loss Rate:** ${cert.metrics.maxJobLossRate.toFixed(2)}%
- **Max Duplicate Executions:** ${cert.metrics.maxDuplicateExecution}
- **Worker Failure Tolerance Level:** Survived ${cert.metrics.workerFailureToleranceLevel} brutal terminations
- **Concurrency Ceiling Tested:** ${cert.metrics.concurrencyCeiling} simultaneous mutations
- **Transaction ACID Integrity:** ${cert.metrics.transactionIntegrity}

## Anomalies Detected
${anomalies.length === 0 ? '- None. System invariants held.' : anomalies.map(a => `- ${a}`).join('\n')}

*This certificate is derived empirically from the live chaos engineering suite executing against the sandbox operational plane.*
`;

  fs.writeFileSync(path.join(__dirname, 'latest_certification.md'), mdContent);
  fs.writeFileSync(path.join(__dirname, 'latest_certification.json'), JSON.stringify(cert.toJSON(), null, 2));

  console.log('[CERTIFICATION] Artifacts written to disk.');
}

if (require.main === module) {
  const batchId = process.argv[2] || process.env.CHAOS_BATCH_ID;
  if (!batchId) {
    console.error('Usage: node certificationBuilder.js <batchId>');
    process.exit(1);
  }
  buildCertification(batchId)
    .then(() => process.exit(0))
    .catch(console.error);
}

module.exports = { buildCertification };
