import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../common/Modal';

const LedgerAuditModal = ({ userId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchAuditChain();
    }
  }, [userId]);

  const fetchAuditChain = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/analytics/ledger/${userId}/audit`);
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load audit chain', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!userId} onClose={onClose} title="Financial Audit Drill-down" size="xl">
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading immutable event stream...</div>
      ) : !data ? (
        <div className="p-8 text-center text-red-500">Failed to load audit data.</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-md flex justify-between items-center border">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider">Current Materialized Balance</p>
              <p className="text-2xl font-bold font-mono">₦{data.currentBalance.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider text-right">Ledger Status</p>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.ledgerStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {data.ledgerStatus}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Immutable Event Stream</h3>
            <div className="bg-white border rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ref / Origin</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.auditChain.map((tx, idx) => (
                    <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tx.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-gray-400">{tx.glReference}</span>
                          <span className="text-sm font-medium text-gray-900">{tx.originDescription}</span>
                          {tx.notes && <span className="text-xs text-gray-500 truncate max-w-xs" title={tx.notes}>{tx.notes}</span>}
                        </div>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.amount > 0 ? '+' : ''}₦{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-900">
                        ₦{tx.balanceAfter.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {data.auditChain.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">No transactions recorded for this wallet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default LedgerAuditModal;
