const catchAsync = require('../../utils/catchAsync');
const integrityService = require('../../services/integrityService');
const ScanJob = require('../../models/ScanJob');

exports.runIntegrityScan = catchAsync(async (req, res) => {
  const scanTimestamp = new Date();
  
  const job = await ScanJob.create({
    status: 'pending',
    scanTimestamp
  });

  // Kick off background worker without awaiting it
  integrityService.runAsyncIntegrityScan(job._id, scanTimestamp);

  res.status(202).json({
    success: true,
    message: 'Integrity scan job created and processing in background.',
    data: {
      scanJobId: job._id
    }
  });
});

exports.getScanStatus = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const job = await ScanJob.findById(jobId).populate('anomalies.userId', 'name email').populate('anomalies.ledgerId', 'balance status');
  
  if (!job) {
    return res.status(404).json({ success: false, message: 'Scan job not found' });
  }

  res.status(200).json({
    success: true,
    data: job
  });
});

exports.triggerRebuild = catchAsync(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required to rebuild ledger' });
  }

  const result = await integrityService.rebuildLedgerFromEvents(userId);

  res.status(200).json({
    success: true,
    message: 'Ledger successfully rebuilt from event stream.',
    data: result
  });
});
