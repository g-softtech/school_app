const catchAsync = require('../../utils/catchAsync');
const CreditLedger = require('../../models/CreditLedger');
const StudentBill = require('../../models/StudentBill');
const Payment = require('../../models/Payment');

exports.getFinancialHealth = catchAsync(async (req, res) => {
  const result = await CreditLedger.aggregate([
    {
      $group: {
        _id: null,
        totalLiability: { $sum: '$balance' },
        activeWallets: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        frozenWallets: { $sum: { $cond: [{ $eq: ['$status', 'frozen'] }, 1, 0] } },
        closedWallets: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        rebuildingWallets: { $sum: { $cond: ['$rebuildInProgress', 1, 0] } }
      }
    }
  ]);

  const stats = result[0] || {
    totalLiability: 0,
    activeWallets: 0,
    frozenWallets: 0,
    closedWallets: 0,
    rebuildingWallets: 0
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});

exports.getRevenueHeatmap = catchAsync(async (req, res) => {
  const { session } = req.query;
  const matchFilter = {};
  if (session) matchFilter.session = session;

  const payments = await Payment.aggregate([
    { $match: { ...matchFilter, status: 'paid' } },
    {
      $group: {
        _id: { term: '$term', feeType: '$feeType' },
        totalCollected: { $sum: '$amount' }
      }
    }
  ]);

  const heatmap = payments.map(p => ({
    term: p._id.term,
    feeType: p._id.feeType,
    totalCollected: p.totalCollected
  }));

  res.status(200).json({
    success: true,
    data: heatmap
  });
});

exports.getSyncStatus = catchAsync(async (req, res) => {
  const { getRedisClient } = require('../../config/redis');
  const redis = getRedisClient();

  const pendingCount = await redis.zcard('queue:bill_sync');
  
  // Find active locks
  const lockKeys = await redis.keys('queue:bill_lock:*');
  const processing = [];
  for (const key of lockKeys) {
    const workerId = await redis.get(key);
    const ttl = await redis.ttl(key);
    if (workerId) {
      processing.push({
        billId: key.replace('queue:bill_lock:', ''),
        workerId: workerId,
        expiresIn: ttl
      });
    }
  }

  const dlqRaw = await redis.hgetall('queue:bill_deadletter');
  const deadletter = Object.values(dlqRaw).map(str => JSON.parse(str));

  res.status(200).json({
    success: true,
    data: {
      pendingCount,
      processing,
      deadletter,
      deadletterArchive: 0 // Removed in final spec
    }
  });
});

