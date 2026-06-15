import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiCreditCard, FiCheckCircle, FiClock, FiAlertCircle,
  FiDownload, FiEye, FiArrowRight, FiFileText,
} from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/common/PageSkeleton';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import { formatCurrency, formatDateTime, getErrorMessage } from '../../utils/helpers';
import { TERMS, SESSIONS } from '../../utils/constants';

const STATUS_CONFIG = {
  paid:              { label: 'Paid',             color: 'bg-green-100 text-green-700',  icon: FiCheckCircle },
  pending:           { label: 'Pending',           color: 'bg-secondary-100 text-secondary-500', icon: FiClock },
  awaiting_approval: { label: 'Awaiting Approval', color: 'bg-amber-100 text-amber-700', icon: FiClock },
  failed:            { label: 'Failed',            color: 'bg-red-100 text-red-600',     icon: FiAlertCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <cfg.icon size={11} /> {cfg.label}
    </span>
  );
}

export default function ParentPayments() {
  const { user } = useAuth();
  const [child,      setChild]      = useState(null);
  const [bills,      setBills]      = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [receipt,    setReceipt]    = useState(null);
  const [showReceipt,setShowReceipt]= useState(false);
  const [showPay,    setShowPay]    = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payAmount,    setPayAmount]    = useState('');
  const [paying,       setPaying]       = useState(false);
  const [filterSession,setFilterSession]= useState('2025/2026');
  const [filterTerm,   setFilterTerm]   = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get child profile
      const childRes = await api.get('/students/my-child');
      const childData = childRes.data.data;
      setChild(childData);

      if (childData?._id) {
        const [billRes, payRes] = await Promise.all([
          api.get(`/bills/student/${childData._id}`, {
            params: { session: filterSession, term: filterTerm || undefined },
          }),
          api.get(`/payments/student/${childData._id}`, {
            params: { session: filterSession, term: filterTerm || undefined, limit: 50 },
          }),
        ]);
        setBills(billRes.data.data || []);
        setPayments(payRes.data.data || []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterSession, filterTerm]);

  useEffect(() => { loadData(); }, [loadData]);

  const openPayModal = (bill) => {
    setSelectedBill(bill);
    setPayAmount(String(bill.totalBalance));
    setShowPay(true);
  };

  const handlePayOnline = async () => {
    if (!selectedBill || !payAmount || Number(payAmount) <= 0) {
      toast.error('Enter a valid amount'); return;
    }
    if (Number(payAmount) > selectedBill.totalBalance) {
      toast.error('Amount cannot exceed the outstanding balance'); return;
    }
    setPaying(true);
    try {
      // Get the primary unpaid fee type from the bill
      const firstUnpaidItem = selectedBill.items?.find(i => i.status !== 'paid' && i.status !== 'waived');
      const feeType = firstUnpaidItem?.feeType || 'tuition';

      const res = await api.post('/payments/initialize', {
        studentId:   child._id,
        amount:      Number(payAmount),
        feeType,
        term:        selectedBill.term,
        session:     selectedBill.session,
        billId:      selectedBill._id,
      });

      // Redirect to Paystack
      if (res.data.data?.authorizationUrl) {
        window.location.href = res.data.data.authorizationUrl;
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const openReceipt = async (payment) => {
    try {
      const res = await api.get(`/payments/${payment._id}/receipt`);
      setReceipt(res.data.receipt);
      setShowReceipt(true);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const printReceipt = () => {
    if (!receipt) return;
    const w = window.open('', '_blank', 'width=600,height=700');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt ${receipt.receiptNumber}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;max-width:480px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid #C9A227;padding-bottom:12px;margin-bottom:16px}
        .logo{font-size:22px;font-weight:800;color:#1F2937}
        .amount{font-size:28px;font-weight:800;color:#15803d;text-align:center;margin:20px 0}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        td{padding:8px 4px;border-bottom:1px solid #f3f4f6;font-size:13px}
        td:first-child{color:#6b7280}td:last-child{font-weight:600;text-align:right}
        .badge{display:inline-block;background:#C9A227;color:white;padding:3px 12px;border-radius:20px;font-size:11px}
        .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px}
        .no-print{text-align:center;margin-bottom:16px}
        .btn{padding:8px 24px;background:#C9A227;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px}
        @media print{.no-print{display:none}}
      </style></head><body>
      <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Print</button></div>
      <div class="header"><div class="logo">SmartSchool</div><div style="font-size:12px;color:#6b7280">Official Payment Receipt</div></div>
      <div style="text-align:center;margin-bottom:12px"><span class="badge">✓ PAYMENT CONFIRMED</span></div>
      <div class="amount">₦${Number(receipt.amount).toLocaleString('en-NG',{minimumFractionDigits:2})}</div>
      <div className="overflow-x-auto w-full max-w-full"><table>
        <tr><td>Receipt No.</td><td>${receipt.receiptNumber}</td></tr>
        <tr><td>Student</td><td>${receipt.studentName}</td></tr>
        <tr><td>Fee Type</td><td style="text-transform:capitalize">${receipt.feeType}</td></tr>
        <tr><td>Term</td><td style="text-transform:capitalize">${receipt.term} Term</td></tr>
        <tr><td>Session</td><td>${receipt.session}</td></tr>
        <tr><td>Method</td><td style="text-transform:capitalize">${(receipt.paymentMethod||'').replace('_',' ')}</td></tr>
        <tr><td>Date</td><td>${receipt.paidAt ? new Date(receipt.paidAt).toLocaleString('en-GB') : '—'}</td></tr>
      </table></div>
      <div class="footer"><p>Keep this receipt for your records.</p><p>SmartSchool Management System</p></div>
    </body></html>`);
    w.document.close(); w.focus();
  };

  if (loading) return <PageSkeleton type="dashboard" statCols={3} showCharts={false} />;
  if (!child)  return (
    <div className="card text-center py-16 text-secondary-400">
      <FiCreditCard size={36} className="mx-auto mb-3 opacity-40" />
      <p className="font-medium">No child profile linked</p>
      <p className="text-xs mt-1">Contact admin to link your child's account</p>
    </div>
  );

  const totalBilled  = bills.reduce((s, b) => s + b.totalAmount,  0);
  const totalPaid    = bills.reduce((s, b) => s + b.totalPaid,    0);
  const totalBalance = bills.reduce((s, b) => s + b.totalBalance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiCreditCard className="text-primary-500" size={22} /> Fee Payments
        </h1>
        <p className="page-subtitle">
          {child.userId?.name} · {child.classId?.name} {child.classId?.section} · {child.admissionNumber}
        </p>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center border-2 border-secondary-100">
          <p className="text-xs text-secondary-500 mb-1">Total Billed</p>
          <p className="text-2xl font-bold text-secondary-800">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="card text-center border-2 border-green-100">
          <p className="text-xs text-green-600 mb-1">Amount Paid</p>
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
      </div>

      {/* Bills */}
      {bills.length > 0 && (
        <div className="space-y-3">
          <h2 className="section-title">Fee Invoices</h2>
          {bills.map(bill => (
            <div key={bill._id} className={`card border-2 ${
              bill.status === 'paid'    ? 'border-green-100'    :
              bill.status === 'partial' ? 'border-amber-100'    :
              'border-red-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-secondary-800 capitalize">
                      {bill.term} Term — {bill.session}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      bill.status === 'paid'    ? 'bg-green-100 text-green-700'  :
                      bill.status === 'partial' ? 'bg-amber-100 text-amber-700'  :
                      'bg-red-100 text-red-600'
                    }`}>{bill.status}</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm flex-wrap">
                    <span className="text-secondary-500">Billed: <strong className="text-secondary-800">{formatCurrency(bill.totalAmount)}</strong></span>
                    <span className="text-green-600">Paid: <strong>{formatCurrency(bill.totalPaid)}</strong></span>
                    {bill.totalBalance > 0 && (
                      <span className="text-red-500">Balance: <strong>{formatCurrency(bill.totalBalance)}</strong></span>
                    )}
                  </div>

                  {/* Fee breakdown */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bill.items?.map(item => (
                      <span key={item._id} className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        item.status === 'paid'   ? 'bg-green-50 text-green-600 line-through'  :
                        item.status === 'waived' ? 'bg-secondary-100 text-secondary-400 line-through' :
                        'bg-secondary-100 text-secondary-600'
                      }`}>
                        {item.feeName}: {formatCurrency(item.netAmount)}
                      </span>
                    ))}
                  </div>
                </div>

                {bill.totalBalance > 0 && (
                  <button onClick={() => openPayModal(bill)}
                    className="btn-primary flex items-center gap-2 text-sm flex-shrink-0">
                    <FiCreditCard size={14} /> Pay Now
                    <FiArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
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
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openReceipt(p)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="View receipt">
                        <FiEye size={14} className="text-blue-500" />
                      </button>
                    </div>
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
          <p className="font-medium">No bills or payments yet</p>
          <p className="text-xs mt-1">Bills will appear here once the school generates them</p>
        </div>
      )}

      {/* Pay Now Modal */}
      <Modal isOpen={showPay} onClose={() => setShowPay(false)} title="Make Payment" size="sm">
        {selectedBill && (
          <div className="space-y-4">
            <div className="p-3 bg-secondary-50 rounded-xl">
              <p className="text-xs text-secondary-500">Paying for</p>
              <p className="font-semibold text-secondary-800 capitalize mt-0.5">
                {selectedBill.term} Term — {selectedBill.session}
              </p>
              <p className="text-xs text-red-500 mt-1">
                Outstanding balance: {formatCurrency(selectedBill.totalBalance)}
              </p>
            </div>
            <div>
              <label className="input-label">Amount to Pay (₦)</label>
              <input type="number" min="1" max={selectedBill.totalBalance}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="input-field text-lg font-bold"
                placeholder={String(selectedBill.totalBalance)}
              />
              <p className="text-xs text-secondary-400 mt-1">
                You can pay the full amount or a partial instalment
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1">
              <p className="font-semibold">🔒 Secure Payment via Paystack</p>
              <p>You will be redirected to Paystack to complete your payment securely.</p>
              <p className="font-semibold mt-1">Test Card: 4084 0840 8408 4081 | PIN: 0000 | OTP: 123456</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPay(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
              <button onClick={handlePayOnline} disabled={paying}
                className="btn-primary flex-1 min-w-0 flex items-center justify-center gap-2">
                {paying ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Redirecting…</>
                ) : <><FiCreditCard size={14} /> Pay {payAmount ? formatCurrency(Number(payAmount)) : ''}</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => { setShowReceipt(false); setReceipt(null); }} title="Receipt" size="sm">
        {receipt && (
          <div className="space-y-4">
            <div className="text-center py-3">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FiCheckCircle className="text-green-600" size={28} />
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(receipt.amount)}</p>
              <p className="text-xs text-secondary-400">Receipt: {receipt.receiptNumber}</p>
            </div>
            <div className="space-y-2 bg-secondary-50 rounded-xl p-4">
              {[
                ['Fee Type', receipt.feeType],
                ['Term',     `${receipt.term} Term`],
                ['Session',  receipt.session],
                ['Method',   (receipt.paymentMethod||'').replace('_',' ')],
                ['Date',     receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString('en-GB') : '—'],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-secondary-500">{k}</span>
                  <span className="font-medium capitalize">{v}</span>
                </div>
              ))}
            </div>
            <button onClick={printReceipt} className="btn-primary w-full flex items-center justify-center gap-2">
              <FiDownload size={15} /> Print Receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
