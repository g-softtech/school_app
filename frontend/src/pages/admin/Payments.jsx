import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiCreditCard, FiSearch, FiPlus, FiCheck, FiX,
  FiEye, FiDownload, FiFilter, FiRefreshCw,
  FiDollarSign, FiClock, FiCheckCircle, FiAlertCircle,
  FiPrinter, FiEdit2, FiTrash2
} from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageSkeleton from '../../components/common/PageSkeleton';
import Table from '../../components/common/Table';
import api from '../../services/api';
import { getStudents } from '../../services/studentService';
import { getClasses } from '../../services/classService';
import { formatCurrency, formatDateTime, formatDate, getErrorMessage } from '../../utils/helpers';
import { TERMS, SESSIONS } from '../../utils/constants';

const FEE_TYPES = ['tuition','exam','sports','library','development','transport','hostel','pta','uniform','feeding','ict','other'];
const METHODS   = ['cash','bank_transfer','pos','cheque','paystack','scholarship'];

const STATUS_CONFIG = {
  paid:               { label:'Paid',              color:'bg-green-100 text-green-700',  icon: FiCheckCircle  },
  pending:            { label:'Pending',            color:'bg-secondary-100 text-secondary-500', icon: FiClock },
  awaiting_approval:  { label:'Awaiting Approval',  color:'bg-amber-100 text-amber-700',  icon: FiClock        },
  failed:             { label:'Failed',             color:'bg-red-100 text-red-600',      icon: FiAlertCircle  },
  cancelled:          { label:'Cancelled',          color:'bg-secondary-100 text-secondary-400', icon: FiX     },
};

const METHOD_LABELS = {
  cash:'Cash', bank_transfer:'Bank Transfer', pos:'POS',
  cheque:'Cheque', paystack:'Paystack', scholarship:'Scholarship', flutterwave:'Flutterwave',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <cfg.icon size={11} /> {cfg.label}
    </span>
  );
}

const EMPTY_MANUAL = {
  studentId:'', amount:'', feeType:'tuition', term:'first',
  session:'2025/2026', paymentMethod:'cash',
  bankName:'', accountName:'', transactionRef:'', notes:'',
};

export default function AdminPayments() {
  const [payments,    setPayments]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [summary,     setSummary]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [pagination,  setPagination]  = useState({});
  const [page,        setPage]        = useState(1);

  // Filters
  const [filterSession, setFilterSession] = useState('2025/2026');
  const [filterTerm,    setFilterTerm]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterMethod,  setFilterMethod]  = useState('');
  const [filterClass,   setFilterClass]   = useState('');
  const [search,        setSearch]        = useState('');

  // Modals
  const [showManual,  setShowManual]  = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [manualForm,  setManualForm]  = useState(EMPTY_MANUAL);
  const [saving,      setSaving]      = useState(false);
  const [activePayment, setActivePayment] = useState(null);
  const [receipt,       setReceipt]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        session: filterSession || undefined,
        term:    filterTerm   || undefined,
        status:  filterStatus || undefined,
        paymentMethod: filterMethod || undefined,
        classId: filterClass  || undefined,
        page, limit: 20,
      };
      const [pr, cr] = await Promise.all([
        api.get('/payments', { params }),
        getClasses({ limit: 100 }),
      ]);
      setPayments(pr.data.data || []);
      setSummary({ totalRevenue: pr.data.totalRevenue, pendingApprovals: pr.data.pendingApprovals });
      setPagination(pr.data.pagination || {});
      setClasses(cr.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filterSession, filterTerm, filterStatus, filterMethod, filterClass, page]);

  useEffect(() => { load(); }, [load]);

  // Load students when class changes in manual form
  useEffect(() => {
    if (!manualForm.classId) return;
    getStudents({ classId: manualForm.classId, limit: 200 })
      .then(r => setStudents(r.data.data || []))
      .catch(() => {});
  }, [manualForm.classId]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.studentId || !manualForm.amount) {
      toast.error('Student and amount are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/payments/manual', manualForm);
      toast.success('Payment recorded successfully');
      setShowManual(false);
      setManualForm(EMPTY_MANUAL);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await api.patch(`/payments/${activePayment._id}/approve`);
      toast.success('Payment approved and receipt generated');
      setShowApprove(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleReject = async (reason) => {
    try {
      await api.patch(`/payments/${activePayment._id}/reject`, { reason });
      toast.success('Payment rejected');
      setShowApprove(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
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
        body { font-family: Arial, sans-serif; padding: 32px; max-width: 480px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #C9A227; padding-bottom: 12px; margin-bottom: 16px; }
        .logo { font-size: 22px; font-weight: 800; color: #1F2937; }
        .receipt-no { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .badge { display: inline-block; background: #C9A227; color: white; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td { padding: 8px 4px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        td:first-child { color: #6b7280; }
        td:last-child { font-weight: 600; text-align: right; }
        .amount { font-size: 24px; font-weight: 800; color: #15803d; text-align: center; margin: 20px 0; }
        .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        .no-print { text-align:center; margin-bottom: 16px; }
        .btn { padding: 8px 24px; background: #C9A227; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
        @media print { .no-print { display: none; } }
      </style>
    </head><body>
      <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Print Receipt</button></div>
      <div class="header">
        <div class="logo">SmartSchool</div>
        <div class="receipt-no">Official Payment Receipt</div>
      </div>
      <div style="text-align:center; margin-bottom:12px">
        <span class="badge">✓ PAYMENT CONFIRMED</span>
      </div>
      <div class="amount">₦${Number(receipt.amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</div>
      <div className="overflow-x-auto w-full max-w-full"><table>
        <tr><td>Receipt No.</td><td>${receipt.receiptNumber}</td></tr>
        <tr><td>Student</td><td>${receipt.studentName}</td></tr>
        <tr><td>Adm. No.</td><td>${receipt.admissionNumber || '—'}</td></tr>
        <tr><td>Fee Type</td><td style="text-transform:capitalize">${receipt.feeType}</td></tr>
        <tr><td>Term</td><td style="text-transform:capitalize">${receipt.term} Term</td></tr>
        <tr><td>Session</td><td>${receipt.session}</td></tr>
        <tr><td>Method</td><td style="text-transform:capitalize">${(receipt.paymentMethod||'').replace('_',' ')}</td></tr>
        ${receipt.bankName    ? `<tr><td>Bank</td><td>${receipt.bankName}</td></tr>` : ''}
        ${receipt.transactionRef ? `<tr><td>Teller/Ref</td><td>${receipt.transactionRef}</td></tr>` : ''}
        <tr><td>Date Paid</td><td>${receipt.paidAt ? new Date(receipt.paidAt).toLocaleString('en-GB') : '—'}</td></tr>
        ${receipt.recordedBy ? `<tr><td>Recorded By</td><td>${receipt.recordedBy}</td></tr>` : ''}
      </table></div>
      <div class="footer">
        <p>Thank you for your payment. Keep this receipt for your records.</p>
        <p>SmartSchool Management System</p>
      </div>
    </body></html>`);
    w.document.close();
    w.focus();
  };

  const filtered = payments.filter(p => {
    if (!search) return true;
    const name  = p.studentId?.userId?.name?.toLowerCase()       || '';
    const admNo = p.studentId?.admissionNumber?.toLowerCase()     || '';
    const ref   = (p.reference || '').toLowerCase();
    return name.includes(search.toLowerCase()) || admNo.includes(search.toLowerCase()) || ref.includes(search.toLowerCase());
  });

  const pendingApprovals = payments.filter(p => p.status === 'awaiting_approval');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FiCreditCard className="text-primary-500" size={22} /> Payments
          </h1>
          <p className="page-subtitle">Record, verify and manage all school fee payments</p>
        </div>
        <button onClick={() => setShowManual(true)} className="btn-primary flex items-center gap-2">
          <FiPlus size={15} /> Record Payment
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-secondary-500 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalRevenue || 0)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-500 mb-1">Transactions</p>
          <p className="text-xl font-bold text-secondary-800">{pagination.total || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-500 mb-1">Pending Approvals</p>
          <p className={`text-xl font-bold ${summary.pendingApprovals > 0 ? 'text-amber-600' : 'text-secondary-400'}`}>
            {summary.pendingApprovals || 0}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-500 mb-1">Session</p>
          <p className="text-sm font-bold text-secondary-700">{filterSession}</p>
        </div>
      </div>

      {/* Pending approvals alert */}
      {pendingApprovals.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
          <FiClock size={20} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {pendingApprovals.length} payment{pendingApprovals.length !== 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Review bank transfers that need verification</p>
          </div>
          <button onClick={() => setFilterStatus('awaiting_approval')}
            className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-medium">
            View All
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-40">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student, ref…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <select value={filterSession} onChange={e => { setFilterSession(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTerm} onChange={e => { setFilterTerm(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-40">
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-36">
          <option value="">All Methods</option>
          {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Payments Table */}
      <Table
        loading={loading}
        emptyMessage="No payments found"
        columns={[
          { key: 'student', label: 'Student', render: (_, p) => (
              <>
                <p className="font-medium text-secondary-800">{p.studentId?.userId?.name || '—'}</p>
                <p className="text-xs text-secondary-400">{p.studentId?.admissionNumber}</p>
              </>
            )
          },
          { key: 'class', label: 'Class', render: (_, p) => <span className="text-xs text-secondary-500">{p.studentId?.classId?.name} {p.studentId?.classId?.section}</span> },
          { key: 'amount', label: 'Amount', render: (val) => <span className="font-bold text-primary-700">{formatCurrency(val)}</span> },
          { key: 'feeType', label: 'Fee Type', render: (val) => <span className="capitalize text-xs text-secondary-600">{val}</span> },
          { key: 'method', label: 'Method', render: (_, p) => (
              <div className="text-xs text-secondary-600">
                {METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                {p.paymentMethod === 'bank_transfer' && p.bankName && <p className="text-[10px] text-secondary-400">{p.bankName}</p>}
                {p.reference && <p className="text-[10px] text-secondary-400 font-mono">Ref: {p.reference}</p>}
              </div>
            )
          },
          { key: 'date', label: 'Date', render: (_, p) => (
              <span className="text-xs text-secondary-600">
                {formatDate(p.paymentDate || p.createdAt)}
              </span>
            )
          },
          { key: 'status', label: 'Status', render: (val) => {
              const c = STATUS_CONFIG[val] || STATUS_CONFIG.pending;
              return (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${c.color}`}>
                  <c.icon size={10} /> {c.label}
                </span>
              );
            }
          },
          { key: 'actions', label: '', render: (_, p) => (
              <div className="flex items-center gap-1 justify-end">
                {p.status === 'completed' && (
                  <button onClick={() => { setReceipt(p); setTimeout(printReceipt, 100); }} title="Print Receipt" className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500">
                    <FiPrinter size={14} />
                  </button>
                )}
                {p.status === 'awaiting_approval' && (
                  <button onClick={() => { setActivePayment(p); setShowApprove(true); }} title="Review & Approve" className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-600">
                    <FiCheckCircle size={14} />
                  </button>
                )}
              </div>
            )
          }
        ]}
        data={filtered}
      />

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Record Manual Payment Modal */}
      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="Record Manual Payment" size="md">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Class</label>
              <select className="input-field" value={manualForm.classId || ''}
                onChange={e => setManualForm(p => ({ ...p, classId: e.target.value, studentId: '' }))}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Student *</label>
              <select className="input-field" value={manualForm.studentId}
                onChange={e => setManualForm(p => ({ ...p, studentId: e.target.value }))} required>
                <option value="">Select student…</option>
                {students.map(s => <option key={s._id} value={s._id}>{s.userId?.name} ({s.admissionNumber})</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Amount (₦) *</label>
              <input type="number" min="1" className="input-field" value={manualForm.amount}
                onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))} required placeholder="e.g. 45000" />
            </div>
            <div>
              <label className="input-label">Fee Type *</label>
              <select className="input-field" value={manualForm.feeType}
                onChange={e => setManualForm(p => ({ ...p, feeType: e.target.value }))}>
                {FEE_TYPES.map(f => <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Term *</label>
              <select className="input-field" value={manualForm.term}
                onChange={e => setManualForm(p => ({ ...p, term: e.target.value }))}>
                {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Session *</label>
              <select className="input-field" value={manualForm.session}
                onChange={e => setManualForm(p => ({ ...p, session: e.target.value }))}>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="input-label">Payment Method *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {METHODS.filter(m => m !== 'paystack' && m !== 'flutterwave').map(m => (
                  <button key={m} type="button"
                    onClick={() => setManualForm(p => ({ ...p, paymentMethod: m }))}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border-2 transition-all capitalize ${manualForm.paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-secondary-200 text-secondary-600 hover:border-secondary-300'}`}>
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            {(manualForm.paymentMethod === 'bank_transfer' || manualForm.paymentMethod === 'pos') && (
              <>
                <div>
                  <label className="input-label">Bank Name</label>
                  <input className="input-field" value={manualForm.bankName}
                    onChange={e => setManualForm(p => ({ ...p, bankName: e.target.value }))} placeholder="e.g. GTBank" />
                </div>
                <div>
                  <label className="input-label">Teller/Transaction Ref</label>
                  <input className="input-field" value={manualForm.transactionRef}
                    onChange={e => setManualForm(p => ({ ...p, transactionRef: e.target.value }))} placeholder="Reference number" />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="input-label">Notes (optional)</label>
              <input className="input-field" value={manualForm.notes}
                onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes" />
            </div>
          </div>
          {manualForm.paymentMethod === 'bank_transfer' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              ⚠️ Bank transfers require admin approval before the receipt is generated.
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowManual(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 min-w-0 justify-center">
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve/Reject Modal */}
      <Modal isOpen={showApprove} onClose={() => setShowApprove(false)} title="Review Payment" size="md">
        {activePayment && (
          <div className="space-y-4">
            <div className="bg-secondary-50 rounded-xl p-4 space-y-2">
              {[
                ['Student',    activePayment.studentId?.userId?.name],
                ['Adm No',     activePayment.studentId?.admissionNumber],
                ['Amount',     formatCurrency(activePayment.amount)],
                ['Fee Type',   activePayment.feeType],
                ['Method',     METHOD_LABELS[activePayment.paymentMethod]],
                ['Bank',       activePayment.bankName],
                ['Teller Ref', activePayment.transactionRef],
                ['Term',       `${activePayment.term} term`],
                ['Session',    activePayment.session],
                ['Notes',      activePayment.notes],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-secondary-500">{k}</span>
                  <span className="font-medium text-secondary-800 capitalize">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-secondary-500 text-center">
              Verify the bank teller/POS receipt before approving
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleReject('Payment could not be verified')}
                className="btn-danger flex-1 min-w-0 flex items-center justify-center gap-2">
                <FiX size={15} /> Reject
              </button>
              <button onClick={handleApprove} disabled={saving}
                className="btn-primary flex-1 min-w-0 flex items-center justify-center gap-2">
                {saving ? 'Approving…' : <><FiCheck size={15} /> Approve</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => { setShowReceipt(false); setReceipt(null); }} title="Payment Receipt" size="sm">
        {receipt && (
          <div className="space-y-4">
            <div className="text-center py-3">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FiCheckCircle className="text-green-600" size={28} />
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(receipt.amount)}</p>
              <p className="text-xs text-secondary-400 mt-1">Receipt: {receipt.receiptNumber}</p>
            </div>
            <div className="space-y-2 bg-secondary-50 rounded-xl p-4">
              {[
                ['Student',  receipt.studentName],
                ['Fee Type', receipt.feeType],
                ['Method',   (receipt.paymentMethod||'').replace('_',' ')],
                ['Term',     `${receipt.term} Term`],
                ['Session',  receipt.session],
                ['Date',     receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString('en-GB') : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-secondary-500">{k}</span>
                  <span className="font-medium text-secondary-800 capitalize">{v}</span>
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
