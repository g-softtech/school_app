const express = require('express');
const router = express.Router();
const operationsController = require('./operations.controller');
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin'));

const analyticsController = require('./analytics.controller');

router.get('/outbox/metrics', operationsController.getMetrics);
router.get('/outbox/timeseries', operationsController.getTimeseries);
router.get('/outbox/health', operationsController.getHealth);
router.get('/outbox/events', operationsController.getEvents);
router.get('/outbox/alerts', operationsController.getAlerts);

router.get('/outbox/sre-status', operationsController.getSreStatus);
router.get('/outbox/sre-transitions', operationsController.getSreTransitions);
router.get('/outbox/break-glass-history', operationsController.getBreakGlassHistory);
router.get('/outbox/incidents', operationsController.getIncidents);
router.get('/outbox/unified-events', operationsController.getUnifiedEvents);
router.get('/outbox/executive-summary', operationsController.getExecutiveSummary);
router.get('/outbox/reliability-history', operationsController.getReliabilityHistory);

router.post('/outbox/:id/retry', operationsController.retryJob);
router.post('/outbox/replay-dlq', operationsController.replayDlq);
router.post('/outbox/break-glass', operationsController.breakGlass);

router.post('/alerts/:id/acknowledge', operationsController.acknowledgeAlert);
router.post('/alerts/:id/force-resolve', operationsController.forceResolveAlert);

router.get('/outbox/analytics', analyticsController.getAnalytics);
router.get('/outbox/incidents/export', analyticsController.exportIncidents);

router.get('/certification', operationsController.getCertification);

module.exports = router;
