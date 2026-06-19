const { claimSyncJob, enqueueSyncJob } = require('../utils/syncQueue');
const { getRedisClient } = require('../config/redis');
const ledgerService = require('../services/ledgerService');
const crypto = require('crypto');

const WORKER_ID = 'pid-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');

let isRunning = false;

async function processQueue() {
    if (!isRunning) return;
    const redis = getRedisClient();

    try {
        // Step 1: Pop oldest bill from ZSET (Native atomic pop)
        const billId = await claimSyncJob();
        
        if (!billId) {
            // Queue is empty, sleep and poll again
            setTimeout(processQueue, 2000);
            return;
        }

        // Step 2: Try lock (SET NX EX 300)
        // This ensures single-worker processing and crash-safety
        const lockKey = `queue:bill_lock:${billId}`;
        const lockAcquired = await redis.set(lockKey, WORKER_ID, 'NX', 'EX', 300);
        
        if (!lockAcquired) {
            // The user explicitly requested to discard and move on.
            // If an adjustment arrived mid-process, the active worker will catch it via revision check.
            return setImmediate(processQueue);
        }

        console.log(`[SyncWorker] Acquired lock for bill ${billId}`);

        try {
            // Step 3-5: Load latest bill, recalculate pricing, save result
            await ledgerService.rebuildBillBalances(billId);

            console.log(`[SyncWorker] Successfully projected bill ${billId}`);
            
            // Clean up retry state on success
            await redis.hdel('queue:bill_retries', billId);

        } catch (err) {
            console.error(`[SyncWorker] Failed to rebuild bill ${billId}:`, err);
            
            // Step 6: Retry System (Simple Counter)
            const attempt = await redis.hincrby('queue:bill_retries', billId, 1);
            
            if (attempt > 3) {
                console.error(`[SyncWorker] Bill ${billId} exceeded retries. Moving to DLQ.`);
                const dlqData = JSON.stringify({
                    billId,
                    lastError: err.message,
                    failedAt: Date.now()
                });
                await redis.hset('queue:bill_deadletter', billId, dlqData);
                await redis.hdel('queue:bill_retries', billId);
            } else {
                console.log(`[SyncWorker] Re-enqueueing bill ${billId} for retry attempt ${attempt + 1}`);
                await enqueueSyncJob(billId);
            }
        } finally {
            // Step 7: Release lock
            // We only delete if we still own it (edge case: processing took > 5 mins and expired, we shouldn't delete another worker's lock)
            const currentLock = await redis.get(lockKey);
            if (currentLock === WORKER_ID) {
                await redis.del(lockKey);
            }
        }
    } catch (err) {
        console.error('[SyncWorker] Error during polling:', err);
        setTimeout(processQueue, 5000);
        return;
    }

    // Loop back immediately
    setImmediate(processQueue);
}

exports.start = () => {
    if (isRunning) return;
    isRunning = true;
    console.log(`[SyncWorker] Starting minimal production worker (${WORKER_ID})...`);
    processQueue();
};

exports.stop = () => {
    isRunning = false;
    console.log('[SyncWorker] Stopping projection worker...');
};
