const express = require('express');
const router = express.Router();
const operationsController = require('./operations.controller');
const protect = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/outbox/metrics', operationsController.getMetrics);
router.get('/outbox/timeseries', operationsController.getTimeseries);
router.get('/outbox/health', operationsController.getHealth);
router.get('/outbox/events', operationsController.getEvents);

module.exports = router;
