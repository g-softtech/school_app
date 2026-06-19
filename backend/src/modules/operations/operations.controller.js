const OutboxEvent = require('../../models/OutboxEvent');

const { ok, bad } = require('../../utils/responseHandlers');

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
