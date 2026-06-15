import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch,
  FiDollarSign, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageSkeleton from '../../components/common/PageSkeleton';
import Table from '../../components/common/Table';
import {
  getFeeStructures, createFeeStructure,
  updateFeeStructure, deleteFeeStructure, getFeesSummary,
} from '../../services/feeService';
import { getClasses } from '../../services/classService';
import { formatCurrency, getErrorMessage } from '../../utils/helpers';
import { TERMS, SESSIONS } from '../../utils/constants';

const FEE_TYPES = [
  { value: 'tuition',     label: 'Tuition',         color: 'text-blue-600',    bg: 'bg-blue-50'      },
  { value: 'exam',        label: 'Exam Fee',         color: 'text-purple-600',  bg: 'bg-purple-50'    },
  { value: 'sports',      label: 'Sports',           color: 'text-green-600',   bg: 'bg-green-50'     },
  { value: 'library',     label: 'Library',          color: 'text-amber-600',   bg: 'bg-amber-50'     },
  { value: 'development', label: 'Development Levy', color: 'text-primary-600', bg: 'bg-primary-50'   },
  { value: 'transport',   label: 'Transport',        color: 'text-cyan-600',    bg: 'bg-cyan-50'      },
  { value: 'hostel',      label: 'Hostel',           color: 'text-indigo-600',  bg: 'bg-indigo-50'    },
  { value: 'pta',         label: 'PTA Levy',         color: 'text-orange-600',  bg: 'bg-orange-50'    },
  { value: 'uniform',     label: 'Uniform',          color: 'text-pink-600',    bg: 'bg-pink-50'      },
  { value: 'feeding',     label: 'Feeding',          color: 'text-teal-600',    bg: 'bg-teal-50'      },
  { value: 'ict',         label: 'ICT Levy',         color: 'text-violet-600',  bg: 'bg-violet-50'    },
  { value: 'other',       label: 'Other',            color: 'text-secondary-600', bg: 'bg-secondary-100' },
];

const SCOPES     = [{ value:'all_classes',label:'All Classes'},{ value:'specific_class',label:'Specific Class'},{ value:'specific_student',label:'Specific Student'}];
const FREQUENCIES= [{ value:'per_term',label:'Per Term'},{ value:'per_session',label:'Per Session'},{ value:'one_time',label:'One Time'}];

const EMPTY_FORM = {
  name:'', feeType:'tuition', amount:'', scope:'all_classes',
  classId:'', session:'2025/2026', term:'all',
  frequency:'per_term', allowInstallment:false, minInstallment:'', description:'',
};

function FeeTypeBadge({ type }) {
  const cfg = FEE_TYPES.find(f => f.value === type) || FEE_TYPES[FEE_TYPES.length - 1];
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
}

export default function AdminFeeStructures() {
  const [fees,       setFees]       = useState([]);
  const [classes,    setClasses]    = useState([]);
  const [summary,    setSummary]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [showConfirm,setShowConfirm]= useState(false);
  const [editing,    setEditing]    = useState(null);
  const [deleting,   setDeleting]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [pagination, setPagination] = useState({});
  const [page,       setPage]       = useState(1);
  const [filterSession, setFilterSession] = useState('2025/2026');
  const [filterTerm,    setFilterTerm]    = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterClass,   setFilterClass]   = useState('');
  const [search,        setSearch]        = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fr, sr, cr] = await Promise.all([
        getFeeStructures({ session: filterSession||undefined, term: filterTerm||undefined, feeType: filterType||undefined, classId: filterClass||undefined, page, limit:20 }),
        getFeesSummary({ session: filterSession }),
        getClasses({ limit:100 }),
      ]);
      setFees(fr.data.data || []);
      setPagination(fr.data.pagination || {});
      // summary comes from fr.data.summary (per-type breakdown)
      setSummary(Array.isArray(fr.data.summary) ? fr.data.summary : []);
      setClasses(cr.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filterSession, filterTerm, filterType, filterClass, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = (fee) => {
    setEditing(fee);
    setForm({
      name: fee.name, feeType: fee.feeType, amount: String(fee.amount),
      scope: fee.scope, classId: fee.classId?._id || '',
      session: fee.session, term: fee.term, frequency: fee.frequency,
      allowInstallment: fee.allowInstallment,
      minInstallment: fee.minInstallment ? String(fee.minInstallment) : '',
      description: fee.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.feeType || !form.amount || !form.session) {
      toast.error('Name, fee type, amount and session are required'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), classId: form.classId || null, minInstallment: form.minInstallment ? Number(form.minInstallment) : null };
      if (editing) { await updateFeeStructure(editing._id, payload); toast.success('Fee updated'); }
      else         { await createFeeStructure(payload);               toast.success('Fee created'); }
      setShowModal(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try { await deleteFeeStructure(deleting._id); toast.success('Fee deleted'); setShowConfirm(false); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleToggle = async (fee) => {
    try { await updateFeeStructure(fee._id, { isActive: !fee.isActive }); toast.success(fee.isActive ? 'Deactivated' : 'Activated'); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
  };

  const fc = (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(p => ({ ...p, [e.target.name]: v })); };

  const filtered   = fees.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  // FIX: safe grand total calculation
  const grandTotal = summary.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><FiDollarSign className="text-primary-500" size={22} /> Fee Structures</h1>
          <p className="page-subtitle">Define and manage school fees by class, term and session</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><FiPlus size={16} /> New Fee</button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="card text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-secondary-500 mb-1">Total Configured</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(grandTotal)}</p>
          <p className="text-xs text-secondary-400 mt-0.5">{fees.length} fee items</p>
        </div>
        {summary.slice(0, 3).map(s => (
          <div key={s._id} className="card text-center">
            <p className="text-xs text-secondary-500 mb-1 capitalize">{s._id}</p>
            <p className="text-xl font-bold text-secondary-800">{formatCurrency(Number(s.totalAmount) || 0)}</p>
            <p className="text-xs text-secondary-400">{s.count} item{s.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-40">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fee name…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <select value={filterSession} onChange={e => { setFilterSession(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTerm} onChange={e => { setFilterTerm(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
          <option value="all">Session-wide</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-36">
          <option value="">All Types</option>
          {FEE_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-36">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
      </div>

      {/* Table */}
      {/* Table */}
      <Table
        loading={loading}
        emptyMessage="No fee structures found"
        columns={[
          { key: 'name', label: 'Fee Name', render: (_, fee) => (
              <>
                <p className="font-medium text-secondary-800">{fee.name}</p>
                {fee.description && <p className="text-xs text-secondary-400 truncate max-w-48">{fee.description}</p>}
              </>
            )
          },
          { key: 'feeType', label: 'Type', render: (val) => <FeeTypeBadge type={val} /> },
          { key: 'amount', label: 'Amount', render: (val) => <span className="font-bold text-primary-700">{formatCurrency(val)}</span> },
          { key: 'scope', label: 'Scope', render: (_, fee) => (
              <span className="text-secondary-600 text-xs">
                {fee.scope === 'all_classes'      ? 'All Classes' : null}
                {fee.scope === 'specific_class'   ? `${fee.classId?.name} ${fee.classId?.section||''}` : null}
                {fee.scope === 'specific_student' ? `Student: ${fee.studentId?.admissionNumber}` : null}
              </span>
            )
          },
          { key: 'term', label: 'Term', render: (val) => <span className="text-secondary-600 capitalize text-xs">{val === 'all' ? 'All Terms' : `${val} term`}</span> },
          { key: 'frequency', label: 'Frequency', render: (val) => <span className="text-secondary-600 capitalize text-xs">{(val||'').replace('_',' ')}</span> },
          { key: 'status', label: 'Status', render: (_, fee) => (
              <button onClick={() => handleToggle(fee)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${fee.isActive ? 'text-green-600 bg-green-50' : 'text-secondary-400 bg-secondary-100'}`}>
                {fee.isActive ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                {fee.isActive ? 'Active' : 'Inactive'}
              </button>
            )
          },
          { key: 'actions', label: '', render: (_, fee) => (
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openEdit(fee)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><FiEdit2 size={14} className="text-secondary-500" /></button>
                <button onClick={() => { setDeleting(fee); setShowConfirm(true); }} className="p-1.5 hover:bg-red-50 rounded-lg"><FiTrash2 size={14} className="text-red-400" /></button>
              </div>
            )
          }
        ]}
        data={filtered}
      />

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_,i) => (
            <button key={i} onClick={() => setPage(i+1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i+1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600'}`}>
              {i+1}
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Fee Structure' : 'New Fee Structure'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="input-label">Fee Name *</label>
              <input name="name" value={form.name} onChange={fc} placeholder="e.g. JSS 1 Tuition Fee" className="input-field" required />
            </div>
            <div>
              <label className="input-label">Fee Type *</label>
              <select name="feeType" value={form.feeType} onChange={fc} className="input-field">
                {FEE_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Amount (₦) *</label>
              <input name="amount" type="number" min="0" value={form.amount} onChange={fc} placeholder="e.g. 45000" className="input-field" required />
            </div>
            <div>
              <label className="input-label">Session *</label>
              <select name="session" value={form.session} onChange={fc} className="input-field">
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Term</label>
              <select name="term" value={form.term} onChange={fc} className="input-field">
                <option value="all">All Terms (Session-wide)</option>
                {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Applies To</label>
              <select name="scope" value={form.scope} onChange={fc} className="input-field">
                {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {form.scope === 'specific_class' && (
              <div>
                <label className="input-label">Class *</label>
                <select name="classId" value={form.classId} onChange={fc} className="input-field">
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="input-label">Billing Frequency</label>
              <select name="frequency" value={form.frequency} onChange={fc} className="input-field">
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Description (optional)</label>
              <input name="description" value={form.description} onChange={fc} placeholder="Brief description" className="input-field" />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl border border-secondary-200">
            <input type="checkbox" id="allowInstallment" name="allowInstallment" checked={form.allowInstallment} onChange={fc} className="w-4 h-4 accent-primary-500" />
            <label htmlFor="allowInstallment" className="text-sm font-medium text-secondary-700 cursor-pointer">Allow Installment Payments</label>
          </div>
          {form.allowInstallment && (
            <div>
              <label className="input-label">Minimum Instalment Amount (₦)</label>
              <input name="minInstallment" type="number" min="0" value={form.minInstallment} onChange={fc} placeholder="e.g. 10000" className="input-field" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 min-w-0">{saving ? 'Saving…' : editing ? 'Update Fee' : 'Create Fee'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleDelete} loading={saving}
        title="Delete Fee Structure" message={`Delete "${deleting?.name}"? This cannot be undone.`} />
    </div>
  );
}
