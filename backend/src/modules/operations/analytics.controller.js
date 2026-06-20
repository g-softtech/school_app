const SystemAlert = require('../../models/SystemAlert');
const OutboxEvent = require('../../models/OutboxEvent');
const OperationalMetricsDaily = require('../../models/OperationalMetricsDaily');
const AuditLog = require('../../models/Auditlog');
const { ok, bad } = require('../../utils/responseHandlers');

exports.getAnalytics = async function(req, res) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. MTTR (Mean Time To Resolution) for resolved incidents in last 30 days
    const resolvedAlerts = await SystemAlert.find({ 
      status: 'resolved',
      resolvedAt: { $gte: thirtyDaysAgo }
    }).lean();

    let totalResolutionTimeMs = 0;
    let resolvedCount = resolvedAlerts.length;

    resolvedAlerts.forEach(alert => {
      const duration = new Date(alert.resolvedAt).getTime() - new Date(alert.firstTriggeredAt).getTime();
      totalResolutionTimeMs += duration;
    });

    const mttrMinutes = resolvedCount > 0 ? (totalResolutionTimeMs / resolvedCount) / 60000 : 0;

    // 2. Alert Volume Last 30 Days (grouped by severity)
    const alertVolumeAgg = await SystemAlert.aggregate([
      { $match: { firstTriggeredAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } }
    ]);

    const alertVolume = { warning: 0, critical: 0, escalated_critical: 0 };
    alertVolumeAgg.forEach(item => {
      alertVolume[item._id] = item.count;
    });

    const totalAlertVolume = alertVolume.warning + alertVolume.critical + alertVolume.escalated_critical;
    const escalatedIncidents = alertVolume.escalated_critical;

    // 3, 4, 5. Read from OperationalMetricsDaily for the last 30 days
    const dailyMetrics = await OperationalMetricsDaily.find({
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
    }).sort({ date: 1 }).lean();

    let throughput = 0;
    const dlqTrend = [];
    const workerTrend = [];

    // Initialize with 0s
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const match = dailyMetrics.find(m => m.date === dateStr);
      
      if (match) {
        throughput += match.throughput;
        dlqTrend.push({ date: dateStr, count: match.dlqCount });
        workerTrend.push({ date: dateStr, activeWorkers: match.activeWorkers });
      } else {
        dlqTrend.push({ date: dateStr, count: 0 });
        workerTrend.push({ date: dateStr, activeWorkers: 0 });
      }
    }

    return ok(res, {
      mttrMinutes: Math.round(mttrMinutes),
      alertVolume: totalAlertVolume,
      alertVolumeBySeverity: alertVolume,
      escalatedIncidents,
      throughput,
      dlqTrend,
      workerTrend
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    return bad(res, 500, err.message);
  }
};

exports.exportIncidents = async function(req, res) {
  try {
    const alerts = await SystemAlert.find({}).sort({ firstTriggeredAt: -1 }).lean();

    // Create CSV header
    let csvStr = "Alert Key,Severity,Source,Status,First Triggered At,Resolved At,Duration (Minutes),Trigger Count,Peak Value\n";

    alerts.forEach(alert => {
      const triggeredStr = new Date(alert.firstTriggeredAt).toISOString();
      const resolvedStr = alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : '';
      let durationStr = '';
      if (alert.resolvedAt) {
        const durationMs = new Date(alert.resolvedAt).getTime() - new Date(alert.firstTriggeredAt).getTime();
        durationStr = Math.round(durationMs / 60000).toString();
      }

      const row = [
        alert.alertKey,
        alert.severity,
        alert.source,
        alert.status,
        triggeredStr,
        resolvedStr,
        durationStr,
        alert.triggerCount || 1,
        alert.peakValue || ''
      ];
      csvStr += row.join(',') + '\n';
    });

    // Log the export action
    await AuditLog.create({
      action: 'INCIDENT_EXPORT',
      userId: req.user.id,
      userType: 'admin',
      resource: 'SystemAlert',
      method: 'GET',
      details: {
        recordCount: alerts.length,
        filters: req.query
      }
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('incident_export.csv');
    return res.send(csvStr);
  } catch (err) {
    console.error('Export Error:', err);
    return bad(res, 500, err.message);
  }
};
