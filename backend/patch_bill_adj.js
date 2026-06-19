const fs = require('fs');
const file = 'src/modules/studentBill/studentBill.controller.js';
let content = fs.readFileSync(file, 'utf8');

const applyAdjustmentLogic = `
exports.applyAdjustment = async function(req, res) {
  try {
    const StudentBill = getStudentBill();
    const BillAdjustment = require('../../models/BillAdjustment');
    const ledgerService = require('../../services/ledgerService');

    const { itemId, type, amount, reason } = req.body;
    if (!['discount', 'waiver', 'penalty', 'scholarship'].includes(type)) {
      return bad(res, 400, 'Invalid adjustment type');
    }

    let finalBill;
    await ledgerService.withLedgerSession(async (ledger, dbSession) => {
      const bill = await StudentBill.findById(req.params.id).session(dbSession);
      if (!bill) throw new Error('Bill not found');
      
      const item = bill.items.id(itemId);
      if (!item) throw new Error('Line item not found');

      if (amount <= 0) throw new Error('Amount must be positive');

      // Create event
      await BillAdjustment.create([{
        billId: bill._id,
        itemId,
        type,
        amount,
        reason: reason || 'Manual adjustment',
        approvedBy: req.user._id
      }], { session: dbSession });

      // Rebuild bill
      finalBill = await ledgerService.rebuildBillBalances(bill._id, dbSession);
    });

    return ok(res, { message: type + ' applied', data: finalBill });
  } catch (e) {
    return bad(res, e.message.includes('not found') ? 404 : 400, e.message);
  }
};
`;

content = content.replace(
  /exports\.applyDiscount = async function\(req, res\) \{[\s\S]*?exports\.syncBill = async function\(req, res\) \{/,
  applyAdjustmentLogic + '\n\nexports.syncBill = async function(req, res) {'
);

fs.writeFileSync(file, content);
console.log("Success");
