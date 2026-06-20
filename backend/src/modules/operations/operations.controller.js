const OutboxEvent = require('../../models/OutboxEvent');
const SystemAlert = require('../../models/SystemAlert');
const AuditLog = require('../../models/Auditlog');
const SystemCertification = require('../../models/SystemCertification');
const { acquireLock, releaseLock } = require('../../services/lockService');
const sreGuard = require('../../utils/sreGuard');
const SreStatus = require('../../models/SreStatus');

const { ok, bad } = require('../../utils/responseHandlers');

exports.getCertification = async function(req, res) {
  try {
    const latest = await SystemCertification.findOne().sort({ createdAt: -1 }).populate('runIds');
    if (!latest) return res.status(404).json({ message: 'No certification found' });
    ok(res, latest);
  } catch (err) {
    console.error(err);
    bad(res, 'Failed to fetch certification', 500);
  }
};

/**
 * Helper: Build time series buckets
 */
function getPast24HoursBuckets() {
  const buckets = [];
  const now = new Date();
  now.setMinutes(0, 0, 0); // truncate to hour
  for (let i = 23; i >= 0; i--) {
    const bucketTime = new Date(now.getTime() - (i * 60 * 60 * 1000));
    buckets.push(bucketTime);
  }
  return buckets;
}

exports.getMetrics = async function(req, res) {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 1. Status Counts
    const statusCounts = await OutboxEvent.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const counts = { pending: 0, processing: 0, retry_wait: 0, dead_letter: 0, completed: 0 };
    statusCounts.forEach(s => counts[s._id] = s.count);

    // 2. Stuck Processing
    const stuckProcessing = await OutboxEvent.countDocuments({
      status: 'processing',
      leaseExpiresAt: { $lt: now }
    });

    // 3. Oldest Pending Minutes
    const oldestPending = await OutboxEvent.findOne({ status: 'pending' }).sort({ createdAt: 1 });
    let oldestPendingMinutes = 0;
    if (oldestPending) {
      oldestPendingMinutes = Math.floor((now - oldestPending.createdAt) / 60000);
    }

    // 4. Activity last hour
    const completedLastHour = await OutboxEvent.countDocuments({ status: 'completed', updatedAt: { $gte: oneHourAgo } });
    const failedLastHour = await OutboxEvent.countDocuments({ status: 'dead_letter', lastErrorAt: { $gte: oneHourAgo } });

    // 5. Avg Processing Seconds
    const completedEvents = await OutboxEvent.find({ status: 'completed' }).sort({ updatedAt: -1 }).limit(100);
    let avgProcessingSeconds = 0;
    if (completedEvents.length > 0) {
      const sum = completedEvents.reduce((acc, ev) => acc + (ev.updatedAt - ev.createdAt), 0);
      avgProcessingSeconds = Math.round((sum / completedEvents.length) / 1000);
    }

    // 6. Worker Count (unique workers active in last hour)
    const activeWorkers = await OutboxEvent.distinct('workerId', {
      $or: [
        { status: 'processing' },
        { lastAttemptAt: { $gte: oneHourAgo } }
      ]
    });
    const workerCount = activeWorkers.filter(w => w).length;

    // 7. Pending Age Buckets
    const pendingBucketsAgg = await OutboxEvent.aggregate([
      { $match: { status: 'pending' } },
      {
        $project: {
          ageMinutes: { $divide: [{ $subtract: [now, '$createdAt'] }, 60000] }
        }
      },
      {
        $bucket: {
          groupBy: '$ageMinutes',
          boundaries: [0, 1, 5, 15],
          default: '15m+',
          output: { count: { $sum: 1 } }
        }
      }
    ]);
    const pendingAgeBuckets = { '0-1m': 0, '1-5m': 0, '5-15m': 0, '15m+': 0 };
    pendingBucketsAgg.forEach(b => {
      if (b._id === 0) pendingAgeBuckets['0-1m'] = b.count;
      else if (b._id === 1) pendingAgeBuckets['1-5m'] = b.count;
      else if (b._id === 5) pendingAgeBuckets['5-15m'] = b.count;
      else if (b._id === '15m+') pendingAgeBuckets['15m+'] = b.count;
    });

    return ok(res, {
      ...counts,
      stuckProcessing,
      oldestPendingMinutes,
      completedLastHour,
      failedLastHour,
      avgProcessingSeconds,
      workerCount,
      pendingAgeBuckets
    });
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getTimeseries = async function(req, res) {
  try {
    const buckets = getPast24HoursBuckets();
    const startTime = buckets[0];

    const agg = await OutboxEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime }
        }
      },
      {
        $project: {
          status: 1,
          hour: {
            $dateTrunc: {
              date: '$createdAt',
              unit: 'hour'
            }
          }
        }
      },
      {
        $group: {
          _id: { status: '$status', hour: '$hour' },
          count: { $sum: 1 }
        }
      }
    ]);

    const timeseries = { pending: [], processing: [], retry_wait: [], dead_letter: [], completed: [], labels: [] };
    
    // Fill buckets with 0
    buckets.forEach(date => {
      const label = date.toISOString();
      timeseries.labels.push(label);
      ['pending', 'processing', 'retry_wait', 'dead_letter', 'completed'].forEach(s => {
        timeseries[s].push(0);
      });
    });

    agg.forEach(result => {
      const status = result._id.status;
      const hourDate = new Date(result._id.hour);
      // Find bucket index
      const bucketIdx = buckets.findIndex(b => b.getTime() === hourDate.getTime());
      if (bucketIdx !== -1 && timeseries[status]) {
        timeseries[status][bucketIdx] = result.count;
      }
    });

    return ok(res, timeseries);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getHealth = async function(req, res) {
  try {
    const now = new Date();
    const dead_letter = await OutboxEvent.countDocuments({ status: 'dead_letter' });
    const stuckProcessing = await OutboxEvent.countDocuments({ status: 'processing', leaseExpiresAt: { $lt: now } });
    
    const oldestPending = await OutboxEvent.findOne({ status: 'pending' }).sort({ createdAt: 1 });
    let oldestPendingMinutes = 0;
    if (oldestPending) {
      oldestPendingMinutes = Math.floor((now - oldestPending.createdAt) / 60000);
    }

    let status = 'healthy';
    const reasons = [];

    // Critical Rules
    if (dead_letter >= 50) reasons.push(`Dead letter queue at ${dead_letter} (>=50)`);
    if (oldestPendingMinutes >= 30) reasons.push(`Oldest pending event is ${oldestPendingMinutes}m old (>=30)`);
    if (stuckProcessing >= 10) reasons.push(`Stuck processing leases at ${stuckProcessing} (>=10)`);

    if (reasons.length > 0) {
      status = 'critical';
    } else {
      // Warning Rules
      if (dead_letter > 0) reasons.push(`Dead letter queue at ${dead_letter} (>0)`);
      if (oldestPendingMinutes >= 5) reasons.push(`Oldest pending event is ${oldestPendingMinutes}m old (>=5)`);
      if (stuckProcessing > 0) reasons.push(`Stuck processing leases at ${stuckProcessing} (>0)`);
      
      if (reasons.length > 0) {
        status = 'warning';
      }
    }

    return ok(res, { status, reasons });
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getEvents = async function(req, res) {
  try {
    let { page, status, billId, workerId } = req.query;
    page = Math.max(1, Number(page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    
    const filter = {};
    if (status) filter.status = status;
    if (billId) filter.billId = billId;
    if (workerId) filter.workerId = workerId;

    const total = await OutboxEvent.countDocuments(filter);
    const events = await OutboxEvent.find(filter)
      .select('eventKey billId status attempts workerId createdAt updatedAt errorReason lastErrorAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return ok(res, {
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: events
    });
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getAlerts = async function(req, res) {
  try {
    const active = await SystemAlert.find({ status: 'active' }).sort({ severity: -1, firstTriggeredAt: -1 }).lean();
    const resolved = await SystemAlert.find({ status: 'resolved' }).sort({ resolvedAt: -1 }).limit(50).lean();

    return ok(res, { active, resolved });
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getSreStatus = async function(req, res) {
  try {
    const status = await SreStatus.findOne().lean();
    if (!status) {
      return ok(res, { sreState: 'NORMAL', isInitialized: false });
    }
    return ok(res, status);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getSreTransitions = async function(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const SreTransitionEvent = require('../../models/SreTransitionEvent');
    const transitions = await SreTransitionEvent.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return ok(res, transitions);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getBreakGlassHistory = async function(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const events = await AuditLog.find({ action: 'SRE_BREAK_GLASS_ACTIVATED' })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return ok(res, events);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getUnifiedEvents = async function(req, res) {
  try {
    const SreTransitionEvent = require('../../models/SreTransitionEvent');

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    
    // Fetch recent transitions
    const transitions = await SreTransitionEvent.find().sort({ timestamp: -1 }).limit(limit).lean();
    
    // Fetch recent SRE/Alert audit logs
    const auditLogs = await AuditLog.find({
      action: { $in: ['SRE_BREAK_GLASS_ACTIVATED', 'SRE_DLQ_REPLAYED', 'SRE_JOB_RETRIED', 'ALERT_ACKNOWLEDGED', 'ALERT_FORCE_RESOLVED'] }
    }).populate('userId', 'name').sort({ createdAt: -1 }).limit(limit).lean();

    // Fetch recent alerts
    const alerts = await SystemAlert.find().sort({ createdAt: -1 }).limit(limit).lean();

    let unified = [];

    transitions.forEach(t => unified.push({
      id: t._id,
      type: 'STATE_CHANGE',
      timestamp: t.timestamp,
      details: {
        fromState: t.fromState,
        toState: t.toState,
        triggerSource: t.triggerSource,
        burnRateFast: t.burnRateFast,
        errorAcceleration: t.errorAcceleration
      }
    }));

    auditLogs.forEach(a => unified.push({
      id: a._id,
      type: a.action,
      timestamp: a.createdAt,
      actor: a.userId?.name || 'System',
      details: a.details || {}
    }));

    alerts.forEach(a => unified.push({
      id: a._id,
      type: 'ALERT',
      timestamp: a.createdAt,
      details: {
        severity: a.severity,
        status: a.status,
        message: a.message,
        resolvedAt: a.resolvedAt
      }
    }));

    unified.sort((a, b) => b.timestamp - a.timestamp);
    
    return ok(res, unified.slice(0, limit));
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getIncidents = async function(req, res) {
  try {
    const SreTransitionEvent = require('../../models/SreTransitionEvent');

    // Fetch last N transitions, chronological
    const transitions = await SreTransitionEvent.find().sort({ timestamp: 1 }).lean();
    
    // Fetch audit logs
    const auditLogs = await AuditLog.find({
      action: { $in: ['SRE_BREAK_GLASS_ACTIVATED', 'SRE_DLQ_REPLAYED'] }
    }).populate('userId', 'name').sort({ createdAt: 1 }).lean();

    const incidents = [];
    let currentIncident = null;

    for (const t of transitions) {
      if (t.fromState === 'NORMAL' && t.toState !== 'NORMAL') {
        // Start new incident
        currentIncident = {
          id: `INC-${t._id.toString().substring(0, 8)}`,
          startTime: t.timestamp,
          endTime: null,
          status: 'ONGOING',
          trigger: t.triggerSource,
          events: [t],
          peakBurn: t.burnRateFast,
          peakAcceleration: t.errorAcceleration,
          interventions: []
        };
        incidents.push(currentIncident);
      } else if (currentIncident) {
        // Add to current incident
        currentIncident.events.push(t);
        if (t.burnRateFast > currentIncident.peakBurn) currentIncident.peakBurn = t.burnRateFast;
        if (t.errorAcceleration > currentIncident.peakAcceleration) currentIncident.peakAcceleration = t.errorAcceleration;

        if (t.toState === 'NORMAL') {
          // Close incident
          currentIncident.endTime = t.timestamp;
          currentIncident.status = 'RESOLVED';
          currentIncident.durationMinutes = Math.round((new Date(currentIncident.endTime) - new Date(currentIncident.startTime)) / 60000);
          currentIncident = null;
        }
      }
    }

    // Attach interventions to incidents
    for (const inc of incidents) {
      const end = inc.endTime ? new Date(inc.endTime) : new Date();
      const start = new Date(inc.startTime);
      inc.interventions = auditLogs.filter(a => {
        const aTime = new Date(a.createdAt);
        return aTime >= start && aTime <= end;
      }).map(a => ({
        action: a.action,
        timestamp: a.createdAt,
        actor: a.userId?.name || 'System'
      }));
    }

    // Return descending
    incidents.reverse();

    return ok(res, incidents);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

const GRADE_TABLE = [
  { min: 99.95, grade: 'A+' },
  { min: 99.5,  grade: 'A'  },
  { min: 99.0,  grade: 'B'  },
  { min: 98.0,  grade: 'C'  },
  { min: 95.0,  grade: 'D'  },
  { min: 0,     grade: 'F'  },
];

function calcGrade(score) {
  for (const { min, grade } of GRADE_TABLE) {
    if (score >= min) return grade;
  }
  return 'F';
}

exports.getExecutiveSummary = async function(req, res) {
  try {
    const SreTransitionEvent = require('../../models/SreTransitionEvent');
    const OperationalMetricsDaily = require('../../models/OperationalMetricsDaily');

    // --- Reliability Score (30-day) from daily metrics ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyMetrics = await OperationalMetricsDaily.find({
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
    }).lean();

    let totalThroughput = 0, totalDlq = 0;
    dailyMetrics.forEach(d => {
      totalThroughput += d.throughput || 0;
      totalDlq += d.dlqCount || 0;
    });
    const reliabilityScore = totalThroughput > 0
      ? parseFloat(((1 - (totalDlq / totalThroughput)) * 100).toFixed(3))
      : 100;
    const grade = calcGrade(reliabilityScore);

    // --- MTTR from resolved incident transitions ---
    const transitions = await SreTransitionEvent.find().sort({ timestamp: 1 }).lean();
    const mttrSamples = [];
    let incidentStart = null;
    let incidentsThisMonth = 0;
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    for (const t of transitions) {
      if (t.fromState === 'NORMAL' && t.toState !== 'NORMAL') {
        incidentStart = new Date(t.timestamp);
        if (incidentStart >= monthStart) incidentsThisMonth++;
      } else if (incidentStart && t.toState === 'NORMAL') {
        const durationMs = new Date(t.timestamp) - incidentStart;
        mttrSamples.push(durationMs / 60000);
        incidentStart = null;
      }
    }
    const mttrMinutes = mttrSamples.length > 0
      ? parseFloat((mttrSamples.reduce((a, b) => a + b, 0) / mttrSamples.length).toFixed(1))
      : 0;

    // --- Active incident? ---
    const currentState = await SreStatus.findOne().lean();
    const isIncidentActive = currentState && currentState.sreState !== 'NORMAL';
    let activeIncidentStartedAt = null;
    if (isIncidentActive && transitions.length > 0) {
      // Last NORMAL departure
      for (let i = transitions.length - 1; i >= 0; i--) {
        if (transitions[i].fromState === 'NORMAL') {
          activeIncidentStartedAt = transitions[i].timestamp;
          break;
        }
      }
    }

    // --- Last incident days ago ---
    let lastIncidentDaysAgo = null;
    const lastResolution = transitions.slice().reverse().find(t => t.toState === 'NORMAL');
    if (lastResolution) {
      lastIncidentDaysAgo = Math.floor((Date.now() - new Date(lastResolution.timestamp)) / 86400000);
    }

    // --- Critical alerts ---
    const criticalAlerts = await SystemAlert.countDocuments({ status: 'active', severity: 'critical' });

    // --- Latest certification ---
    const latestCert = await SystemCertification.findOne().sort({ createdAt: -1 }).lean();

    return ok(res, {
      reliabilityScore,
      grade,
      availability: reliabilityScore,
      mttrMinutes,
      incidentsThisMonth,
      criticalAlerts,
      financialDataLoss: latestCert?.metrics?.maxJobLossRate ?? 0,
      lastIncidentDaysAgo,
      isIncidentActive,
      activeIncidentState: currentState?.sreState || null,
      activeIncidentBreakGlass: currentState?.breakGlassActive || false,
      activeIncidentStartedAt,
      lastCertification: latestCert ? {
        version: latestCert.version,
        status: latestCert.status,
        certifiedAt: latestCert.certifiedAt,
        jobLossRate: latestCert.metrics?.maxJobLossRate ?? 0,
        duplicateExecution: latestCert.metrics?.maxDuplicateExecution ?? 0,
        workerKillsSurvived: latestCert.metrics?.workerFailureToleranceLevel ?? 0,
      } : null,
    });
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.getReliabilityHistory = async function(req, res) {
  try {
    const OperationalMetricsDaily = require('../../models/OperationalMetricsDaily');
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const metrics = await OperationalMetricsDaily.find()
      .sort({ date: -1 })
      .limit(days)
      .lean();

    const history = metrics.reverse().map(d => {
      const reliability = d.throughput > 0
        ? parseFloat(((1 - (d.dlqCount / d.throughput)) * 100).toFixed(3))
        : 100;
      return { date: d.date, reliability, throughput: d.throughput, dlqCount: d.dlqCount };
    });
    return ok(res, history);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};

exports.retryJob = async function(req, res) {
  const lockKey = `retry_job_${req.params.id}`;
  const locked = await acquireLock(lockKey, req.user.id);
  if (!locked) return bad(res, 409, 'Another admin is currently modifying this job.');

  try {
    const sreCheck = await sreGuard.checkSreAccess('retryJob');
    if (sreCheck.decision === sreGuard.RESPONSES.LOCKED_423) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 423, `SRE Error Budget Exhausted. State: ${sreCheck.state}. Break-glass required.`);
    }

    const { id } = req.params;
    
    // Check replay count first
    const targetJob = await OutboxEvent.findById(id);
    if (!targetJob) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 404, 'Job not found.');
    }

    if (targetJob.replayHistory && targetJob.replayHistory.length >= 3) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 400, 'Replay limit reached (max 3). This job cannot be safely retried again.');
    }

    const job = await OutboxEvent.findOneAndUpdate(
      { 
        _id: id, 
        status: { $in: ['pending', 'retry_wait', 'dead_letter'] }
      },
      { 
        $set: { 
          status: 'pending',
          nextRetryAt: new Date(),
          lastError: null
        },
        $push: {
          replayHistory: {
            type: 'retry',
            timestamp: new Date(),
            adminId: req.user.id
          }
        }
      },
      { new: true }
    );

    if (!job) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 404, 'Job not in a retryable state.');
    }

    await AuditLog.create({
      action: 'RETRY_JOB',
      userId: req.user.id,
      userType: 'admin',
      resource: 'OutboxEvent',
      method: 'POST',
      details: { jobId: id, replayAttempt: job.replayHistory.length }
    });

    await releaseLock(lockKey, req.user.id);
    return ok(res, job, 'Job queued for immediate retry.');
  } catch (err) {
    await releaseLock(lockKey, req.user.id);
    return bad(res, 500, err.message);
  }
};

exports.replayDlq = async function(req, res) {
  const lockKey = 'replay_dlq';
  const locked = await acquireLock(lockKey, req.user.id, 120); // 2 minute lock
  if (!locked) return bad(res, 409, 'Another DLQ replay operation is currently running.');

  try {
    const sreCheck = await sreGuard.checkSreAccess('replayDlq');
    if (sreCheck.decision === sreGuard.RESPONSES.LOCKED_423) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 423, `SRE Error Budget Exhausted. State: ${sreCheck.state}. Break-glass required.`);
    }

    const { reason, limit = 500, olderThan } = req.body;
    
    // Build query with optional filters
    const query = { status: 'dead_letter' };
    if (olderThan) {
      query.createdAt = { $lt: new Date(olderThan) };
    }

    const dlqJobs = await OutboxEvent.find(query)
      .limit(Number(limit))
      .select('_id replayHistory');

    // Filter jobs that haven't hit the replay limit
    const eligibleJobIds = dlqJobs
      .filter(j => !j.replayHistory || j.replayHistory.length < 3)
      .map(j => j._id);

    if (eligibleJobIds.length === 0) {
      await releaseLock(lockKey, req.user.id);
      return ok(res, { replayed: 0 }, 'No eligible DLQ jobs matched (some may have hit the max 3 replay limit).');
    }

    await OutboxEvent.updateMany(
      { _id: { $in: eligibleJobIds } },
      { 
        $set: { 
          status: 'pending',
          nextRetryAt: new Date(),
          lastError: null
        },
        $push: {
          replayHistory: {
            type: 'dlq_replay',
            timestamp: new Date(),
            adminId: req.user.id
          }
        }
      }
    );

    await AuditLog.create({
      action: 'REPLAY_DLQ',
      userId: req.user.id,
      userType: 'admin',
      resource: 'OutboxEvent',
      method: 'POST',
      details: { 
        replayedCount: eligibleJobIds.length,
        skippedCount: dlqJobs.length - eligibleJobIds.length,
        filters: req.body,
        reason: reason || 'Admin triggered DLQ replay'
      }
    });

    await releaseLock(lockKey, req.user.id);
    return ok(res, { replayed: eligibleJobIds.length }, `Replayed ${eligibleJobIds.length} DLQ jobs.`);
  } catch (err) {
    await releaseLock(lockKey, req.user.id);
    return bad(res, 500, err.message);
  }
};

exports.acknowledgeAlert = async function(req, res) {
  const lockKey = `ack_alert_${req.params.id}`;
  const locked = await acquireLock(lockKey, req.user.id);
  if (!locked) return bad(res, 409, 'Another admin is currently acknowledging this alert.');

  try {
    const { id } = req.params;
    const alert = await SystemAlert.findOneAndUpdate(
      { _id: id, status: 'active' },
      { 
        $set: { 
          acknowledgedBy: req.user.id,
          acknowledgedAt: new Date()
        } 
      },
      { new: true }
    );

    if (!alert) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 404, 'Alert not found or already resolved.');
    }

    await releaseLock(lockKey, req.user.id);
    return ok(res, alert, 'Alert acknowledged.');
  } catch (err) {
    await releaseLock(lockKey, req.user.id);
    return bad(res, 500, err.message);
  }
};

exports.forceResolveAlert = async function(req, res) {
  const lockKey = `force_resolve_alert_${req.params.id}`;
  const locked = await acquireLock(lockKey, req.user.id);
  if (!locked) return bad(res, 409, 'Another admin is currently resolving this alert.');

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 400, 'A reason is required to force resolve an alert.');
    }

    // Set to 'force_resolved' intermediate state
    // alertWorker will verify and transition to 'resolved'
    const alert = await SystemAlert.findOneAndUpdate(
      { _id: id, status: 'active' },
      { 
        $set: { 
          status: 'force_resolved',
          acknowledgedBy: req.user.id,
          acknowledgedAt: new Date(),
          resolvedAt: new Date()
        } 
      },
      { new: true }
    );

    if (!alert) {
      await releaseLock(lockKey, req.user.id);
      return bad(res, 404, 'Alert not found or already resolved.');
    }

    await AuditLog.create({
      action: 'FORCE_RESOLVE_ALERT',
      userId: req.user.id,
      userType: 'admin',
      resource: 'SystemAlert',
      method: 'POST',
      details: { 
        alertId: id,
        alertKey: alert.alertKey,
        reason: reason
      }
    });

    await releaseLock(lockKey, req.user.id);
    return ok(res, alert, 'Alert marked for forced resolution. System will verify safety conditions.');
  } catch (err) {
    await releaseLock(lockKey, req.user.id);
    return bad(res, 500, err.message);
  }
};

exports.breakGlass = async function(req, res) {
  try {
    const { reason, scope, durationMinutes } = req.body;
    if (!reason || reason.length < 30) {
      return bad(res, 400, 'A detailed reason (at least 30 characters) is required to activate Break-Glass mode.');
    }
    
    if (!scope || !Array.isArray(scope) || scope.length === 0) {
      return bad(res, 400, 'A scope array is required (e.g., ["replayDlq"]).');
    }

    if (scope.includes('forceResolve') && !scope.includes('ackAlert')) {
      return bad(res, 400, 'Security Constraint: forceResolve cannot be activated without ackAlert permission.');
    }

    const adminId = req.user.id;
    
    const policy = require('../../config/sre_policy.json');
    const maxDurationMs = policy.breakGlass?.maxDurationMs || 600000;
    
    let requestedDurationMs = (durationMinutes || 10) * 60 * 1000;
    if (requestedDurationMs > maxDurationMs) {
      requestedDurationMs = maxDurationMs;
    }
    
    const expiresAt = new Date(Date.now() + requestedDurationMs);

    await SreStatus.findOneAndUpdate(
      {},
      {
        $set: {
          sreState: 'EMERGENCY_BYPASS',
          breakGlassActive: true,
          breakGlassExpiresAt: expiresAt,
          breakGlassReason: reason,
          breakGlassScope: scope,
          breakGlassAdminId: adminId
        }
      },
      { upsert: true }
    );

    await AuditLog.create({
      action: 'SRE_BREAK_GLASS_ACTIVATED',
      userId: adminId,
      userType: 'admin',
      resource: 'SreStatus',
      method: 'POST',
      details: { reason, scope, expiresAt }
    });

    return ok(res, { expiresAt, scope }, `BREAK-GLASS ACTIVATED. Safety guards temporarily suspended for [${scope.join(', ')}].`);
  } catch (err) {
    return bad(res, 500, err.message);
  }
};
