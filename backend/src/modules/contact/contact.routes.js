const express    = require('express');
const router     = express.Router();
const ctrl       = require('./contact.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

// ── Public routes (no auth) ───────────────────────────────────────────────────
router.post('/',             ctrl.submitContact);
router.post('/admissions',   ctrl.submitAdmission);
router.get('/stats',         ctrl.getPublicStats);

// ── Admin only ────────────────────────────────────────────────────────────────
router.use(protect, restrictTo('admin'));
router.get('/admissions',          ctrl.getAdmissions);
router.patch('/admissions/:id',    ctrl.updateAdmission);
router.get('/messages',            ctrl.getMessages);
router.patch('/messages/:id/read', ctrl.markMessageRead);

module.exports = router;
