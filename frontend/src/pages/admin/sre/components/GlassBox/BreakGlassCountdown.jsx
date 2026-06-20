import React, { useState, useEffect } from 'react';

const BreakGlassCountdown = ({ expiresAt }) => {
  const [remaining, setRemaining] = useState('');
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!expiresAt) return;

    const calc = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining('EXPIRED');
        setPct(0);
        return;
      }
      const totalMs = new Date(expiresAt).getTime() - (new Date(expiresAt).getTime() - ms);
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      // We don't know original duration easily here, so just show ms/15min
      const maxMs = 15 * 60 * 1000;
      setPct(Math.max(0, Math.min(100, (ms / maxMs) * 100)));
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isLow = pct < 30;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-4">
      <div className={`text-5xl font-mono font-bold tracking-widest ${isLow ? 'text-red-500 animate-pulse' : 'text-purple-400'}`}>
        {remaining}
      </div>
      <div className="text-gray-500 text-xs uppercase tracking-widest">Override Remaining</div>
      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-purple-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default BreakGlassCountdown;
