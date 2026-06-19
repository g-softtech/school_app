import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LedgerAuditModal from '../../components/admin/LedgerAuditModal';

const FinancialObservability = () => {
  const [healthStats, setHealthStats] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [scanJob, setScanJob] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [auditUserId, setAuditUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    let interval;
    if (scanJob && ['pending', 'processing'].includes(scanJob.status)) {
      interval = setInterval(pollScanStatus, 2000);
    }
    return () => clearInterval(interval);
  }, [scanJob]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [healthRes, heatmapRes, syncRes] = await Promise.all([
        api.get('/analytics/financial-health'),
        api.get('/analytics/revenue-heatmap'),
        api.get('/analytics/sync-status')
      ]);
      setHealthStats(healthRes.data.data);
      setHeatmap(heatmapRes.data.data);
      setSyncStatus(syncRes.data.data);
    } catch (err) {
      console.error('Error fetching financial data', err);
    } finally {
      setLoading(false);
    }
  };

  const startIntegrityScan = async () => {
    try {
      const res = await api.post('/analytics/integrity/scan');
      setScanJob({ _id: res.data.data.scanJobId, status: 'pending', progress: {} });
    } catch (err) {
      console.error('Failed to start scan', err);
    }
  };

  const pollScanStatus = async () => {
    if (!scanJob) return;
    try {
      const res = await api.get(`/analytics/integrity/scan/${scanJob._id}`);
      setScanJob(res.data.data);
    } catch (err) {
      console.error('Error polling scan status', err);
    }
  };

  const triggerRebuild = async (userId) => {
    if (!window.confirm("Are you sure you want to rebuild this ledger? This will lock the wallet during reconstruction.")) return;
    try {
      await api.post('/analytics/integrity/rebuild', { userId });
      alert('Ledger successfully rebuilt.');
      pollScanStatus(); // Refresh scan anomalies
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to rebuild ledger');
    }
  };

  if (loading) return <DashboardLayout title="Financial Observability"><div className="p-6">Loading observability data...</div></DashboardLayout>;

  return (
    <DashboardLayout title="Financial Observability">
      <div className="p-6 space-y-8">
        
        {/* System Health Widget */}
        <section>
          <h2 className="text-xl font-bold mb-4">System Health</h2>
          {healthStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                <p className="text-gray-500 text-sm">Total Wallet Liability</p>
                <p className="text-2xl font-bold">₦{healthStats.totalLiability.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
                <p className="text-gray-500 text-sm">Active Wallets</p>
                <p className="text-2xl font-bold">{healthStats.activeWallets}</p>
              </div>
              <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
                <p className="text-gray-500 text-sm">Frozen/Closed</p>
                <p className="text-2xl font-bold">{healthStats.frozenWallets + healthStats.closedWallets}</p>
              </div>
              <div className="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                <p className="text-gray-500 text-sm">Rebuilding Locks</p>
                <p className="text-2xl font-bold">{healthStats.rebuildingWallets}</p>
              </div>
            </div>
          ) : (
            <p>No health data available.</p>
          )}
        </section>

        {/* Revenue Heatmap */}
        <section>
          <h2 className="text-xl font-bold mb-4">Revenue Heatmap (Collected Cash)</h2>
          <div className="bg-white shadow rounded overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Collected</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {heatmap.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap">{item.term}</td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">{item.feeType}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">
                      ₦{item.totalCollected.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {heatmap.length === 0 && (
                  <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No revenue data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sync Pipeline Health Widget */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Projection Sync Pipeline</h2>
            <button onClick={fetchInitialData} className="text-sm text-indigo-600 hover:text-indigo-900 border border-indigo-600 rounded px-3 py-1">Refresh</button>
          </div>
          {syncStatus ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded shadow border-l-4 border-gray-400">
                  <p className="text-gray-500 text-sm">Pending Jobs (ZSET)</p>
                  <p className="text-2xl font-bold">{syncStatus.pendingCount}</p>
                </div>
                <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                  <p className="text-gray-500 text-sm">Processing Jobs</p>
                  <p className="text-2xl font-bold">{syncStatus.processing.length}</p>
                </div>
                <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
                  <p className="text-gray-500 text-sm">Dead-Lettered (DLQ)</p>
                  <p className="text-2xl font-bold text-red-600">{syncStatus.deadletter.length}</p>
                </div>
                <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
                  <p className="text-gray-500 text-sm">Archived DLQ (Superseded)</p>
                  <p className="text-2xl font-bold">{syncStatus.deadletterArchive}</p>
                </div>
              </div>

              {syncStatus.processing.length > 0 && (
                <div className="bg-white shadow rounded overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50"><h3 className="font-bold text-sm">Currently Processing (Active Locks)</h3></div>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">Bill ID</th>
                        <th className="px-4 py-2 text-left">Worker ID</th>
                        <th className="px-4 py-2 text-left">Lock Expires In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncStatus.processing.map((job, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-mono">{job.billId}</td>
                          <td className="px-4 py-2 font-mono text-xs">{job.workerId}</td>
                          <td className="px-4 py-2">{job.expiresIn}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {syncStatus.deadletter.length > 0 && (
                <div className="bg-red-50 shadow rounded overflow-hidden border border-red-200">
                  <div className="px-4 py-3 border-b border-red-200 bg-red-100"><h3 className="font-bold text-sm text-red-800">Dead-Letter Queue (Action Required)</h3></div>
                  <table className="min-w-full divide-y divide-red-200 text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-red-800">Bill ID</th>
                        <th className="px-4 py-2 text-left text-red-800">Failed At</th>
                        <th className="px-4 py-2 text-left text-red-800">Last Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncStatus.deadletter.map((job, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-mono text-red-900">{job.billId}</td>
                          <td className="px-4 py-2 text-red-900">{new Date(job.failedAt).toLocaleString()}</td>
                          <td className="px-4 py-2 text-red-900 font-medium">{job.lastError}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p>Loading sync status...</p>
          )}
        </section>

        {/* Integrity Scanner Module */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Reconciliation Scanner</h2>
            <button 
              onClick={startIntegrityScan}
              disabled={scanJob && ['pending', 'processing'].includes(scanJob.status)}
              className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {scanJob && ['pending', 'processing'].includes(scanJob.status) ? 'Scanning...' : 'Run Full Integrity Scan'}
            </button>
          </div>

          {scanJob && (
            <div className="bg-white p-6 rounded shadow border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <span className="font-medium text-gray-700">Status: <span className="uppercase text-sm">{scanJob.status}</span></span>
                {scanJob.progress && scanJob.progress.totalExpected > 0 && (
                  <span className="text-sm text-gray-500">
                    {scanJob.progress.processedCount} / {scanJob.progress.totalExpected} ledgers scanned
                  </span>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${scanJob.progress?.totalExpected ? (scanJob.progress.processedCount / scanJob.progress.totalExpected) * 100 : 0}%` }}
                ></div>
              </div>

              {/* Anomalies List */}
              {scanJob.anomaliesFound > 0 ? (
                <div>
                  <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {scanJob.anomaliesFound} Anomalies Detected
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Drift</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scanJob.anomalies.map((anom, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 whitespace-nowrap">{anom.userId?.name || anom.userId}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-green-600 font-medium">₦{anom.calculatedBalance.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-red-600 font-medium">₦{anom.currentBalance.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-bold text-red-500">₦{anom.driftAmount.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${anom.driftLevel === 'critical' ? 'bg-red-100 text-red-800' : anom.driftLevel === 'moderate' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {anom.driftLevel}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                              <button onClick={() => setAuditUserId(anom.userId._id || anom.userId)} className="text-indigo-600 hover:text-indigo-900">Audit</button>
                              <button onClick={() => triggerRebuild(anom.userId._id || anom.userId)} className="text-red-600 hover:text-red-900">Rebuild</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : scanJob.status === 'completed' && scanJob.anomaliesFound === 0 ? (
                <div className="text-green-600 font-medium flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  System Integrity 100% Perfect. No mathematical drift detected.
                </div>
              ) : null}
              {scanJob.status === 'failed' && (
                <div className="text-red-600 mt-2 text-sm">Scan failed: {scanJob.errorReason}</div>
              )}
            </div>
          )}
        </section>

        {auditUserId && (
          <LedgerAuditModal userId={auditUserId} onClose={() => setAuditUserId(null)} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FinancialObservability;
