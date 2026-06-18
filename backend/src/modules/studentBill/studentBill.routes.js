const express    = require('express');
const router     = express.Router();
const ctrl       = require('./studentBill.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.post('/generate',          restrictTo('admin'), ctrl.generateBills);
router.post('/generate-single',   restrictTo('admin'), ctrl.generateSingleBill);
router.get('/defaulters',         restrictTo('admin'), ctrl.getDefaulters);
router.get('/student/:studentId', ctrl.getStudentBills);
router.get('/',                   restrictTo('admin'), ctrl.getAllBills);
router.get('/:id',                ctrl.getBill);
router.patch('/:id/discount',     restrictTo('admin'), ctrl.applyDiscount);
router.patch('/:id/waive',        restrictTo('admin'), ctrl.waiveItem);
router.patch('/:id/carry-over',   restrictTo('admin'), ctrl.setCarryOver);
router.post('/:id/sync',          restrictTo('admin'), ctrl.syncBill);
router.delete('/:id',             restrictTo('admin'), ctrl.deleteBill);

module.exports = router;
