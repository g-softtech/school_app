const fs = require('fs');
const file = 'src/modules/studentBill/studentBill.controller.js';
let content = fs.readFileSync(file, 'utf8');

const applyAdjustmentLogic = `
exports.applyAdjustment = async function(req, res) {
  try {
    const StudentBill = getStudentBill();
    const BillAdjustment = require('../../models/BillAdjustment');

    const { itemId, type, amount, reason } = req.body;
    if (!['discount', 'waiver', 'penalty', 'scholarship'].includes(type)) {
      return bad(res, 400, 'Invalid adjustment type');
    }

    const bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    
    const item = bill.items.id(itemId);
    if (!item) return bad(res, 404, 'Line item not found');

    if (amount <= 0) return bad(res, 400, 'Amount must be positive');

    // WRITE FIRST: Create event only
    await BillAdjustment.create({
      billId: bill._id,
      itemId,
      type,
      amount,
      reason: reason || 'Manual adjustment',
      approvedBy: req.user._id
    });

    // LATER: Rebuild is deferred to manual admin trigger (syncBill) or async worker
    return ok(res, { message: type + ' logged successfully. Pending rebuild.' });
  } catch (e) {
    return bad(res, e.message.includes('not found') ? 404 : 500, e.message);
  }
};
`;

const syncBillLogic = `
exports.syncBill = async function(req, res) {
  try {
    const ledgerService = require('../../services/ledgerService');
    const StudentBill = getStudentBill();
    
    const bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');

    // Trigger deterministic rebuild projection
    const finalBill = await ledgerService.rebuildBillBalances(bill._id);
    return ok(res, { message: 'Bill reconstructed from events', data: finalBill });
  } catch (e) { return bad(res, 500, e.message); }
};
`;

content = content.replace(
  /exports\.applyAdjustment = async function\(req, res\) \{[\s\S]*?exports\.syncBill = async function\(req, res\) \{[\s\S]*?exports\.deleteBill = async function\(req, res\) \{/,
  applyAdjustmentLogic + '\n\n' + syncBillLogic + '\n\nexports.deleteBill = async function(req, res) {'
);

fs.writeFileSync(file, content);
console.log("Success");
