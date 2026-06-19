import React, { useState, useEffect, useCallback } from 'react';
import { FiCreditCard, FiFileText, FiEye, FiDownload } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from "../../utils/helpers";
import { printReceipt } from '../../utils/receiptHelper';
import PageSkeleton from '../../components/common/PageSkeleton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { toast } from 'react-toastify';

const STATUS_CONFIG = {
  unpaid: { color: 'text-red-700 bg-red-100', label: 'Unpaid' },
  partial: { color: 'text-yellow-700 bg-yellow-100', label: 'Partial' },
  paid: { color: 'text-green-700 bg-green-100', label: 'Paid' },
  waived: { color: 'text-blue-700 bg-blue-100', label: 'Waived' }
};

const StatusBadge = ({ status }) => {
  const conf = STATUS_CONFIG[status] || { color: 'text-secondary-700 bg-secondary-100', label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${conf.color}`}>
      {conf.label}
    </span>
  );
};

export default function StudentBilling() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      // Fetch student info
      const studentRes = await api.get('/students/me');
      const studentId = studentRes.data.data?._id;
      if (!studentId) return;

      const [billsRes, paymentsRes] = await Promise.all([
        api.get(`/bills/student/${studentId}`),
        api.get(`/payments/student/${studentId}`)
      ]);
      setBills(billsRes.data?.data || []);
      setPayments(paymentsRes.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const openReceipt = async (payment) => {
    try {
      const res = await api.get(`/payments/${payment._id}/receipt`);
      setReceipt(res.data.receipt);
      setShowReceipt(true);
    } catch (err) {
      toast.error('Failed to load receipt');
    }
  };

  const printReceiptAction = () => {
    if (!receipt) return;
    printReceipt(receipt, `Receipt ${receipt.receiptNumber}`);
  };

  if (loading) return <PageSkeleton type="dashboard" statCols={3} showCharts={false} />;

  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
  const totalPaid = bills.reduce((s, b) => s + b.totalPaid, 0);
  const totalBalance = bills.reduce((s, b) => s + b.totalBalance, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiCreditCard className="text-primary-500" size={22} /> My Billing & Payments
        </h1>
        <p className="page-subtitle">View your outstanding fees and payment history</p>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center border-2 border-secondary-100">
          <p className="text-xs text-secondary-500 mb-1">Total Billed (All Terms)</p>
          <p className="text-2xl font-bold text-secondary-800">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="card text-center border-2 border-green-100">
          <p className="text-xs text-green-600 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className={`card text-center border-2 ${totalBalance > 0 ? 'border-red-100' : 'border-green-100'}`}>
          <p className={`text-xs mb-1 ${totalBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {totalBalance > 0 ? 'Outstanding Balance' : 'All Paid ✓'}
          </p>
          <p className={`text-2xl font-bold ${totalBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      {/* Current Bills */}
      {bills.length > 0 && (
        <div className="space-y-4">
          <h2 className="section-title">My Invoices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bills.map(bill => (
              <div key={bill._id} className="card p-0 overflow-hidden border-2 border-secondary-100 hover:border-primary-200 transition-colors">
                <div className="p-4 bg-secondary-50 border-b border-secondary-100 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-secondary-800 capitalize">{bill.term} Term</h3>
                    <p className="text-xs text-secondary-500">{bill.session} Session</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    {bill.items?.map(item => (
                      <div key={item._id} className="flex justify-between text-sm items-center">
                        <div>
                          <span className="text-secondary-600 capitalize">{item.feeName}</span>
                          {item.discount > 0 && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Discount</span>}
                        </div>
                        <span className="font-semibold text-secondary-800">{formatCurrency(item.netAmount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-secondary-100 flex justify-between items-center bg-secondary-50 p-3 rounded-lg">
                    <span className="font-medium text-secondary-600">Total Balance</span>
                    <span className={`font-bold text-lg ${bill.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(bill.totalBalance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h2 className="section-title">Payment History</h2>
          <Table
            columns={[
              { key: 'date', label: 'Date', render: (_, p) => <span className="text-xs text-secondary-500">{formatDateTime(p.paidAt || p.createdAt)}</span> },
              { key: 'feeType', label: 'Fee Type', render: (val) => <span className="capitalize text-secondary-700">{val}</span> },
              { key: 'amount', label: 'Amount', render: (val) => <span className="font-bold text-primary-700">{formatCurrency(val)}</span> },
              { key: 'method', label: 'Method', render: (_, p) => <span className="text-xs text-secondary-500 capitalize">{(p.paymentMethod||'').replace('_',' ')}</span> },
              { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
              { key: 'actions', label: '', render: (_, p) => (
                  p.status === 'paid' && (
                    <button onClick={() => openReceipt(p)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="View receipt">
                      <FiEye size={14} className="text-blue-500" />
                    </button>
                  )
                )
              }
            ]}
            data={payments}
          />
        </div>
      )}

      {bills.length === 0 && payments.length === 0 && (
        <div className="card text-center py-16 text-secondary-400">
          <FiFileText size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No billing records found</p>
          <p className="text-xs mt-1">Your invoices will appear here once generated</p>
        </div>
      )}

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Payment Receipt" size="sm">
        {receipt && (
          <div className="space-y-6">
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="mx-auto w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <FiEye className="text-green-600" size={20} />
              </div>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(receipt.amount)}</p>
              <p className="text-xs text-green-600 font-medium mt-1">Payment Successful</p>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-secondary-100">
                <span className="text-secondary-500">Receipt No.</span>
                <span className="font-medium text-secondary-800">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-secondary-100">
                <span className="text-secondary-500">Fee Type</span>
                <span className="font-medium text-secondary-800 capitalize">{receipt.feeType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-secondary-100">
                <span className="text-secondary-500">Term/Session</span>
                <span className="font-medium text-secondary-800 capitalize">{receipt.term} Term, {receipt.session}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-secondary-100">
                <span className="text-secondary-500">Date Paid</span>
                <span className="font-medium text-secondary-800">{formatDateTime(receipt.paidAt)}</span>
              </div>
            </div>
            
            <button onClick={printReceiptAction} className="btn-primary w-full flex items-center justify-center gap-2">
              <FiDownload size={15} /> Print/Download Receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
