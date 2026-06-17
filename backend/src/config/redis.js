const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;

function getRedisClient() {
  if (redis) return redis;

  redis = new Redis(REDIS_URL, {
    // lazyConnect: true ensures ioredis does NOT auto-connect on instantiation.
    // This prevents ECONNREFUSED from crashing the module at require() time
    // when REDIS_URL is unavailable (e.g. production cold start without Redis configured).
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('[REDIS] Connection failed after 3 retries. Giving up.');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
    enableOfflineQueue: false, // Do not queue commands while disconnected — fail fast
  });

  // MUST register error handler before connecting to prevent unhandled error crashes
  redis.on('error', (err) => {
    console.warn('[REDIS] Warning: Redis error (fallback to DB active):', err.message);
  });

  redis.on('connect', () => {
    console.log('[REDIS] Successfully connected.');
  });

  // Attempt connection asynchronously — never blocks the request
  redis.connect().catch((err) => {
    console.warn('[REDIS] Initial connection failed (system will use DB fallback):', err.message);
  });

  return redis;
}

module.exports = { getRedisClient };
