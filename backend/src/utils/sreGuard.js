const SreStatus = require('../models/SreStatus');

const RESPONSES = {
  ALLOW: 'ALLOW',
  LOCKED_423: 'LOCKED_423',
  ALLOW_WITH_WARNING: 'ALLOW_WITH_WARNING',
  ALLOW_EMERGENCY: 'ALLOW_EMERGENCY'
};

let cachedState = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 2000;

async function checkSreAccess(action) {
  // Fast-path bypass: if we think we are FROZEN, bypass TTL to check if we've been un-frozen or if break-glass was just activated.
  // Wait, if we are FROZEN, maybe we want to bypass TTL so an emergency break-glass takes effect immediately.
  const isCacheValid = cachedState && (Date.now() - lastFetchedAt < CACHE_TTL_MS);
  
  // If cache is expired, or we are currently FROZEN (bypass cache to see if un-frozen or overridden)
  if (!isCacheValid || cachedState.sreState === 'FROZEN') {
    cachedState = await SreStatus.findOne();
    lastFetchedAt = Date.now();
  }

  const state = cachedState;

  if (!state) {
    // If no state exists yet, safe default is to allow. Evaluator will create it.
    return { decision: RESPONSES.ALLOW, state: 'NORMAL' };
  }

  const isBreakGlassActive = state.breakGlassActive && state.breakGlassExpiresAt > new Date();

  if (isBreakGlassActive) {
    // Scoped Break-Glass
    if (state.breakGlassScope && state.breakGlassScope.includes(action)) {
      return { decision: RESPONSES.ALLOW_EMERGENCY, state: 'EMERGENCY_BYPASS' };
    }
    // If not in scope, fall through to normal enforcement
  }

  if (state.sreState === 'FROZEN') {
    return { decision: RESPONSES.LOCKED_423, state: 'FROZEN' };
  }
  
  if (state.sreState === 'PENDING_FREEZE') {
    // Treat as DEGRADED until confirmation
    if (action === 'replayDlq' || action === 'retryJob') {
      return { decision: RESPONSES.ALLOW_WITH_WARNING, state: 'PENDING_FREEZE' };
    }
  }

  if (state.sreState === 'DEGRADED' && (action === 'replayDlq' || action === 'retryJob')) {
    return { decision: RESPONSES.ALLOW_WITH_WARNING, state: 'DEGRADED' };
  }

  return { decision: RESPONSES.ALLOW, state: state.sreState };
}

module.exports = { checkSreAccess, RESPONSES };
