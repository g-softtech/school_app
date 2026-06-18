const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Payment = require('./src/models/Payment');
const StudentBill = require('./src/models/StudentBill');

async function runAssessment() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/school_db');
    console.log('Connected to DB');

    // 1. Overpayments: Payment Total > Bill Total
    const bills = await StudentBill.find({});
    let overpaymentCount = 0;
    let totalOverpaidAmount = 0;

    for (const bill of bills) {
      const payments = await Payment.find({ studentId: bill.studentId, session: bill.session, term: bill.term, status: 'paid' });
      const actualTotalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      
      if (actualTotalPaid > bill.totalAmount) {
        overpaymentCount++;
        totalOverpaidAmount += (actualTotalPaid - bill.totalAmount);
      }
    }
    console.log(`\n--- OVERPAYMENTS ---`);
    console.log(`Count: ${overpaymentCount}`);
    console.log(`Total Amount Affected: ${totalOverpaidAmount}`);

    // 2. Ghost Balance Impact: Bills with waived items AND existing payments
    let ghostBalanceBillsCount = 0;
    for (const bill of bills) {
      const hasWaivedItem = bill.items.some(i => i.status === 'waived');
      if (hasWaivedItem) {
        const payments = await Payment.find({ studentId: bill.studentId, session: bill.session, term: bill.term, status: 'paid' });
        if (payments.length > 0) {
          ghostBalanceBillsCount++;
        }
      }
    }
    console.log(`\n--- GHOST BALANCE IMPACT ---`);
    console.log(`Estimated Bills Affected: ${ghostBalanceBillsCount}`);

    // 3. Analytics Impact: Payments with generic/default feeType despite covering multiple items
    const allPayments = await Payment.find({ status: 'paid' });
    let genericPaymentsCount = 0;
    let exampleGenericPayments = [];
    
    for (const payment of allPayments) {
      const bill = await StudentBill.findOne({ studentId: payment.studentId, session: payment.session, term: payment.term });
      if (bill) {
        // If a payment amount is greater than the item it is assigned to, it's covering multiple items.
        // Also, if payment is e.g. 50k and bill has 5 items.
        // It's hard to exactly know if it was from parent portal, but let's check if payment amount equals bill.totalAmount
        if (payment.amount === bill.totalAmount && bill.items.length > 1) {
          genericPaymentsCount++;
          if (exampleGenericPayments.length < 3) {
            exampleGenericPayments.push({
              paymentId: payment._id,
              paymentFeeType: payment.feeType,
              paymentAmount: payment.amount,
              billItems: bill.items.map(i => ({ name: i.feeName, type: i.feeType, amount: i.amount }))
            });
          }
        }
      }
    }
    console.log(`\n--- ANALYTICS IMPACT ---`);
    console.log(`Estimated Payments with incorrect feeType (full bill paid as single type): ${genericPaymentsCount}`);
    console.log(`Examples:`, JSON.stringify(exampleGenericPayments, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runAssessment();
