const express    = require('express');
const router     = express.Router();
const ctrl       = require('./timetable.controller');
const protect    = require('../../middleware/authMiddleware');
const restrictTo = require('../../middleware/roleMiddleware');

router.use(protect);

router.get('/',     ctrl.get);
router.post('/',    restrictTo('admin','teacher'), ctrl.upsert);
router.delete('/:id', restrictTo('admin'),         ctrl.remove);

module.exports = router;
