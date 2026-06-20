const mongoose = require('mongoose');
const OutboxEvent = require('./src/models/OutboxEvent');
const SystemAlert = require('./src/models/SystemAlert');
const Notification = require('./src/models/Notification');
const Auditlog = require('./src/models/Auditlog');
const { runHealthChecks } = require('./src/workers/alertWorker');
require('dotenv').config();

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  // Clean up previous test state
  await mongoose.connection.collection('systemalerts').drop().catch(e => console.log('systemalerts drop error:', e.message));
  await OutboxEvent.deleteMany({ eventKey: 'TEST_ALERT_DLQ' });
  await SystemAlert.deleteMany({ alertKey: 'outbox_dlq' });
  await Notification.deleteMany({ type: 'system_alert' });
  await Auditlog.deleteMany({ action: { $in: ['SYSTEM_ALERT_ESCALATION', 'SYSTEM_ALERT_RESOLVED'] } });

  console.log('\n--- Step 1: Force dead_letter = 1 ---');
  await OutboxEvent.create({
    eventKey: 'TEST_ALERT_DLQ',
    billId: new mongoose.Types.ObjectId(),
    type: 'recalculate_bill',
    status: 'dead_letter',
    errorReason: 'Simulated failure for alerting'
  });

  console.log('Running health checks...');
  await runHealthChecks();

  let activeAlert = await SystemAlert.findOne({ alertKey: 'outbox_dlq', status: 'active' });
  console.log('Alert status:', activeAlert ? activeAlert.status : 'NOT FOUND');
  console.log('Severity:', activeAlert?.severity);

  let notifications = await Notification.find({ type: 'system_alert' });
  console.log('Notifications created:', notifications.length);
  if (notifications.length === 0) {
    console.error('❌ Failed to create notifications');
  } else {
    console.log('✅ Notifications successfully dispatched');
  }

  console.log('\n--- Step 2: Clear issue dead_letter = 0 ---');
  await OutboxEvent.updateOne({ eventKey: 'TEST_ALERT_DLQ' }, { status: 'completed' });
  
  console.log('Running health checks...');
  await runHealthChecks();

  let resolvedAlert = await SystemAlert.findOne({ alertKey: 'outbox_dlq', status: 'resolved' });
  console.log('Alert resolvedAt:', resolvedAlert?.resolvedAt);
  if (resolvedAlert?.resolvedAt) {
    console.log('✅ Alert successfully resolved and timestamp recorded.');
  } else {
    console.error('❌ Failed to resolve alert');
  }

  let resolveAudit = await Auditlog.findOne({ action: 'SYSTEM_ALERT_RESOLVED' });
  if (resolveAudit) {
    console.log('✅ Audit log created for resolution.');
  } else {
    console.error('❌ Failed to create audit log for resolution');
  }

  console.log('\n--- Step 3: Recreate dead_letter = 1 ---');
  await OutboxEvent.updateOne({ eventKey: 'TEST_ALERT_DLQ' }, { status: 'dead_letter' });
  
  console.log('Running health checks...');
  await runHealthChecks();

  let newActiveAlert = await SystemAlert.findOne({ alertKey: 'outbox_dlq', status: 'active' });
  console.log('New Active Alert trigger count:', newActiveAlert?.triggerCount);
  if (newActiveAlert && newActiveAlert._id.toString() !== resolvedAlert._id.toString()) {
    console.log('✅ New alert cycle started properly (deduplication bypassed).');
  } else {
    console.error('❌ Failed to start new alert cycle.');
  }

  console.log('\n--- Cleanup ---');
  await OutboxEvent.deleteMany({ eventKey: 'TEST_ALERT_DLQ' });
  await SystemAlert.deleteMany({ alertKey: 'outbox_dlq' });
  await mongoose.disconnect();
  console.log('Test Complete.');
}

runTest().catch(console.error);
