const express = require('express');
const router  = express.Router();
const {
  getSchoolAnalytics,
  getClassAnalytics,
  getStudentAnalytics,
  getPaymentAnalytics,
} = require('./analytics.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

const financialController = require('./financial.controller');
const integrityController = require('./integrity.controller');
const auditController     = require('./audit.controller');

router.use(protect);

router.get('/school',              restrictTo('admin'), getSchoolAnalytics);
router.get('/payments',            restrictTo('admin'), getPaymentAnalytics);
router.get('/class/:classId',      restrictTo('admin', 'teacher'), getClassAnalytics);
router.get('/student/:studentId',  restrictTo('admin', 'teacher', 'student', 'parent'), getStudentAnalytics);

// Phase 2D: Financial Observability
router.get('/financial-health',    restrictTo('admin'), financialController.getFinancialHealth);
router.get('/revenue-heatmap',     restrictTo('admin'), financialController.getRevenueHeatmap);
router.get('/sync-status',         restrictTo('admin'), financialController.getSyncStatus);

// Integrity & Recovery
router.post('/integrity/scan',     restrictTo('admin'), integrityController.runIntegrityScan);
router.get('/integrity/scan/:jobId', restrictTo('admin'), integrityController.getScanStatus);
router.post('/integrity/rebuild',  restrictTo('admin'), integrityController.triggerRebuild);

// Audit
router.get('/ledger/:userId/audit', restrictTo('admin'), auditController.getLedgerAuditChain);

module.exports = router;