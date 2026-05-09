import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiCreditCard, FiDownload, FiExternalLink, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import { getStudentPayments, initializePayment, getReceipt } from '../../services/paymentService';
import { TERMS, SESSIONS, FEE_TYPES } from '../../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

const STATUS_ICON = {
  paid:    { icon: FiCheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  pending: { icon: FiClock,       color: 'text-amber-600', bg: 'bg-amber-100' },
  failed:  { icon: FiAlertCircle, color: 'text-red-500',   bg: 'bg-red-100'   },
};

export default function ParentPayments() {
  const [child, setChild]         = useState(null);
  const [payments, setPayments]   = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [paying, setPaying]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [receipt, setReceipt]     = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [session, setSession]     = useState('2025/2026');
  const [termFilter, setTermFilter] = useState('');

  const [form, setForm] = useState({
    amount: '', feeType: 'tuition', term: 'first', session: '2025/2026', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const childRes = await api.get('/students/my-child');
      const c = childRes.data.data;
      setChild(c);
      const params = { session, limit: 50 };
      if (termFilter) params.term = termFilter;
      const res = await getStudentPayments(c._id, params);
      setPayments(res.data.data || []);
      setTotalPaid(res.data.totalAmountPaid || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setLoading(false); }
  }, [session, termFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async () => {
    if (!child) return;
    if (!form.amount || Number(form.amount) < 1) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      const res = await initializePayment({
        studentId: child._id,
        amount:    Number(form.amount),
        feeType:   form.feeType,
        term:      form.term,
        session:   form.session,
        notes:     form.notes || undefined,
      });
      const { authorizationUrl } = res.data.data;
      toast.success('Redirecting to Paystack…');
      setShowModal(false);
      window.open(authorizationUrl, '_blank');
      // Reload after short delay to pick up webhook-updated status
      setTimeout(load, 5000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setPaying(false); }
  };

  const handleViewReceipt = async (paymentId) => {
    try {
      const res = await getReceipt(paymentId);
      setReceipt(res.data.receipt);
      setShowReceipt(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:500px;margin:40px auto;padding:24px;color:#111;border:1px solid #ddd;border-radius:8px}
        h2{text-align:center;color:#C9A227;margin-bottom:4px}
        .sub{text-align:center;color:#6b7280;font-size:13px;margin-bottom:20px}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
        .label{color:#6b7280}.value{font-weight:600}
        .total{font-size:18px;color:#C9A227;font-weight:bold;text-align:center;margin-top:16px}
        .status{text-align:center;margin:8px 0;font-size:12px;color:#15803d;background:#dcfce7;padding:4px 12px;border-radius:20px;display:inline-block}
      </style></head><body>
      <h2>SmartSchool</h2>
      <p class="sub">Payment Receipt</p>
      <div style="text-align:center;margin-bottom:16px"><span class="status">✓ PAID</span></div>
      <div class="row"><span class="label">Receipt No.</span><span class="value">${receipt.receiptNumber || '—'}</span></div>
      <div class="row"><span class="label">Student</span><span class="value">${receipt.studentName}</span></div>
      <div class="row"><span class="label">Admission No.</span><span class="value">${receipt.admissionNumber}</span></div>
      <div class="row"><span class="label">Fee Type</span><span class="value" style="text-transform:capitalize">${receipt.feeType}</span></div>
      <div class="row"><span class="label">Term</span><span class="value" style="text-transform:capitalize">${receipt.term} Term</span></div>
      <div class="row"><span class="label">Session</span><span class="value">${receipt.session}</span></div>
      <div class="row"><span class="label">Method</span><span class="value" style="text-transform:capitalize">${receipt.paymentMethod}</span></div>
      <div class="row"><span class="label">Reference</span><span class="value">${receipt.reference}</span></div>
      <div class="row"><span class="label">Date Paid</span><span class="value">${new Date(receipt.paidAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
      <p class="total">₦${Number(receipt.amount).toLocaleString('en-NG')}</p>
      ${receipt.notes ? `<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:8px">Note: ${receipt.notes}</p>` : ''}
      </body></html>`);
    win.document.close();
    win.print();
  };

  const paidAmount  = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Fee Payments</h1>
          <p className="page-subtitle">{child ? `Payment history for ${child.userId?.name}` : 'Track school fees'}</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={!child} className="btn-primary flex items-center gap-2">
          <FiCreditCard size={15} /> Make Payment
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={session} onChange={(e) => { setSession(e.target.value); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="input-field py-1.5 text-sm w-36">
          <option value="">All Terms</option>
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center bg-green-50 border border-green-100">
          <p className="text-xs text-green-600 font-medium">Total Paid</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-500">Total Transactions</p>
          <p className="text-2xl font-bold text-secondary-800 mt-1">{payments.length}</p>
        </div>
        <div className={`card text-center ${pendingCount > 0 ? 'bg-amber-50 border border-amber-100' : ''}`}>
          <p className={`text-xs font-medium ${pendingCount > 0 ? 'text-amber-600' : 'text-secondary-500'}`}>Pending</p>
          <p className={`text-2xl font-bold mt-1 ${pendingCount > 0 ? 'text-amber-700' : 'text-secondary-800'}`}>{pendingCount}</p>
        </div>
      </div>

      {/* Payment list */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary-50 rounded-xl animate-pulse" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-14 text-secondary-400">
            <FiCreditCard size={32} className="mx-auto mb-3 opacity-40" />
            <p>No payment records found</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-50">
            {payments.map((p) => {
              const s = STATUS_ICON[p.status] || STATUS_ICON.pending;
              return (
                <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={s.color} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-secondary-800 capitalize">{p.feeType} Fee</p>
                    <p className="text-sm text-secondary-500 capitalize">{p.term} Term · {p.session}</p>
                    {p.receiptNumber && <p className="text-xs text-secondary-400">Receipt: {p.receiptNumber}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-secondary-800">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-secondary-400">{formatDate(p.paidAt || p.createdAt)}</p>
                    <span className={`text-xs font-medium capitalize ${p.status === 'paid' ? 'text-green-600' : p.status === 'pending' ? 'text-amber-600' : 'text-red-500'}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.status === 'paid' && (
                    <button onClick={() => handleViewReceipt(p._id)} className="p-2 hover:bg-secondary-100 rounded-lg transition-colors ml-1" title="View receipt">
                      <FiDownload size={15} className="text-secondary-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Make Payment Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Make Payment" size="md">
        <div className="space-y-4">
          {child && (
            <div className="p-3 bg-secondary-50 rounded-xl text-sm">
              <p className="font-medium text-secondary-800">{child.userId?.name}</p>
              <p className="text-secondary-500 text-xs">{child.admissionNumber}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Fee Type <span className="text-red-500">*</span></label>
              <select value={form.feeType} onChange={(e) => setForm((p) => ({ ...p, feeType: e.target.value }))} className="input-field capitalize">
                {FEE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Amount (₦) <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" min="1" className="input-field" />
            </div>
            <div>
              <label className="input-label">Term <span className="text-red-500">*</span></label>
              <select value={form.term} onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))} className="input-field capitalize">
                {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Session <span className="text-red-500">*</span></label>
              <select value={form.session} onChange={(e) => setForm((p) => ({ ...p, session: e.target.value }))} className="input-field">
                {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Notes (optional)</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g. First instalment" className="input-field" />
          </div>

          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-2">
            <p className="font-medium">ℹ️ Paystack Secure Payment</p>
            <p>You will be redirected to Paystack to complete payment safely.</p>
            <div className="bg-white border border-blue-200 rounded-lg p-2.5 space-y-1">
              <p className="font-semibold text-blue-800">🧪 Test Card Details (sandbox only):</p>
              <p>Card No: <span className="font-mono font-bold">4084 0840 8408 4081</span></p>
              <p>Expiry: <span className="font-mono">any future date</span> &nbsp; CVV: <span className="font-mono">any 3 digits</span></p>
              <p>PIN: <span className="font-mono">0000</span> &nbsp; OTP: <span className="font-mono">123456</span></p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handlePay} disabled={paying} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <FiExternalLink size={14} />
              {paying ? 'Initializing…' : 'Pay with Paystack'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => { setShowReceipt(false); setReceipt(null); }} title="Payment Receipt" size="sm">
        {receipt && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FiCheckCircle className="text-green-600" size={24} />
              </div>
              <p className="font-bold text-secondary-800">Payment Confirmed</p>
              {receipt.receiptNumber && <p className="text-xs text-secondary-400 mt-0.5">Receipt #{receipt.receiptNumber}</p>}
            </div>

            <div className="space-y-2 text-sm">
              {[
                ['Student',    receipt.studentName],
                ['Admission',  receipt.admissionNumber],
                ['Fee Type',   receipt.feeType],
                ['Term',       `${receipt.term} term`],
                ['Session',    receipt.session],
                ['Method',     receipt.paymentMethod],
                ['Reference',  receipt.reference],
                ['Paid At',    receipt.paidAt ? formatDate(receipt.paidAt) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-secondary-100">
                  <span className="text-secondary-500 capitalize">{k}</span>
                  <span className="font-medium text-secondary-800 capitalize">{v}</span>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <span className="font-bold text-secondary-700">Amount</span>
                <span className="font-bold text-green-600 text-lg">{formatCurrency(receipt.amount)}</span>
              </div>
            </div>

            <button onClick={handlePrintReceipt} className="btn-secondary w-full flex items-center justify-center gap-2">
              <FiDownload size={15} /> Print Receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
