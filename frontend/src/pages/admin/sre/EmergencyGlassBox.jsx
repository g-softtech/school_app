import React, { useState, useEffect } from 'react';
import { sreService } from '../../../services/sreService';
import { useSreDashboard } from '../../../hooks/useSreDashboard';
import FreezeContextPanel from './components/GlassBox/FreezeContextPanel';
import ActiveSessionLock from './components/GlassBox/ActiveSessionLock';
import ScopePermissionsCard from './components/GlassBox/ScopePermissionsCard';
import OverrideEventTimeline from './components/GlassBox/OverrideEventTimeline';

const SCOPE_OPTIONS = [
  { key: 'replayDlq', label: 'Replay Dead-Letter Queue (replayDlq)' },
  { key: 'retryJob', label: 'Retry Individual Failed Jobs (retryJob)' },
  { key: 'ackAlert', label: 'Acknowledge Active Alerts (ackAlert)' },
  { key: 'forceResolve', label: 'Force Resolve Alerts (forceResolve) — requires ackAlert' },
];

const DURATION_OPTIONS = [5, 10, 15];

const EmergencyGlassBox = () => {
  const { status, loading } = useSreDashboard();
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ reason: '', scope: [], duration: 10, confirmation: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    sreService.getBreakGlassHistory()
      .then(r => setHistory(r.data || []))
      .catch(() => {});
  }, [success]);

  const isBreakGlassActive = status?.breakGlassActive && new Date(status?.breakGlassExpiresAt) > new Date();

  const validate = () => {
    const errs = {};
    if (form.reason.trim().length < 30) errs.reason = 'Reason must be at least 30 characters.';
    if (form.scope.length === 0) errs.scope = 'Select at least one scope action.';
    if (form.scope.includes('forceResolve') && !form.scope.includes('ackAlert')) {
      errs.scope = 'forceResolve requires ackAlert to also be selected.';
    }
    if (form.confirmation !== 'BREAK_GLASS') errs.confirmation = 'You must type BREAK_GLASS exactly.';
    return errs;
  };

  const toggleScope = (key) => {
    setForm(f => ({
      ...f,
      scope: f.scope.includes(key) ? f.scope.filter(s => s !== key) : [...f.scope, key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      await sreService.activateBreakGlass({
        reason: form.reason,
        scope: form.scope,
        durationMinutes: form.duration
      });
      setSuccess(true);
      setForm({ reason: '', scope: [], duration: 10, confirmation: '' });
      window.location.reload();
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="animate-pulse">Loading SRE status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="text-red-500">🔴</span> Emergency Glass Box
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Activating an override temporarily suspends automated safety controls. All actions are permanently audited.
          </p>
        </header>

        {/* 1. Freeze Context */}
        <FreezeContextPanel status={status} />

        {/* 2. If already active, show lock screen */}
        {isBreakGlassActive ? (
          <ActiveSessionLock status={status} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Reason */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-3">
              <label className="block text-gray-300 font-semibold text-sm uppercase tracking-wider">
                Reason for Override
              </label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={4}
                placeholder="Describe the incident and why the override is necessary..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-red-600 resize-none"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span className={form.reason.length < 30 ? 'text-red-400' : 'text-green-400'}>
                  {form.reason.length}/30 minimum
                </span>
                {errors.reason && <span className="text-red-400">{errors.reason}</span>}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-3">
              <label className="block text-gray-300 font-semibold text-sm uppercase tracking-wider">
                Scope of Override
              </label>
              <div className="space-y-3">
                {SCOPE_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.scope.includes(opt.key)}
                      onChange={() => toggleScope(opt.key)}
                      className="mt-0.5 h-4 w-4 accent-red-500"
                    />
                    <span className={`text-sm ${form.scope.includes(opt.key) ? 'text-gray-100' : 'text-gray-500'} group-hover:text-gray-300 transition-colors`}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.scope && <p className="text-red-400 text-xs mt-1">{errors.scope}</p>}
            </div>

            {/* Duration */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-3">
              <label className="block text-gray-300 font-semibold text-sm uppercase tracking-wider">
                Override Duration
              </label>
              <div className="flex gap-4">
                {DURATION_OPTIONS.map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value={d}
                      checked={form.duration === d}
                      onChange={() => setForm(f => ({ ...f, duration: d }))}
                      className="accent-red-500"
                    />
                    <span className={`text-sm ${form.duration === d ? 'text-gray-100 font-semibold' : 'text-gray-500'}`}>
                      {d} Minutes
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Scope Preview */}
            {form.scope.length > 0 && (
              <ScopePermissionsCard activeScope={form.scope} />
            )}

            {/* Risk Warning */}
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex gap-4 items-start">
              <span className="text-red-400 text-2xl">⚠</span>
              <div>
                <div className="text-red-300 font-bold">Risk Level: HIGH</div>
                <div className="text-red-400/80 text-sm mt-1">
                  This action temporarily disables automated safety controls for the selected scope.
                  All actions are permanently audited and cannot be reversed.
                </div>
              </div>
            </div>

            {/* Typed Confirmation */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-3">
              <label className="block text-gray-300 font-semibold text-sm uppercase tracking-wider">
                Final Confirmation
              </label>
              <p className="text-gray-500 text-sm">Type <span className="font-mono font-bold text-red-400">BREAK_GLASS</span> to enable the override button.</p>
              <input
                type="text"
                value={form.confirmation}
                onChange={e => setForm(f => ({ ...f, confirmation: e.target.value }))}
                placeholder="BREAK_GLASS"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 font-mono text-sm focus:outline-none focus:border-red-600"
              />
              {errors.confirmation && <p className="text-red-400 text-xs">{errors.confirmation}</p>}
            </div>

            {submitError && (
              <div className="bg-red-900/20 border border-red-700 rounded p-4 text-red-400 text-sm">{submitError}</div>
            )}

            <button
              type="submit"
              disabled={form.confirmation !== 'BREAK_GLASS' || submitting}
              className="w-full py-4 rounded-lg font-bold text-lg tracking-wider transition-all duration-200
                disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed
                enabled:bg-red-700 enabled:hover:bg-red-600 enabled:text-white enabled:shadow-lg enabled:shadow-red-900/40"
            >
              {submitting ? 'Activating Override…' : '🔴 ACTIVATE EMERGENCY OVERRIDE'}
            </button>
          </form>
        )}

        {/* Override Event History */}
        <OverrideEventTimeline history={history} />
      </div>
    </div>
  );
};

export default EmergencyGlassBox;
