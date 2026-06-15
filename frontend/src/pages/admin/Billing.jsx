import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiFileText, FiSearch, FiRefreshCw, FiAlertCircle,
  FiCheckCircle, FiClock, FiZap, FiEye, FiTrash2,
  FiPercent, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageSkeleton from '../../components/common/PageSkeleton';
import Table from '../../components/common/Table';
import {
  getAllBills, generateBills, getDefaulters,
  syncBill, applyDiscount, waiveItem, deleteBill,
} from '../../services/feeService';
import { getClasses } from '../../services/classService';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { TERMS, SESSIONS } from '../../utils/constants';

const STATUS_CONFIG = {
  paid:     { label: 'Paid',     variant: 'success', icon: FiCheckCircle, color: 'text-green-600'  },
  partial:  { label: 'Partial',  variant: 'warning', icon: FiClock,       color: 'text-amber-600'  },
  unpaid:   { label: 'Unpaid',   variant: 'danger',  icon: FiAlertCircle, color: 'text-red-500'    },
  overpaid: { label: 'Overpaid', variant: 'info',    icon: FiCheckCircle, color: 'text-blue-600'   },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full capitalize
      ${status === 'paid'    ? 'bg-green-100 text-green-700'  : ''}
      ${status === 'partial' ? 'bg-amber-100 text-amber-700'  : ''}
      ${status === 'unpaid'  ? 'bg-red-100   text-red-600'    : ''}
      ${status === 'overpaid'? 'bg-blue-100  text-blue-700'   : ''}
    `}>
      <cfg.icon size={11} /> {cfg.label}
    </span>
  );
}

export default function AdminBilling() {
  const [bills,      setBills]      = useState([]);
  const [classes,    setClasses]    = useState([]);
  const [summary,    setSummary]    = useState({});
  const [defaulters, setDefaulters] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('bills'); // bills | defaulters
  const [pagination, setPagination] = useState({});
  const [page,       setPage]       = useState(1);
  const [saving,     setSaving]     = useState(false);

  // Filters
  const [filterSession, setFilterSession] = useState('2025/2026');
  const [filterTerm,    setFilterTerm]    = useState('first');
  const [filterClass,   setFilterClass]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [search,        setSearch]        = useState('');

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm,      setGenForm]      = useState({ classId: '', session: '2025/2026', term: 'first' });
  const [generating,   setGenerating]   = useState(false);

  // Bill detail modal
  const [viewBill,   setViewBill]   = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  // Delete confirm
  const [deleting,     setDeleting]     = useState(null);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        session:  filterSession || undefined,
        term:     filterTerm    || undefined,
        classId:  filterClass   || undefined,
        status:   filterStatus  || undefined,
        page, limit: 20,
      };
      const [br, cr] = await Promise.all([
        getAllBills(params),
        getClasses({ limit: 100 }),
      ]);
      setBills(br.data.data || []);
      setSummary(br.data.summary || {});
      setPagination(br.data.pagination || {});
      setClasses(cr.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filterSession, filterTerm, filterClass, filterStatus, page]);

  const loadDefaulters = useCallback(async () => {
    try {
      const res = await getDefaulters({
        session: filterSession, term: filterTerm,
        classId: filterClass || undefined,
      });
      setDefaulters(res.data.data || []);
    } catch {}
  }, [filterSession, filterTerm, filterClass]);

  useEffect(() => {
    load();
    loadDefaulters();
  }, [load, loadDefaulters]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.classId) { toast.error('Select a class'); return; }
    setGenerating(true);
    try {
      const res = await generateBills(genForm);
      toast.success(res.data.message);
      setShowGenerate(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setGenerating(false); }
  };

  const handleSync = async (billId) => {
    try {
      await syncBill(billId);
      toast.success('Bill synced');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteBill(deleting._id);
      toast.success('Bill deleted');
      setShowConfirm(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const filtered = bills.filter(b => {
    if (!search) return true;
    const name  = b.studentId?.userId?.name?.toLowerCase() || '';
    const admNo = b.studentId?.admissionNumber?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || admNo.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FiFileText className="text-primary-500" size={22} /> Student Billing
          </h1>
          <p className="page-subtitle">Manage student invoices, balances and payment tracking</p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary flex items-center gap-2">
          <FiZap size={15} /> Generate Bills
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Billed',  value: formatCurrency(summary.totalBilled  || 0), color: 'text-secondary-800' },
          { label: 'Total Paid',    value: formatCurrency(summary.totalPaid    || 0), color: 'text-green-600'     },
          { label: 'Outstanding',   value: formatCurrency(summary.totalBalance || 0), color: 'text-red-500'       },
          { label: 'Collection %',  value: summary.totalBilled > 0
              ? `${Math.round((summary.totalPaid / summary.totalBilled) * 100)}%`
              : '0%',                                                                  color: 'text-primary-600'   },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-xs text-secondary-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
        {[
          { id: 'bills',      label: `All Bills (${pagination.total || 0})` },
          { id: 'defaulters', label: `Defaulters (${defaulters.length})`    },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-40">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <select value={filterSession} onChange={e => { setFilterSession(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTerm} onChange={e => { setFilterTerm(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-36">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        {tab === 'bills' && (
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
            <option value="">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Bills Table */}
      {tab === 'bills' && (
        <Table
          loading={loading}
          emptyMessage="No bills found. Click 'Generate Bills' to create bills for a class."
          columns={[
            { key: 'studentId', label: 'Student', render: (val) => <span className="font-medium text-secondary-800">{val?.userId?.name || '—'}</span> },
            { key: 'admNo', label: 'Adm No', render: (_, b) => <span className="text-xs text-secondary-500">{b.studentId?.admissionNumber || '—'}</span> },
            { key: 'classId', label: 'Class', render: (val) => <span className="text-secondary-600 text-xs">{val?.name} {val?.section}</span> },
            { key: 'totalAmount', label: 'Total', render: (val) => <span className="font-semibold text-secondary-800">{formatCurrency(val)}</span> },
            { key: 'totalPaid', label: 'Paid', render: (val) => <span className="font-semibold text-green-600">{formatCurrency(val)}</span> },
            { key: 'totalBalance', label: 'Balance', render: (val) => <span className="font-bold text-red-500">{formatCurrency(val)}</span> },
            { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
            { key: 'actions', label: '', render: (_, bill) => (
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => { setViewBill(bill); setShowDetail(true); }}
                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="View details">
                    <FiEye size={14} className="text-blue-500" />
                  </button>
                  <button onClick={() => handleSync(bill._id)}
                    className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors" title="Sync payments">
                    <FiRefreshCw size={14} className="text-secondary-500" />
                  </button>
                  <button onClick={() => { setDeleting(bill); setShowConfirm(true); }}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <FiTrash2 size={14} className="text-red-400" />
                  </button>
                </div>
              )
            }
          ]}
          data={filtered}
        />
      )}

      {/* Defaulters Table */}
      {tab === 'defaulters' && (
        <Table
          emptyMessage="No defaulters found. All students are up to date with payments."
          columns={[
            { key: 'index', label: '#', render: (_, b, i) => <span className="text-secondary-400 text-xs">{i + 1}</span> },
            { key: 'studentId', label: 'Student', render: (val) => <span className="font-medium text-secondary-800">{val?.userId?.name || '—'}</span> },
            { key: 'admNo', label: 'Adm No', render: (_, b) => <span className="text-xs text-secondary-500">{b.studentId?.admissionNumber || '—'}</span> },
            { key: 'classId', label: 'Class', render: (val) => <span className="text-secondary-600 text-xs">{val?.name} {val?.section}</span> },
            { key: 'totalAmount', label: 'Total', render: (val) => <span className="font-semibold text-secondary-800">{formatCurrency(val)}</span> },
            { key: 'totalPaid', label: 'Paid', render: (val) => <span className="font-semibold text-green-600">{formatCurrency(val)}</span> },
            { key: 'totalBalance', label: 'Outstanding', render: (val) => <span className="font-bold text-red-500">{formatCurrency(val)}</span> },
            { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
          ]}
          data={defaulters}
        />
      )}

      {/* Pagination */}
      {tab === 'bills' && pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Generate Bills Modal */}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Bills for Class">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
            <FiAlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>This creates bills for ALL active students in the selected class based on configured fee structures. Existing paid items will not be overwritten.</p>
          </div>
          <div>
            <label className="input-label">Class *</label>
            <select className="input-field" value={genForm.classId}
              onChange={e => setGenForm(p => ({ ...p, classId: e.target.value }))} required>
              <option value="">Select class…</option>
              {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Term *</label>
              <select className="input-field" value={genForm.term}
                onChange={e => setGenForm(p => ({ ...p, term: e.target.value }))}>
                {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Session *</label>
              <select className="input-field" value={genForm.session}
                onChange={e => setGenForm(p => ({ ...p, session: e.target.value }))}>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowGenerate(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button type="submit" disabled={generating} className="btn-primary flex-1 min-w-0 justify-center">
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating…
                </span>
              ) : <><FiZap size={14} /> Generate Bills</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bill Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setViewBill(null); }}
        title="Bill Details" size="lg">
        {viewBill && (
          <div className="space-y-4">
            {/* Student info */}
            <div className="flex items-center justify-between p-3 bg-secondary-50 rounded-xl">
              <div>
                <p className="font-semibold text-secondary-800">{viewBill.studentId?.userId?.name || '—'}</p>
                <p className="text-xs text-secondary-400">{viewBill.studentId?.admissionNumber} · {viewBill.classId?.name} {viewBill.classId?.section}</p>
                <p className="text-xs text-secondary-400 capitalize">{viewBill.term} Term · {viewBill.session}</p>
              </div>
              <StatusBadge status={viewBill.status} />
            </div>

            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="text-center p-3 bg-secondary-50 rounded-xl">
                <p className="text-xs text-secondary-500">Total</p>
                <p className="font-bold text-secondary-800">{formatCurrency(viewBill.totalAmount)}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-xs text-green-600">Paid</p>
                <p className="font-bold text-green-700">{formatCurrency(viewBill.totalPaid)}</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-xs text-red-500">Balance</p>
                <p className="font-bold text-red-600">{formatCurrency(viewBill.totalBalance)}</p>
              </div>
            </div>

            {/* Line items */}
            <div>
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Fee Breakdown</p>
              <div className="space-y-1.5">
                {viewBill.items?.map(item => (
                  <div key={item._id} className={`flex items-center justify-between p-3 rounded-xl border ${
                    item.status === 'paid'   ? 'bg-green-50  border-green-100'  :
                    item.status === 'waived' ? 'bg-secondary-50 border-secondary-200 opacity-60' :
                    item.status === 'partial'? 'bg-amber-50  border-amber-100'  :
                    'bg-white border-secondary-200'
                  }`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-secondary-800 capitalize">{item.feeName}</p>
                      <p className="text-xs text-secondary-400 capitalize">{item.feeType}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-secondary-800">{formatCurrency(item.netAmount)}</p>
                      <p className={`text-xs font-medium capitalize ${
                        item.status === 'paid'    ? 'text-green-600'  :
                        item.status === 'partial' ? 'text-amber-600'  :
                        item.status === 'waived'  ? 'text-secondary-400':
                        'text-red-500'
                      }`}>{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {viewBill.carryOver > 0 && (
              <div className="flex justify-between p-3 bg-amber-50 rounded-xl text-sm border border-amber-100">
                <span className="text-amber-700 font-medium">Carry-over from previous term</span>
                <span className="font-bold text-amber-700">{formatCurrency(viewBill.carryOver)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete} loading={saving}
        title="Delete Bill"
        message={`Delete bill for ${deleting?.studentId?.userId?.name}? Only bills with no payments can be deleted.`}
      />
    </div>
  );
}
