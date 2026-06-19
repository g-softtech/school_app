const fs = require('fs');
const file = 'src/modules/studentBill/studentBill.controller.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /await BillAdjustment\.create\(\{[\s\S]*?\}\);[\s\S]*?\/\/ LATER:[^\n]+/;

const newLogic = `await BillAdjustment.create({
      billId: bill._id,
      itemId,
      type,
      amount,
      reason: reason || 'Manual adjustment',
      approvedBy: req.user._id
    });

    // BACKGROUND: Trigger deterministic rebuild projection (fire-and-forget)
    const ledgerService = require('../../services/ledgerService');
    ledgerService.rebuildBillBalances(bill._id).catch(err => {
      console.error('[Async Sync Error]', err);
    });

    // RETURN FAST`;

content = content.replace(regex, newLogic);
fs.writeFileSync(file, content);
console.log('Success');
