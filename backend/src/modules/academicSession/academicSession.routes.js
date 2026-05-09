const express    = require('express');
const router     = express.Router();
const ctrl       = require('./academicSession.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/',         ctrl.getAll);
router.get('/current',  ctrl.getCurrent);
router.post('/',        restrictTo('admin'), ctrl.create);
router.patch('/:id',    restrictTo('admin'), ctrl.update);
router.patch('/:id/set-current', restrictTo('admin'), ctrl.setCurrent);
router.delete('/:id',  restrictTo('admin'), ctrl.remove);

module.exports = router;
