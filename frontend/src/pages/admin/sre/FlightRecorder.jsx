import React, { useState, useEffect } from 'react';
import { sreService } from '../../../services/sreService';
import IncidentTimeline from './components/FlightRecorder/IncidentTimeline';
import UnifiedEventStream from './components/FlightRecorder/UnifiedEventStream';

const FlightRecorder = () => {
  const [mode, setMode] = useState('INCIDENTS'); // 'INCIDENTS' or 'EVENTS'
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (mode === 'INCIDENTS') {
          const res = await sreService.getIncidents();
          setIncidents(res.data);
        } else {
          const res = await sreService.getUnifiedEvents();
          setEvents(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch flight recorder data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mode]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="border-b border-gray-800 pb-4 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="text-blue-500">✈️</span> Flight Recorder
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Chronological reconstruction of system incidents and interventions.
            </p>
          </div>
          
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
            <button
              onClick={() => setMode('INCIDENTS')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'INCIDENTS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Incident Reconstruction
            </button>
            <button
              onClick={() => setMode('EVENTS')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'EVENTS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Unified Event Stream
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-20 text-center text-gray-500 animate-pulse">
            Reconstructing timeline...
          </div>
        ) : (
          <div>
            {mode === 'INCIDENTS' ? (
              <IncidentTimeline incidents={incidents} />
            ) : (
              <UnifiedEventStream events={events} />
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default FlightRecorder;
