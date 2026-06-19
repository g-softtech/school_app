const fs = require('fs');
const file = 'src/pages/admin/Billing.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(/applyDiscount,\s*waiveItem,/, 'applyAdjustment,');

// Insert State for Adjustment Modal
const stateInsertion = `
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjItem, setAdjItem] = useState(null);
  const [adjForm, setAdjForm] = useState({ type: 'discount', amount: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);
`;
content = content.replace(/(const \[viewBill, setViewBill\] = useState\(null\);)/, '$1' + stateInsertion);

// Insert Handler for applyAdjustment
const handlerInsertion = `
  const handleApplyAdjustment = async (e) => {
    e.preventDefault();
    if (!adjForm.amount || Number(adjForm.amount) <= 0) {
      return toast.error('Enter a valid amount');
    }
    setAdjusting(true);
    try {
      const res = await applyAdjustment(viewBill._id, {
        itemId: adjItem._id,
        type: adjForm.type,
        amount: Number(adjForm.amount),
        reason: adjForm.reason
      });
      toast.success(res.data.message || 'Adjustment saved. Sync pending...');
      setShowAdjModal(false);
      setAdjItem(null);
      setAdjForm({ type: 'discount', amount: '', reason: '' });
      // The backend is running async sync, user can manually click sync bill or refresh to see updates.
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdjusting(false);
    }
  };
`;
content = content.replace(/(const handleDelete = async \(\) => \{)/, handlerInsertion + '\n  $1');

// Update UI: Add Adjust button and Modal
const adjustBtn = `
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-right">
                          <p className="text-sm font-bold text-secondary-800">{formatCurrency(item.netAmount)}</p>
                          <p className={\`text-xs font-medium capitalize \${
                            item.status === 'paid'    ? 'text-green-600'  :
                            item.status === 'partial' ? 'text-amber-600'  :
                            item.status === 'waived'  ? 'text-secondary-400':
                            'text-red-500'
                          }\`}>{item.status}</p>
                        </div>
                        {item.status !== 'waived' && (
                          <button onClick={() => { setAdjItem(item); setShowAdjModal(true); }} className="text-[10px] uppercase font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-2 py-0.5 rounded">Adjust</button>
                        )}
                      </div>
`;
// Replace the old text-right div
content = content.replace(/<div className="text-right flex-shrink-0">[\s\S]*?<\/div>/g, adjustBtn);

// Add Sync Bill button inside the Bill Detail Modal Header
const syncBtn = `
                <div className="flex gap-2 items-center">
                  <button onClick={() => handleSync(viewBill._id)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                    <FiRefreshCw size={12} /> Sync Bill
                  </button>
                  <StatusBadge status={viewBill.status} />
                </div>
`;
content = content.replace(/<StatusBadge status=\{viewBill\.status\} \/>/, syncBtn);


// Add the AdjustmentModal
const adjModal = `
      <Modal isOpen={showAdjModal} onClose={() => setShowAdjModal(false)} title="Apply Adjustment">
        <form onSubmit={handleApplyAdjustment} className="space-y-4">
          <div>
            <label className="input-label">Type *</label>
            <select className="input-field" value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value }))}>
              <option value="discount">Discount (Reduce Price)</option>
              <option value="waiver">Waiver (Forgive Debt)</option>
              <option value="penalty">Penalty (Increase Price)</option>
              <option value="scholarship">Scholarship (Price Subsidy)</option>
            </select>
          </div>
          <div>
            <label className="input-label">Amount *</label>
            <input type="number" min="1" step="any" required className="input-field" value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Reason *</label>
            <textarea required className="input-field" rows="2" value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} placeholder="Mandatory reason for audit log..."></textarea>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAdjModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={adjusting} className="btn-primary">
              {adjusting ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
`;
content = content.replace(/(<ConfirmDialog)/, adjModal + '\n      $1');

fs.writeFileSync(file, content);
console.log('Success');
