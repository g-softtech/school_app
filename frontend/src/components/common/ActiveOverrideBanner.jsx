import React, { useState, useEffect } from 'react';
import { sreService } from '../../services/sreService';
import BreakGlassCountdown from '../../pages/admin/sre/components/GlassBox/BreakGlassCountdown';

const ActiveOverrideBanner = () => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const res = await sreService.getSreStatus();
        if (mounted) setStatus(res.data);
      } catch { /* silent */ }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const isActive = status?.breakGlassActive && new Date(status?.breakGlassExpiresAt) > new Date();
  if (!isActive) return null;

  const scope = status.breakGlassScope || [];
  const adminName = status.breakGlassAdminId?.name || 'Administrator';

  return (
    <div className="bg-purple-900 border-b-2 border-purple-600 px-6 py-3 flex items-center justify-between gap-6 flex-wrap text-sm z-50">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse shrink-0"></span>
        <span className="font-bold text-purple-200 uppercase tracking-wider">EMERGENCY BYPASS ACTIVE</span>
        <span className="text-purple-400 hidden md:inline">|</span>
        <span className="text-purple-300 hidden md:inline">
          By: <span className="font-semibold text-white">{adminName}</span>
        </span>
        <span className="text-purple-400 hidden md:inline">|</span>
        <span className="text-purple-300 hidden md:inline">
          Scope: <span className="font-mono text-purple-200">{scope.join(', ')}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-purple-400 text-xs">Expires:</span>
        <BreakGlassCountdown expiresAt={status.breakGlassExpiresAt} />
      </div>
    </div>
  );
};

export default ActiveOverrideBanner;
