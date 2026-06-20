import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../utils/constants';

export default function BillingOperations() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [events, setEvents] = useState({ data: [], pagination: {} });
  const [alerts, setAlerts] = useState({ active: [], resolved: [] });
  const [loading, setLoading] = useState(true);
  
  // Table filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [billIdFilter, setBillIdFilter] = useState('');
  const [workerIdFilter, setWorkerIdFilter] = useState('');

  // Auto-refresh interval
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [page, statusFilter, billIdFilter, workerIdFilter]);

  const fetchDashboardData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      
      const [metricsRes, healthRes, eventsRes, alertsRes] = await Promise.all([
        axios.get(`${API_URL}/operations/outbox/metrics`, config),
        axios.get(`${API_URL}/operations/outbox/health`, config),
        axios.get(`${API_URL}/operations/outbox/events`, {
          ...config,
          params: { page, status: statusFilter, billId: billIdFilter, workerId: workerIdFilter }
        }),
        axios.get(`${API_URL}/operations/outbox/alerts`, config)
      ]);

      setMetrics(metricsRes.data.data);
      setHealth(healthRes.data.data);
      setEvents(eventsRes.data.data);
      setAlerts(alertsRes.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setLoading(false);
    }
  };

  const handleRetry = async (jobId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/operations/outbox/${jobId}/retry`, {}, config);
      fetchDashboardData();
    } catch (err) {
      console.error('Retry failed', err);
      alert('Failed to retry job.');
    }
  };

  const handleReplayDlq = async () => {
    const reason = window.prompt('WARNING: Replaying DLQ can cause retry storms.\nEnter an audit reason to proceed:');
    if (!reason) return;
    
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.post(`${API_URL}/operations/outbox/replay-dlq`, { reason }, config);
      alert(res.data.message);
      fetchDashboardData();
    } catch (err) {
      console.error('Replay DLQ failed', err);
      alert('Failed to replay DLQ.');
    }
  };

  const renderHealthBanner = () => {
    if (!health) return null;
    let bgColor = 'bg-green-100 border-green-400 text-green-700';
    let icon = '✅';
    if (health.status === 'warning') {
      bgColor = 'bg-yellow-100 border-yellow-400 text-yellow-700';
      icon = '⚠️';
    } else if (health.status === 'critical') {
      bgColor = 'bg-red-100 border-red-400 text-red-700';
      icon = '🚨';
    }

    return (
      <div className={`p-4 border-l-4 rounded shadow-sm mb-6 ${bgColor}`}>
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <div>
            <h3 className="font-bold uppercase">Queue Status: {health.status}</h3>
            {health.reasons && health.reasons.length > 0 && (
              <ul className="list-disc ml-5 mt-1 text-sm">
                {health.reasons.map((r, idx) => <li key={idx}>{r}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && !metrics) return <div className="p-8 text-center text-gray-500">Loading operations dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing Operations</h1>
        <p className="mt-1 text-sm text-gray-500">Real-time monitoring for the Financial Outbox System.</p>
      </div>

      {renderHealthBanner()}

      {/* Active Alerts Panel */}
      {alerts.active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Active System Alerts</h2>
          <div className="bg-white shadow rounded-lg border border-red-200 overflow-hidden">
            <ul className="divide-y divide-red-100">
              {alerts.active.map(alert => (
                <li key={alert._id} className="p-4 hover:bg-red-50 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        {alert.severity.replace('_', ' ').toUpperCase()} • {alert.alertKey}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Source: {alert.source} | Triggered: {new Date(alert.firstTriggeredAt).toLocaleString()} | Count: {alert.triggerCount}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {alert.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <MetricCard title="Pending" value={metrics?.pending || 0} color="bg-blue-50 text-blue-700 border-blue-200" />
        <MetricCard title="Processing" value={metrics?.processing || 0} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
        <MetricCard title="Retry Wait" value={metrics?.retry_wait || 0} color="bg-yellow-50 text-yellow-700 border-yellow-200" />
        <MetricCard title="Dead Letter" value={metrics?.dead_letter || 0} color="bg-red-50 text-red-700 border-red-200" />
        <MetricCard title="Stuck Processing" value={metrics?.stuckProcessing || 0} color="bg-orange-50 text-orange-700 border-orange-200" />
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Queue Age (Pending)</h4>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span>0-1m:</span> <b>{metrics?.pendingAgeBuckets?.['0-1m'] || 0}</b></div>
            <div className="flex justify-between"><span>1-5m:</span> <b>{metrics?.pendingAgeBuckets?.['1-5m'] || 0}</b></div>
            <div className="flex justify-between text-yellow-600"><span>5-15m:</span> <b>{metrics?.pendingAgeBuckets?.['5-15m'] || 0}</b></div>
            <div className="flex justify-between text-red-600"><span>15m+:</span> <b>{metrics?.pendingAgeBuckets?.['15m+'] || 0}</b></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Processing Health</h4>
          <div className="mt-2 text-sm space-y-2">
            <div className="flex justify-between"><span>Active Workers:</span> <b>{metrics?.workerCount || 0}</b></div>
            <div className="flex justify-between"><span>Avg Processing:</span> <b>{metrics?.avgProcessingSeconds || 0}s</b></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow-sm border border-gray-200 col-span-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Hour Throughput</h4>
          <div className="mt-2 text-sm space-y-2">
            <div className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span> {metrics?.completedLastHour || 0} Events Completed</div>
            <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span> {metrics?.failedLastHour || 0} Events Failed (DLQ)</div>
          </div>
        </div>
      </div>

      {/* Outbox Events Table */}
      <div className="bg-white shadow rounded-lg border border-gray-200">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Event Browser</h3>
          <button
            onClick={handleReplayDlq}
            className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-700 shadow-sm transition"
          >
            Replay All DLQ
          </button>
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <select
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="retry_wait">Retry Wait</option>
              <option value="dead_letter">Dead Letter</option>
              <option value="completed">Completed</option>
            </select>
            <input
              type="text"
              placeholder="Filter by Bill ID"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={billIdFilter}
              onChange={(e) => { setBillIdFilter(e.target.value); setPage(1); }}
            />
            <input
              type="text"
              placeholder="Filter by Worker ID"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={workerIdFilter}
              onChange={(e) => { setWorkerIdFilter(e.target.value); setPage(1); }}
            />
            <button
              className="mt-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              onClick={fetchDashboardData}
            >
              Refresh Data
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Key</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.data.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">No events found matching criteria.</td></tr>
              ) : events.data.map((event) => (
                <React.Fragment key={event.eventKey}>
                  <tr className={event.status === 'dead_letter' ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.eventKey}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${event.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          event.status === 'dead_letter' ? 'bg-red-100 text-red-800' : 
                          event.status === 'retry_wait' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-blue-100 text-blue-800'}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.attempts}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.workerId || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(event.updatedAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {['pending', 'retry_wait', 'dead_letter'].includes(event.status) && (
                        <button 
                          onClick={() => handleRetry(event._id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* DLQ Drill Down */}
                  {event.status === 'dead_letter' && event.errorReason && (
                    <tr className="bg-red-50">
                      <td colSpan="6" className="px-6 py-3 border-t-0 border-b border-red-200">
                        <div className="text-xs text-red-700 font-mono p-2 bg-red-100 rounded overflow-x-auto whitespace-pre-wrap">
                          <strong>Last Error ({new Date(event.lastErrorAt).toLocaleString()}):</strong><br/>
                          {event.errorReason}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {events.pagination && events.pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{events.pagination.pages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(events.pagination.pages, p + 1))}
                    disabled={page === events.pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div className={`overflow-hidden shadow rounded-lg border p-5 ${color}`}>
      <dt className="text-sm font-medium truncate uppercase tracking-wide opacity-80">{title}</dt>
      <dd className="mt-1 text-3xl font-semibold">{value}</dd>
    </div>
  );
}
