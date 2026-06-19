const { getRedisClient } = require('../config/redis');

async function enqueueSyncJob(billId) {
    const redis = getRedisClient();
    const timestamp = Date.now();
    // ZADD NX: Only adds if it doesn't exist, preserving the original FIFO priority timestamp if coalescing
    const result = await redis.zadd('queue:bill_sync', 'NX', timestamp, billId);
    return result === 1 ? 'ENQUEUED' : 'COALESCED';
}

async function claimSyncJob() {
    const redis = getRedisClient();
    // Native atomic pop: returns [member, score]
    const res = await redis.zpopmin('queue:bill_sync');
    if (!res || res.length === 0) return null;
    return res[0]; // billId
}

module.exports = {
    enqueueSyncJob,
    claimSyncJob
};
