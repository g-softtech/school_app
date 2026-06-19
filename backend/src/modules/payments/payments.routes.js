const express    = require('express');
const router     = express.Router();
const ctrl       = require('./payments.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

// Public — Paystack webhook
router.post('/webhook', ctrl.webhook);

router.use(protect);

// Analytics
router.get('/analytics',  restrictTo('admin'), ctrl.getAnalytics);

// Admin only
router.get('/',           restrictTo('admin'), ctrl.getAllPayments);
router.post('/manual',    restrictTo('admin'), ctrl.recordManualPayment);
router.patch('/:id/approve', restrictTo('admin'), ctrl.approvePayment);
router.patch('/:id/reject',  restrictTo('admin'), ctrl.rejectPayment);
router.post('/:id/reverse',  restrictTo('admin'), ctrl.reversePayment);

// Admin + parent + student
router.get('/student/:studentId', ctrl.getStudentPayments);
router.get('/:id/receipt',        ctrl.getReceipt);

// Wallet (Parent only)
router.get('/wallet', restrictTo('parent'), ctrl.getWalletBalance);
router.post('/wallet-checkout', restrictTo('parent'), ctrl.walletCheckout);

// Initialize — admin or parent
router.post('/initialize', restrictTo('admin','parent'), ctrl.initializePayment);

// Verify — public (Paystack redirects here)
router.get('/verify/:reference', ctrl.verifyPayment);

module.exports = router;
