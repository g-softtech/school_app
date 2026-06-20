import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../utils/constants';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

export default function AlertHistory() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState({ active: [], resolved: [] });
  const [loading, setLoading] = useState(true);

  // Filters for Incident History
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchDashboardData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      
      const [alertsRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/operations/outbox/alerts`, config),
        axios.get(`${API_URL}/operations/outbox/analytics`, config)
      ]);

      setAlerts(alertsRes.data.data);
      setAnalytics(analyticsRes.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load alert history data', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAcknowledge = async (alertId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/operations/alerts/${alertId}/acknowledge`, {}, config);
      fetchDashboardData();
    } catch (err) {
      console.error('Acknowledge failed', err);
    }
  };

  const handleForceResolve = async (alertId) => {
    const reason = window.prompt("WARNING: Force resolving may mask ongoing system failures. Please enter an audit reason:");
    if (!reason) return;
    
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/operations/alerts/${alertId}/force-resolve`, { reason }, config);
      fetchDashboardData();
    } catch (err) {
      console.error('Force resolve failed', err);
      alert('Failed to force resolve alert. ' + (err.response?.data?.error || err.message));
    }
  };

  const handleExport = async () => {
    try {
      const config = { 
        headers: { Authorization: `Bearer ${user.token}` },
        responseType: 'blob' 
      };
      const response = await axios.get(`${API_URL}/operations/outbox/incidents/export`, config);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'incident_export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Alert History...</div>;
  }

  const renderActiveIncidents = () => {
    if (!alerts.active || alerts.active.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Active Incident Center</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.active.map(alert => {
            const started = new Date(alert.firstTriggeredAt);
            const durationMins = Math.floor((new Date() - started) / 60000);
            const durationStr = durationMins > 60 
              ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` 
              : `${durationMins}m`;

            return (
              <div key={alert._id} className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    alert.severity === 'escalated_critical' ? 'bg-red-600 text-white' :
                    alert.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
                  }`}>
                    {alert.severity.toUpperCase().replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">{durationStr} open</span>
                </div>
                <h3 className="text-md font-semibold text-gray-900">{alert.alertKey}</h3>
                <p className="text-sm text-gray-700 mt-1 mb-3">{alert.message}</p>
                
                <div className="grid grid-cols-2 gap-2 text-sm border-t border-red-100 pt-3 mb-3">
                  <div>
                    <p className="text-gray-500 text-xs">Current Value</p>
                    <p className="font-semibold text-gray-900">{alert.currentValue || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Peak Value</p>
                    <p className="font-semibold text-gray-900">{alert.peakValue || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Started</p>
                    <p className="font-semibold text-gray-900">{started.toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Trigger Count</p>
                    <p className="font-semibold text-gray-900">{alert.triggerCount}</p>
                  </div>
                </div>
                
                <div className="border-t border-red-100 pt-3 flex justify-between items-center">
                  {alert.acknowledgedBy ? (
                    <span className="text-xs text-gray-500 italic">Acknowledged</span>
                  ) : (
                    <button 
                      onClick={() => handleAcknowledge(alert._id)}
                      className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  
                  <button 
                    onClick={() => handleForceResolve(alert._id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 ml-2"
                  >
                    Force Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const filteredHistory = alerts.resolved.filter(a => {
    if (severityFilter && a.severity !== severityFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alert History & Analytics</h1>
        <button 
          onClick={handleExport}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 shadow-sm text-sm font-medium"
        >
          Export CSV
        </button>
      </div>

      {/* Operational Analytics Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">MTTR (30 Days)</p>
          <p className="text-2xl font-bold text-indigo-600">{analytics?.mttrMinutes || 0} min</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Alert Volume (30 Days)</p>
          <p className="text-2xl font-bold text-gray-900">{analytics?.alertVolume || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Escalated Incidents</p>
          <p className="text-2xl font-bold text-red-600">{analytics?.escalatedIncidents || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Queue Throughput (30 Days)</p>
          <p className="text-2xl font-bold text-green-600">{analytics?.throughput || 0}</p>
        </div>
      </div>

      {renderActiveIncidents()}

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">DLQ Trend (Last 30 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dlqTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(t) => t.split('-')[2]} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} name="DLQ Events" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Worker Availability (Active Workers)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.workerTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(t) => t.split('-')[2]} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="activeWorkers" fill="#6366f1" name="Active Workers" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Incident History Table */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Incident History</h2>
          <div className="flex space-x-2">
            <select 
              value={severityFilter} 
              onChange={e => setSeverityFilter(e.target.value)}
              className="border-gray-300 rounded-md text-sm shadow-sm"
            >
              <option value="">All Severities</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="escalated_critical">Escalated</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alert Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHistory.map(alert => {
                const triggered = new Date(alert.firstTriggeredAt);
                const resolved = new Date(alert.resolvedAt);
                const durationMins = Math.floor((resolved - triggered) / 60000);
                
                return (
                  <tr key={alert._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {alert.alertKey}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        alert.severity === 'escalated_critical' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'critical' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {durationMins}m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      <div>Triggered: {triggered.toLocaleString()}</div>
                      <div>Resolved: {resolved.toLocaleString()}</div>
                    </td>
                  </tr>
                );
              })}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No incident history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
