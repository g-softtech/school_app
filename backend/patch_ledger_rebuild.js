const fs = require('fs');
const file = 'src/services/ledgerService.js';
let content = fs.readFileSync(file, 'utf8');

const rebuildLogic = `
    rebuildBillBalances: async (billId, session) => {
      const StudentBill = require('../models/StudentBill');
      const BillAdjustment = require('../models/BillAdjustment');
      const Payment = require('../models/Payment');

      const bill = await StudentBill.findById(billId).session(session);
      if (!bill) throw new Error('Bill not found');

      // 1. Fetch all applied adjustments
      const adjustments = await BillAdjustment.find({ billId, status: 'applied' }).session(session);
      
      // Compute adjustments per item
      const itemAdjustments = {};
      bill.items.forEach(item => {
        itemAdjustments[item._id] = { discount: 0, penalty: 0 };
      });

      adjustments.forEach(adj => {
        if (!itemAdjustments[adj.itemId]) return;
        if (['discount', 'waiver', 'scholarship'].includes(adj.type)) {
          itemAdjustments[adj.itemId].discount += adj.amount;
        } else if (adj.type === 'penalty') {
          itemAdjustments[adj.itemId].penalty += adj.amount;
        }
      });

      // 2. Recalculate netAmount
      bill.items.forEach(item => {
        const adj = itemAdjustments[item._id];
        item.discount = adj.discount;
        // The netAmount is base amount + penalty - discount
        item.netAmount = Math.max(0, item.amount + adj.penalty - adj.discount);
        
        // If a waiver was applied, or netAmount is 0 due to discount/scholarship, it may be fully subsidized.
        // We'll let the greedy allocation handle 'paid' vs 'unpaid'.
        item.paid = 0;
      });

      // 3. Fetch all valid payments
      const payments = await Payment.find({ billId, status: 'paid' }).session(session);
      let remaining = payments.reduce((s, p) => s + p.amount, 0);

      // 4. Greedily allocate payments
      bill.items.forEach(item => {
        if (remaining <= 0) {
          item.paid = 0;
          return;
        }
        const pay = Math.min(item.netAmount, remaining);
        item.paid = pay;
        remaining = Math.max(0, remaining - pay);
      });

      await bill.save({ session });
      return bill;
    },
`;

content = content.replace(
  /mergeParentWallets: async \(\{ sourceUserId, targetUserId, notes \}\) => \{/,
  rebuildLogic + '\n    mergeParentWallets: async ({ sourceUserId, targetUserId, notes }) => {'
);

fs.writeFileSync(file, content);
console.log("Success");
