import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiCreditCard, FiCheckCircle, FiClock, FiAlertCircle,
  FiDownload, FiEye, FiArrowRight, FiFileText, FiPrinter,
} from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/common/PageSkeleton';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printReceipt } from '../../utils/receiptHelper';
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
  const [selectedItems, setSelectedItems] = useState({});
  const [itemAmounts, setItemAmounts] = useState({});
  const [payAmount, setPayAmount] = useState('');
  const [paying,       setPaying]       = useState(false);
  const [filterSession,setFilterSession]= useState('2025/2026');
  const [filterTerm,   setFilterTerm]   = useState('');
  const [walletBalance, setWalletBalance] = useState(0);

  // New checkout state
  const [useWallet, setUseWallet] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get child profile
      const childRes = await api.get('/students/my-child');
      const childData = childRes.data.data;
      setChild(childData);

      if (childData?._id) {
        const [billRes, payRes, walletRes] = await Promise.all([
          api.get(`/bills/student/${childData._id}`, {
            params: { session: filterSession, term: filterTerm || undefined },
          }),
          api.get(`/payments/student/${childData._id}`, {
            params: { session: filterSession, term: filterTerm || undefined, limit: 50 },
          }),
          api.get('/payments/wallet').catch(() => ({ data: { balance: 0 } }))
        ]);
        setBills(billRes.data.data || []);
        setPayments(payRes.data.data || []);
        setWalletBalance(walletRes.data.balance || 0);
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
    const items = {};
    const amounts = {};
    let initialAmount = 0;
    bill.items?.forEach(item => {
      if (item.status !== 'paid' && item.status !== 'waived') {
        const bal = Math.max(0, item.netAmount - item.paid);
        if (bal > 0) {
          items[item._id] = true;
          amounts[item._id] = bal;
          initialAmount += bal;
        }
      }
    });
    setSelectedItems(items);
    setItemAmounts(amounts);
    setPayAmount(String(initialAmount));
    setUseWallet(false);
    setShowPay(true);
  };

  // Re-calculate payAmount when selectedItems or itemAmounts change
  useEffect(() => {
    if (!selectedBill) return;
    let total = 0;
    selectedBill.items?.forEach(item => {
      if (selectedItems[item._id]) {
        total += Number(itemAmounts[item._id]) || 0;
      }
    });
    setPayAmount(String(total));
  }, [selectedItems, itemAmounts, selectedBill]);

  const handlePayOnline = async () => {
    const totalToPay = Number(payAmount);
    if (!selectedBill || totalToPay <= 0) {
      toast.error('Select at least one item to pay'); return;
    }
    
    setPaying(true);
    try {
      const selectedFeeTypes = selectedBill.items
        ?.filter(i => selectedItems[i._id])
        .map(i => i.feeType);
      
      const feeType = selectedFeeTypes.length === 1 ? selectedFeeTypes[0] : 'multiple';
      
      const allocations = selectedBill.items
        ?.filter(i => selectedItems[i._id])
        .map(i => ({
          itemId: i._id,
          feeType: i.feeType,
          amount: Number(itemAmounts[i._id]) || 0
        }));

      const appliedWallet = (useWallet && walletBalance > 0) ? Math.min(walletBalance, totalToPay) : 0;
      const remainder = totalToPay - appliedWallet;

      // Full wallet checkout
      if (remainder <= 0) {
        await api.post('/payments/wallet-checkout', {
          billId: selectedBill._id,
          amount: appliedWallet,
          feeType,
          allocations
        });
        toast.success('Payment completed using wallet balance!');
        setShowPay(false);
        loadData();
        return;
      }

      // Initialize Paystack with or without wallet split
      const res = await api.post('/payments/initialize', {
        studentId:   child._id,
        amount:      remainder,
        feeType,
        term:        selectedBill.term,
        session:     selectedBill.session,
        billId:      selectedBill._id,
        walletAmount: appliedWallet > 0 ? appliedWallet : undefined,
        allocations
      });

      // Redirect to Paystack
      if (res.data.data?.authorizationUrl) {
        window.location.href = res.data.data.authorizationUrl;
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
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

  const printReceiptAction = () => {
    if (!receipt) return;
    printReceipt(receipt, `Receipt ${receipt.receiptNumber}`);
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
            {/* Itemized Selection */}
            <div>
              <p className="input-label mb-2">Select Items to Pay</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedBill.items?.map(item => {
                  const bal = Math.max(0, item.netAmount - item.paid);
                  const isPaid = item.status === 'paid' || item.status === 'waived' || bal <= 0;
                  const allowInst = item.feeStructureId?.allowInstallment;
                  const minInst = Number(item.feeStructureId?.minInstallment) || 0;
                  return (
                    <div key={item._id} className={`flex flex-col p-2.5 rounded-lg border-2 transition-colors ${
                      isPaid ? 'bg-secondary-50 border-secondary-100 opacity-60' :
                      selectedItems[item._id] ? 'bg-primary-50 border-primary-200' : 'bg-white border-secondary-100'
                    }`}>
                      <div className="flex items-center justify-between cursor-pointer" onClick={(e) => {
                        if (isPaid || e.target.tagName === 'INPUT') return;
                        setSelectedItems(prev => ({ ...prev, [item._id]: !prev[item._id] }));
                      }}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox"
                            disabled={isPaid}
                            checked={!!selectedItems[item._id]}
                            onChange={(e) => {
                              setSelectedItems(prev => ({ ...prev, [item._id]: e.target.checked }));
                            }}
                            className="w-4 h-4 text-primary-600 rounded border-secondary-300"
                          />
                          <div>
                            <p className="font-semibold text-sm text-secondary-800 capitalize">{item.feeName}</p>
                            {isPaid && <p className="text-xs text-secondary-500">{item.status}</p>}
                            {allowInst && !isPaid && <p className="text-[10px] text-primary-600 font-medium bg-primary-100 px-1.5 rounded inline-block mt-0.5">Installments Allowed</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-secondary-800">{formatCurrency(bal)}</p>
                        </div>
                      </div>
                      
                      {!isPaid && selectedItems[item._id] && allowInst && (
                        <div className="mt-2 pt-2 border-t border-primary-100 pl-7 pr-2 flex items-center justify-between">
                          <label className="text-xs font-medium text-secondary-600">Payment Amount:</label>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary-500 text-xs font-bold">₦</span>
                            <input 
                              type="number" 
                              className="w-full pl-6 pr-2 py-1 text-sm border border-secondary-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 font-medium"
                              value={itemAmounts[item._id] || ''}
                              min={minInst}
                              max={bal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemAmounts(prev => ({ ...prev, [item._id]: val }));
                              }}
                              onBlur={(e) => {
                                let val = Number(e.target.value);
                                if (val > bal) val = bal;
                                if (bal > minInst && val > 0 && val < minInst) val = minInst;
                                if (val <= 0) val = minInst > 0 ? Math.min(bal, minInst) : bal;
                                setItemAmounts(prev => ({ ...prev, [item._id]: val }));
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {!isPaid && selectedItems[item._id] && allowInst && Number(itemAmounts[item._id]) < minInst && bal >= minInst && (
                         <p className="text-[10px] text-red-500 mt-1 pl-7">Minimum installment is {formatCurrency(minInst)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Input & Wallet Toggle */}
            <div className="bg-secondary-50 p-3 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-secondary-600">Total Selected</span>
                <span className="text-lg font-bold text-secondary-800">
                  {payAmount ? formatCurrency(Number(payAmount)) : '₦0'}
                </span>
              </div>
              
              {walletBalance > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-secondary-200">
                  <div>
                    <p className="font-semibold text-sm text-secondary-800 flex items-center gap-1">
                      <FiCreditCard size={14} className="text-primary-500" /> Apply Wallet Credit
                    </p>
                    <p className="text-xs text-secondary-500">Available: {formatCurrency(walletBalance)}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} />
                    <div className="w-9 h-5 bg-secondary-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              )}
              
              {useWallet && walletBalance > 0 && (
                <div className="flex justify-between items-center pt-2 text-sm">
                  <span className="text-green-600 font-medium">- Wallet applied</span>
                  <span className="font-bold text-green-600">
                    -{formatCurrency(Math.min(walletBalance, Number(payAmount)))}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center font-bold text-lg pt-2">
              <span>To Pay Now</span>
              <span className="text-primary-700">
                {formatCurrency(Math.max(0, Number(payAmount) - (useWallet ? walletBalance : 0)))}
              </span>
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
            <button onClick={printReceiptAction} className="btn-primary w-full flex items-center justify-center gap-2">
              <FiPrinter /> Print Receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
