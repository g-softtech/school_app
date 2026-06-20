const cron = require('node-cron');
const OperationalMetricsDaily = require('../models/OperationalMetricsDaily');
const OutboxEvent = require('../models/OutboxEvent');
const WorkerNode = require('../models/WorkerNode');

/**
 * Runs at 00:00 UTC every day.
 * Calculates metrics for the PREVIOUS UTC day.
 */
function startMetricsAggregator() {
  // '0 0 * * *' = At 00:00 UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[METRICS AGGREGATOR] Starting daily aggregation...');
      
      const now = new Date();
      // Calculate for the previous day
      const targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = targetDate.toISOString().split('T')[0];

      const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
      const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

      // 1. Throughput (jobs completed on that day)
      const throughput = await OutboxEvent.countDocuments({
        status: 'completed',
        lastAttemptAt: { $gte: startOfDay, $lte: endOfDay }
      });

      // 2. DLQ Count (jobs that failed/became DLQ on that day)
      const dlqCount = await OutboxEvent.countDocuments({
        status: 'dead_letter',
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });

      // 3. Active Workers (unique workers seen that day)
      // Since WorkerNodes expire in 3 minutes via TTL, this might just capture the count at exactly 00:00 UTC.
      // Alternatively, we could log peak workers, but for now we just capture how many are alive at midnight UTC.
      const activeWorkers = await WorkerNode.countDocuments();

      await OperationalMetricsDaily.findOneAndUpdate(
        { date: dateStr },
        { 
          $set: { 
            throughput, 
            dlqCount, 
            activeWorkers 
          } 
        },
        { upsert: true, new: true }
      );

      console.log(`[METRICS AGGREGATOR] Successfully aggregated metrics for ${dateStr}`);
    } catch (err) {
      console.error('[METRICS AGGREGATOR] Error aggregating metrics:', err);
    }
  }, {
    timezone: "UTC"
  });
}

module.exports = { startMetricsAggregator };
