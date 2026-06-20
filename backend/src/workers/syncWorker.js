const { getRedisClient } = require('../config/redis');
const ledgerService = require('../services/ledgerService');
const OutboxEvent = require('../models/OutboxEvent');
const crypto = require('crypto');
const os = require('os');
const WorkerNode = require('../models/WorkerNode');

const WORKER_ID = 'pid-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');

let isRunning = false;

// We process in small chunks of 20 to avoid monopolizing CPU or memory
const BATCH_SIZE = 20;

async function processQueue() {
    if (!isRunning) return;

    try {
        let processedCount = 0;
        
        while (processedCount < BATCH_SIZE) {
            // 1. Atomic claim with soft lease (2 minutes)
            const job = await OutboxEvent.findOneAndUpdate(
                { 
                    $or: [
                        {
                            status: { $in: ['pending', 'retry_wait'] },
                            nextRetryAt: { $lte: new Date() }
                        },
                        {
                            status: 'processing',
                            leaseExpiresAt: { $lt: new Date() } // Steal expired zombie leases
                        }
                    ]
                },
                { 
                    $set: { 
                        status: 'processing', 
                        leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000), 
                        workerId: WORKER_ID,
                        lastAttemptAt: new Date()
                    } 
                },
                { new: true, sort: { nextRetryAt: 1 } }
            );

            // If no jobs left in this burst, break out of loop to sleep
            if (!job) {
                break;
            }

            console.log(`[SyncWorker ${WORKER_ID}] Claimed OutboxEvent ${job._id} for Bill ${job.billId}`);

            try {
                // 2. Execute Financial Idempotent Job
                await ledgerService.rebuildBillBalances(job.billId, job._id);

                // 3. Mark Completed
                await OutboxEvent.updateOne(
                    { _id: job._id },
                    { 
                        $set: { 
                            status: 'completed', 
                            leaseExpiresAt: null, 
                            lastSuccessAt: new Date(),
                            errorReason: null
                        } 
                    }
                );
                
                console.log(`[SyncWorker] Successfully processed OutboxEvent ${job._id}`);
            } catch (err) {
                console.error(`[SyncWorker] Failed to process OutboxEvent ${job._id}:`, err);
                
                // 4. Failure Handling: Retry State Machine & Jittered Backoff
                const attempts = job.attempts + 1;
                
                // Is it a non-retryable error?
                const isNonRetryable = false; // Add specific error classifications if needed

                if (attempts >= 8 || isNonRetryable) {
                    await OutboxEvent.updateOne(
                        { _id: job._id },
                        { 
                            $set: { 
                                status: 'dead_letter',
                                leaseExpiresAt: null,
                                attempts: attempts,
                                lastErrorAt: new Date(),
                                errorReason: err.stack || err.message
                            } 
                        }
                    );
                    console.error(`[SyncWorker] OutboxEvent ${job._id} moved to DEAD LETTER QUEUE after ${attempts} attempts.`);
                } else {
                    // Jittered Backoff Formula: base * 2^attempts + jitter (max 15 mins)
                    const baseDelay = 5000 * Math.pow(2, attempts);
                    const jitter = Math.floor(Math.random() * 1000);
                    const delay = Math.min(baseDelay, 900000) + jitter;
                    
                    await OutboxEvent.updateOne(
                        { _id: job._id },
                        { 
                            $set: { 
                                status: 'retry_wait',
                                leaseExpiresAt: null,
                                nextRetryAt: new Date(Date.now() + delay),
                                attempts: attempts,
                                lastErrorAt: new Date(),
                                errorReason: err.message
                            } 
                        }
                    );
                    console.log(`[SyncWorker] Scheduled OutboxEvent ${job._id} for retry in ${delay}ms`);
                }
            }

            processedCount++;
        }

        // Active/Idle Polling Backoff
        if (processedCount > 0) {
            // We found jobs, loop back quickly (Active Sweep)
            setTimeout(processQueue, 1000);
        } else {
            // Queue empty, sleep longer (Idle Sweep)
            setTimeout(processQueue, 10000);
        }

    } catch (err) {
        console.error('[SyncWorker] Fatal error during polling:', err);
        // Fallback to prevent tight crash looping
        setTimeout(processQueue, 15000);
    }
}

exports.start = () => {
    if (isRunning) return;
    isRunning = true;
    console.log(`[SyncWorker] Starting production Outbox Worker (${WORKER_ID})...`);
    
    let heartbeatInterval;
    
    // Heartbeat
    heartbeatInterval = setInterval(async () => {
        try {
            await WorkerNode.updateOne(
                { workerId: WORKER_ID },
                { $set: { lastSeenAt: new Date(), hostname: os.hostname(), pid: process.pid } },
                { upsert: true }
            );
        } catch (err) {
            console.error('[SyncWorker] Heartbeat failed:', err);
        }
    }, 30000);

    processQueue();
};

exports.stop = () => {
    isRunning = false;
    console.log('[SyncWorker] Stopping Outbox Worker...');
};
