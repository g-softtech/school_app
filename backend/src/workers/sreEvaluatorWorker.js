const OutboxEvent = require('../models/OutboxEvent');
const SreStatus = require('../models/SreStatus');
const SreTransitionEvent = require('../models/SreTransitionEvent');
const crypto = require('crypto');
const policy = require('../config/sre_policy.json');

async function getWindowMetrics(windowMinutes, offsetMinutes = 0) {
  const since = new Date(Date.now() - (windowMinutes + offsetMinutes) * 60000);
  const until = new Date(Date.now() - offsetMinutes * 60000);
  
  // Total jobs created/updated in window
  const totalJobs = await OutboxEvent.countDocuments({ updatedAt: { $gte: since, $lt: until } });
  
  // Failed jobs in window (dead_letter or retry_wait)
  const failedJobs = await OutboxEvent.countDocuments({
    updatedAt: { $gte: since, $lt: until },
    status: { $in: ['dead_letter', 'retry_wait'] } // Jobs that didn't succeed immediately
  });

  return { totalJobs, failedJobs };
}

function computeBurnRate(metrics, policy, windowMinutes) {
  // Prevent division by zero if system is idle
  if (metrics.totalJobs === 0) return 0;

  const errorRate = metrics.failedJobs / metrics.totalJobs;
  const allowedErrorRate = policy.errorBudget.maxAllowedFailureRate;
  
  const errorBudgetConsumed = errorRate / allowedErrorRate;
  
  // Window fraction (e.g. 5 min / 43200 min for 30d)
  const windowFraction = windowMinutes / 43200; 

  const burnRate = errorBudgetConsumed / windowFraction;
  return burnRate;
}

async function evaluateSRE() {
  try {
    const [fastWindow, mediumWindow, slowWindow, previousFastWindow] = await Promise.all([
      getWindowMetrics(policy.burnRateWindows[0].windowMinutes), // Fast: 5m
      getWindowMetrics(policy.burnRateWindows[1].windowMinutes), // Medium: 60m
      getWindowMetrics(policy.burnRateWindows[2].windowMinutes), // Slow: 240m
      getWindowMetrics(policy.burnRateWindows[0].windowMinutes, policy.burnRateWindows[0].windowMinutes) // Previous 5m
    ]);

    const fastBurn = computeBurnRate(fastWindow, policy, policy.burnRateWindows[0].windowMinutes);
    const mediumBurn = computeBurnRate(mediumWindow, policy, policy.burnRateWindows[1].windowMinutes);
    const slowBurn = computeBurnRate(slowWindow, policy, policy.burnRateWindows[2].windowMinutes);

    const errorAcceleration = fastWindow.failedJobs - previousFastWindow.failedJobs;
    const normalizedAcceleration = fastWindow.totalJobs > 0 ? errorAcceleration / fastWindow.totalJobs : 0;

    let currentStateDoc = await SreStatus.findOne();
    if (!currentStateDoc) {
      currentStateDoc = await SreStatus.create({ sreState: 'NORMAL' });
    }

    let newState = currentStateDoc.sreState;
    let triggerSource = null;
    let freezeReason = currentStateDoc.freezeReason;

    const fastBurnTriggered = fastBurn > policy.burnRateWindows[0].multiplierThreshold;
    const mediumBurnTriggered = mediumBurn > policy.burnRateWindows[1].multiplierThreshold;
    const slowBurnTriggered = slowBurn > policy.burnRateWindows[2].multiplierThreshold;

    const now = Date.now();

    if (fastBurnTriggered) {
      // Reset recovery timer if we were recovering
      currentStateDoc.recoveryStartedAt = null;

      if (newState === 'NORMAL' || newState === 'DEGRADED') {
        newState = 'PENDING_FREEZE';
        triggerSource = 'FAST_BURN';
        freezeReason = 'FAST_BURN_DETECTED_AWAITING_CONFIRMATION';
        currentStateDoc.pendingFreezeStartedAt = new Date(now);
      } else if (newState === 'PENDING_FREEZE') {
        const frozenWindowSec = policy.stateTransitions.frozenConfirmationWindowSeconds || 120;
        if (currentStateDoc.pendingFreezeStartedAt && (now - currentStateDoc.pendingFreezeStartedAt.getTime() >= frozenWindowSec * 1000)) {
          newState = 'FROZEN';
          triggerSource = 'FAST_BURN_CONFIRMED';
          freezeReason = 'FAST_BURN_ERROR_BUDGET_EXCEEDED';
          currentStateDoc.freezeStartedAt = new Date(now);
        }
      }
    } else if (mediumBurnTriggered) {
      currentStateDoc.recoveryStartedAt = null;
      newState = 'DEGRADED';
      triggerSource = 'MEDIUM_BURN';
      freezeReason = 'MEDIUM_BURN_DETECTED';
    } else if (slowBurnTriggered) {
      currentStateDoc.recoveryStartedAt = null;
      newState = 'DEGRADED';
      triggerSource = 'SLOW_BURN';
      freezeReason = 'SLOW_BURN_WARNING';
    } else {
      // We are healthy now. We need to debounce recovery.
      if (newState === 'PENDING_FREEZE' || newState === 'FROZEN' || newState === 'DEGRADED') {
        if (currentStateDoc.pendingFreezeStartedAt) {
          currentStateDoc.pendingFreezeStartedAt = null;
        }

        if (!currentStateDoc.recoveryStartedAt) {
          currentStateDoc.recoveryStartedAt = new Date(now);
        }

        const recoveryWindowSec = policy.stateTransitions.recoveryConfirmationWindowSeconds || 180;
        if (now - currentStateDoc.recoveryStartedAt.getTime() >= recoveryWindowSec * 1000) {
          newState = 'NORMAL';
          triggerSource = 'RECOVERY_CONFIRMED';
          freezeReason = null;
          currentStateDoc.recoveryStartedAt = null;
        }
      }
    }

    const stateChanged = currentStateDoc.sreState !== newState;

    if (stateChanged) {
      const transitionId = crypto.randomUUID();
      
      await SreTransitionEvent.create({
        transitionId,
        fromState: currentStateDoc.sreState,
        toState: newState,
        triggerSource: triggerSource || 'UNKNOWN',
        burnRateFast: fastBurn,
        burnRateMedium: mediumBurn,
        burnRateSlow: slowBurn,
        errorAcceleration,
        normalizedAcceleration
      });

      currentStateDoc.previousTransitionId = currentStateDoc.currentTransitionId;
      currentStateDoc.currentTransitionId = transitionId;
    }

    currentStateDoc.sreState = newState;
    currentStateDoc.freezeReason = freezeReason;
    currentStateDoc.errorBudgetUsed = mediumWindow.failedJobs;
    currentStateDoc.errorBudgetLimit = mediumWindow.totalJobs * policy.errorBudget.maxAllowedFailureRate;
    currentStateDoc.currentFastBurn = fastBurn;
    currentStateDoc.currentMediumBurn = mediumBurn;
    currentStateDoc.currentSlowBurn = slowBurn;
    currentStateDoc.currentAcceleration = errorAcceleration;
    currentStateDoc.evaluationVersion = 'v1.0';
    currentStateDoc.lastEvaluatedAt = new Date();

    await currentStateDoc.save();
    
  } catch (err) {
    console.error('SRE Evaluator Worker failed:', err);
  }
}

let evaluatorInterval = null;

function start() {
  if (!evaluatorInterval) {
    evaluatorInterval = setInterval(evaluateSRE, policy.evaluationIntervalSeconds * 1000);
    console.log(`[SRE Evaluator] Started, evaluating every ${policy.evaluationIntervalSeconds}s`);
  }
}

function stop() {
  if (evaluatorInterval) {
    clearInterval(evaluatorInterval);
    evaluatorInterval = null;
    console.log('[SRE Evaluator] Stopped');
  }
}

module.exports = { start, stop, evaluateSRE };
