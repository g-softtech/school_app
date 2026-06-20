const AdminActionLock = require('../models/AdminActionLock');

/**
 * Service to manage concurrency locks for administrative operations.
 */
exports.acquireLock = async function(actionKey, userId, ttlSeconds = 60) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // We can acquire if:
  // 1. Lock doesn't exist
  // 2. Lock exists but status is 'completed'
  // 3. Lock exists but is expired (handled by TTL, but we can also forcefully overwrite if past expiresAt)
  const lock = await AdminActionLock.findOneAndUpdate(
    {
      actionKey,
      $or: [
        { status: 'completed' },
        { expiresAt: { $lt: new Date() } },
        { _id: { $exists: false } } // For upsert logic clarity
      ]
    },
    {
      $set: {
        lockedBy: userId,
        status: 'running',
        expiresAt
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).catch(err => {
    // If a duplicate key error occurs, it means another thread successfully created a 'running' lock at the exact same moment.
    if (err.code === 11000) return null;
    throw err;
  });

  return lock !== null;
};

exports.releaseLock = async function(actionKey, userId) {
  await AdminActionLock.findOneAndUpdate(
    { actionKey, lockedBy: userId, status: 'running' },
    { $set: { status: 'completed' } }
  );
};
