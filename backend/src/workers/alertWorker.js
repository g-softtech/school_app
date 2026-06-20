const mongoose = require('mongoose');
const crypto = require('crypto');
const OutboxEvent = require('../models/OutboxEvent');
const SystemAlert = require('../models/SystemAlert');
const WorkerNode = require('../models/WorkerNode');
const { dispatchAlert } = require('../services/alertDispatcher');

const DEDUPLICATION_MINUTES = 30;

const STABILIZATION_MINUTES = 2;

function createFingerprint(alertKey) {
  return crypto.createHash('sha256').update(alertKey).digest('hex');
}

async function triggerAlert(alertKey, severity, value, message) {
  const fingerprint = createFingerprint(alertKey);
  const now = new Date();

  // Find existing active alert
  let alert = await SystemAlert.findOne({ alertKey, status: 'active' });

  if (alert) {
    // If it exists, check escalation
    if (severity === 'critical' && alert.severity === 'critical') {
      const minutesActive = (now - alert.firstTriggeredAt) / 60000;
      if (minutesActive > 60) {
        severity = 'escalated_critical';
        alert.severity = 'escalated_critical';
        message = `[ESCALATED] ${message}`;
        alert.message = message;
      }
    }

    // Update values
    alert.currentValue = value;
    if (value > (alert.peakValue || 0)) {
      alert.peakValue = value;
    }
    alert.pendingResolutionSince = null; // Clear any pending resolution
    alert.triggerCount += 1;
    
    // Check deduplication window
    if (!alert.lastSentAt || (now - alert.lastSentAt) >= DEDUPLICATION_MINUTES * 60000) {
      // Atomic update for email storm protection
      const updatedAlert = await SystemAlert.findOneAndUpdate(
        { _id: alert._id, lastSentAt: alert.lastSentAt },
        { 
          $set: { 
            lastSentAt: now, 
            severity: alert.severity, 
            message: alert.message,
            currentValue: alert.currentValue,
            peakValue: alert.peakValue,
            pendingResolutionSince: null,
            triggerCount: alert.triggerCount
          } 
        },
        { new: true }
      );

      if (updatedAlert) {
        await dispatchAlert(updatedAlert, false);
        console.log(`[ALERT WORKER] Re-dispatched active alert: ${alertKey}`);
      }
    } else {
      await alert.save();
      console.log(`[ALERT WORKER] Suppressed alert (deduplication): ${alertKey}`);
    }
  } else {
    // New alert
    alert = await SystemAlert.create({
      alertKey,
      fingerprint,
      severity,
      message,
      currentValue: value,
      peakValue: value,
      status: 'active',
      firstTriggeredAt: now,
      lastSentAt: now,
      triggerCount: 1
    });
    await dispatchAlert(alert, false);
    console.log(`[ALERT WORKER] Dispatched NEW alert: ${alertKey}`);
  }
}

async function resolveAlert(alertKey) {
  const alert = await SystemAlert.findOne({ alertKey, status: 'active' });
  if (alert) {
    const now = new Date();
    
    // Stabilization logic
    if (!alert.pendingResolutionSince) {
      alert.pendingResolutionSince = now;
      await alert.save();
      console.log(`[ALERT WORKER] Alert ${alertKey} entering stabilization window.`);
      return;
    }

    if ((now - alert.pendingResolutionSince) >= STABILIZATION_MINUTES * 60000) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.currentValue = 0;
      await alert.save();
      await dispatchAlert(alert, true);
      console.log(`[ALERT WORKER] Resolved alert: ${alertKey}`);
    } else {
      console.log(`[ALERT WORKER] Alert ${alertKey} stabilizing...`);
    }
  }
}

async function runHealthChecks() {
  console.log(`[ALERT WORKER] Running health checks at ${new Date().toISOString()}`);
  try {
    const now = new Date();

    // 1. Process Force Resolved Alerts
    const forceResolved = await SystemAlert.find({ status: 'force_resolved' });
    for (const alert of forceResolved) {
      alert.status = 'resolved';
      alert.resolvedAt = now;
      alert.currentValue = 0;
      await alert.save();
      await dispatchAlert(alert, true);
      console.log(`[ALERT WORKER] Processed force_resolved alert: ${alert.alertKey}`);
    }

    const pending = await OutboxEvent.countDocuments({ status: 'pending' });
    const retry_wait = await OutboxEvent.countDocuments({ status: 'retry_wait' });
    const dead_letter = await OutboxEvent.countDocuments({ status: 'dead_letter' });
    const processing = await OutboxEvent.countDocuments({ status: 'processing' });
    const stuckProcessing = await OutboxEvent.countDocuments({ status: 'processing', leaseExpiresAt: { $lt: now } });
    
    // Active Workers - Using WorkerNode heartbeat which expires after 180s
    const activeWorkers = await WorkerNode.countDocuments();

    const oldestPending = await OutboxEvent.findOne({ status: 'pending' }).sort({ createdAt: 1 });
    const oldestPendingMinutes = oldestPending ? Math.floor((now - oldestPending.createdAt) / 60000) : 0;

    // Evaluate Dead Letter
    if (dead_letter > 20) {
      await triggerAlert('outbox_dlq', 'escalated_critical', dead_letter, `Dead letter queue at ${dead_letter} (>20). Immediate intervention required.`);
    } else if (dead_letter > 0) {
      await triggerAlert('outbox_dlq', 'critical', dead_letter, `Dead letter queue at ${dead_letter} (>0). Financial jobs are failing.`);
    } else {
      await resolveAlert('outbox_dlq');
    }

    // Evaluate Stuck Processing
    if (stuckProcessing > 0) {
      await triggerAlert('outbox_stuck_processing', 'critical', stuckProcessing, `Stuck processing leases at ${stuckProcessing} (>0). Worker crashes detected.`);
    } else {
      await resolveAlert('outbox_stuck_processing');
    }

    // Evaluate Oldest Pending
    if (oldestPendingMinutes > 30) {
      await triggerAlert('outbox_oldest_pending', 'critical', oldestPendingMinutes, `Oldest pending event is ${oldestPendingMinutes}m old (>30). Severe processing delay.`);
    } else if (oldestPendingMinutes > 15) {
      await triggerAlert('outbox_oldest_pending', 'warning', oldestPendingMinutes, `Oldest pending event is ${oldestPendingMinutes}m old (>15). Processing is slowing down.`);
    } else {
      await resolveAlert('outbox_oldest_pending');
    }

    // Evaluate Pending Threshold
    if (pending > 100) {
      await triggerAlert('outbox_high_pending', 'warning', pending, `Pending queue high: ${pending} (>100).`);
    } else {
      await resolveAlert('outbox_high_pending');
    }

    // Evaluate Retry Wait Spike
    if (retry_wait > 20) {
      await triggerAlert('outbox_retry_spike', 'warning', retry_wait, `Retry wait spike: ${retry_wait} (>20). Dependent systems may be down.`);
    } else {
      await resolveAlert('outbox_retry_spike');
    }

    // Evaluate Worker Count
    if (activeWorkers === 0 && (pending > 0 || processing > 0)) {
      await triggerAlert(
        'outbox_worker_down',
        'critical',
        0,
        'No active outbox workers detected while jobs are pending.'
      );
    } else {
      await resolveAlert('outbox_worker_down');
    }

  } catch (err) {
    console.error(`[ALERT WORKER] Error during health check:`, err);
  }
}

// Support manual invocation for tests
if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/school_app').then(() => {
    runHealthChecks().then(() => mongoose.disconnect());
  });
}

module.exports = {
  runHealthChecks,
  triggerAlert,
  resolveAlert
};
