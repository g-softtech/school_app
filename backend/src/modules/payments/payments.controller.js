const Payment      = require('../../models/Payment');
const PaymentIntent= require('../../models/PaymentIntent');
const Student      = require('../../models/Student');
const StudentBill  = require('../../models/StudentBill');
const WebhookEvent = require('../../models/WebhookEvent');
const ApiError     = require('../../utils/ApiError');
const catchAsync   = require('../../utils/catchAsync');
const paginate     = require('../../utils/paginate');
const generateReceiptNumber = require('../../utils/generateReceiptNumber');
const { initializePayment: psInit, verifyPayment: psVerify, verifyWebhookSignature } = require('../../../services/paystackService');
const ledgerService = require('../../services/ledgerService');

// ── Helper: allocate payment to bill ─────────────────────────────────────────
async function allocatePaymentToBill(payment, ledgerServices, dbSession) {
  const bill = await StudentBill.findOne({ 
    studentId: payment.studentId, 
    session: payment.session, 
    term: payment.term 
  }).session(dbSession);

  if (!bill) {
    // If no bill exists, the entire payment is an overpayment!
    if (process.env.ENABLE_CREDIT_LEDGER === 'true') {
      const student = await Student.findById(payment.studentId).session(dbSession);
      if (student && student.parentId) {
        await ledgerServices.addToLedger({
          userId: student.parentId,
          amount: payment.amount,
          sourceEventId: payment._id.toString(),
          sourceEventType: 'payment',
          type: 'overpayment',
          notes: `Overpayment from Cash Receipt ${payment.reference} (No active bill found)`
        });
      }
    }
    return;
  }

  let remaining = payment.amount;

  // 1. Exact Match Priority
  if (payment.feeType && payment.feeType !== 'all') {
    const targetItem = bill.items.find(i => i.feeType === payment.feeType && i.status !== 'waived');
    if (targetItem) {
      const itemBalance = Math.max(0, targetItem.netAmount - targetItem.paid);
      if (itemBalance > 0) {
        const alloc = Math.min(itemBalance, remaining);
        targetItem.paid += alloc;
        remaining -= alloc;
      }
    }
  }

  // 2. Top-to-bottom for any remaining funds
  if (remaining > 0) {
    for (const item of bill.items) {
      if (item.status === 'waived') continue;
      if (remaining <= 0) break;
      const itemBalance = Math.max(0, item.netAmount - item.paid);
      if (itemBalance > 0) {
        const alloc = Math.min(itemBalance, remaining);
        item.paid += alloc;
        remaining -= alloc;
      }
    }
  }

  await bill.save({ session: dbSession });

  // 3. Handle Overpayment
  if (remaining > 0 && process.env.ENABLE_CREDIT_LEDGER === 'true') {
    const student = await Student.findById(payment.studentId).session(dbSession);
    if (student && student.parentId) {
      await ledgerServices.addToLedger({
        userId: student.parentId,
        amount: remaining,
        sourceEventId: payment._id.toString(),
        sourceEventType: 'payment',
        type: 'overpayment',
        notes: `Overpayment from Cash Receipt ${payment.reference}`
      });
    }
  }
}

// ── Initialize Paystack payment ───────────────────────────────────────────────
exports.initializePayment = catchAsync(async (req, res, next) => {
  const { studentId, amount, feeType, term, session, billId, notes } = req.body;
  if (!studentId || !amount || !feeType || !term || !session)
    return next(new ApiError(400, 'studentId, amount, feeType, term and session are required'));

  const student = await Student.findById(studentId).populate('userId', 'name email');
  if (!student) return next(new ApiError(404, 'Student not found'));

  if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id))
    return next(new ApiError(403, 'You can only make payments for your own child'));

  const reference = 'SS-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();

  const splitWalletAmt = req.body.walletAmount ? Number(req.body.walletAmount) : 0;

  const paymentIntent = await PaymentIntent.create({
    userId: req.user._id, studentId, billId: billId || null,
    walletAmount: splitWalletAmt, paystackAmount: Number(amount),
    feeType, term, session, reference, status: 'pending'
  });

  const psRes = await psInit(
    student.userId.email, Number(amount) * 100, reference,
    { studentId, paymentIntentId: String(paymentIntent._id) }
  );

  if (!psRes.status) {
    await PaymentIntent.findByIdAndDelete(paymentIntent._id);
    return next(new ApiError(502, 'Paystack initialization failed: ' + (psRes.message || '')));
  }

  res.json({
    success: true, message: 'Payment initialized',
    data: {
      reference, paymentIntentId: paymentIntent._id,
      authorizationUrl: psRes.data.authorization_url,
      accessCode:       psRes.data.access_code,
    },
  });
});

// ── Verify Paystack payment ───────────────────────────────────────────────────
exports.verifyPayment = catchAsync(async (req, res, next) => {
  let payment = await Payment.findOne({ reference: req.params.reference });
  if (payment && payment.status === 'paid') {
    return res.json({ success: true, message: 'Already verified', data: payment });
  }

  const intent = await PaymentIntent.findOne({ reference: req.params.reference });
  if (!intent) return next(new ApiError(404, 'Payment intent not found'));

  const psRes = await psVerify(req.params.reference);
  if (!psRes.status || psRes.data.status !== 'success') {
    await PaymentIntent.findByIdAndUpdate(intent._id, { status: 'failed' });
    return next(new ApiError(402, 'Payment not successful'));
  }

  const receiptNumber = await generateReceiptNumber();
  let updatedPayment;

  await ledgerService.withLedgerSession(async (ledger, dbSession) => {
    const lockedIntent = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: 'pending' },
      { status: 'completed' },
      { new: true, session: dbSession }
    );

    if (lockedIntent) {
      // 1. Process Wallet Split
      if (lockedIntent.walletAmount > 0) {
        try {
          await ledger.allocateCredit({
            userId: lockedIntent.userId, amount: lockedIntent.walletAmount, relatedBillId: lockedIntent.billId,
            notes: 'Split Wallet Finalization for Paystack Ref ' + lockedIntent.reference
          });
          
          const receiptNumber2 = await generateReceiptNumber();
          const walletPayments = await Payment.create([{
            studentId: lockedIntent.studentId, amount: lockedIntent.walletAmount, feeType: lockedIntent.feeType,
            term: lockedIntent.term, session: lockedIntent.session, billId: lockedIntent.billId,
            status: 'paid', paymentMethod: 'wallet', reference: 'WALLET-SPLIT-' + Date.now() + '-' + Math.random().toString(36).substr(2,4).toUpperCase(),
            receiptNumber: receiptNumber2, paidAt: new Date(), notes: 'Split Wallet Finalization'
          }], { session: dbSession });
          
          await allocatePaymentToBill(walletPayments[0], ledger, dbSession);
        } catch (err) {
          console.error('Wallet split finalization failed:', err.message);
        }
      }

      // 2. Create Paystack Payment
      const paystackPayments = await Payment.create([{
        studentId: lockedIntent.studentId, amount: lockedIntent.paystackAmount, feeType: lockedIntent.feeType,
        term: lockedIntent.term, session: lockedIntent.session, billId: lockedIntent.billId,
        status: 'paid', paymentMethod: 'paystack', reference: lockedIntent.reference,
        receiptNumber, paidAt: new Date(), paystackData: psRes.data
      }], { session: dbSession });

      updatedPayment = paystackPayments[0];
      await allocatePaymentToBill(updatedPayment, ledger, dbSession);
    }
  });

  if (updatedPayment) {
    try {
      const notifSvc = require('../../../services/notificationService');
      notifSvc.onPaymentConfirmed(updatedPayment.studentId, updatedPayment.amount, updatedPayment.feeType, updatedPayment.term, receiptNumber).catch(() => {});
    } catch {}
    res.json({ success: true, message: 'Payment verified successfully', data: updatedPayment });
  } else {
    const latest = await Payment.findOne({ reference: req.params.reference });
    res.json({ success: true, message: 'Payment already verified', data: latest });
  }
});

// ── Paystack Webhook ──────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const sig = req.headers['x-paystack-signature'];
    const payloadString = JSON.stringify(req.body);
    if (!verifyWebhookSignature(payloadString, sig)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const eventId = req.body.event === 'charge.success' ? req.body.data.id : req.body.id;
    if (!eventId) return res.status(200).send('OK');

    let isNewLock = false;
    try {
      await WebhookEvent.create({
        eventId: String(eventId), provider: 'paystack', status: 'processing', eventType: 'charge.success', payload: req.body
      });
      isNewLock = true;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    if (!isNewLock) {
      const lock = await WebhookEvent.findOneAndUpdate(
        { eventId: String(eventId), provider: 'paystack', status: 'failed' },
        { $set: { status: 'processing', errorReason: null } },
        { new: true }
      );
      if (!lock) {
        const current = await WebhookEvent.findOne({ eventId: String(eventId), provider: 'paystack' });
        if (current && current.status === 'processed') return res.status(200).send('OK');
        if (current && current.status === 'processing') return res.status(409).send('Concurrent processing');
      }
    }

    if (req.body.event === 'charge.success') {
      try {
        await ledgerService.withLedgerSession(async (ledger, dbSession) => {
          const intent = await PaymentIntent.findOne({ reference: req.body.data.reference }).session(dbSession);
          if (!intent || intent.status === 'completed') return;

          const lockedIntent = await PaymentIntent.findOneAndUpdate(
            { _id: intent._id, status: 'pending' },
            { status: 'completed' },
            { new: true, session: dbSession }
          );

          if (lockedIntent) {
            if (lockedIntent.walletAmount > 0) {
              try {
                await ledger.allocateCredit({
                  userId: lockedIntent.userId, amount: lockedIntent.walletAmount, relatedBillId: lockedIntent.billId,
                  notes: 'Split Wallet Finalization for Paystack Ref ' + lockedIntent.reference
                });
                
                const receiptNumber2 = await generateReceiptNumber();
                const walletPayments = await Payment.create([{
                  studentId: lockedIntent.studentId, amount: lockedIntent.walletAmount, feeType: lockedIntent.feeType,
                  term: lockedIntent.term, session: lockedIntent.session, billId: lockedIntent.billId,
                  status: 'paid', paymentMethod: 'wallet', reference: 'WALLET-SPLIT-' + Date.now() + '-' + Math.random().toString(36).substr(2,4).toUpperCase(),
                  receiptNumber: receiptNumber2, paidAt: new Date(), notes: 'Split Wallet Finalization'
                }], { session: dbSession });
                
                await allocatePaymentToBill(walletPayments[0], ledger, dbSession);
              } catch (err) {
                console.error('Wallet split finalization failed:', err.message);
              }
            }

            const receiptNumber = await generateReceiptNumber();
            const paystackPayments = await Payment.create([{
              studentId: lockedIntent.studentId, amount: lockedIntent.paystackAmount, feeType: lockedIntent.feeType,
              term: lockedIntent.term, session: lockedIntent.session, billId: lockedIntent.billId,
              status: 'paid', paymentMethod: 'paystack', reference: lockedIntent.reference,
              receiptNumber, paidAt: new Date(), paystackData: req.body.data
            }], { session: dbSession });

            const updatedPayment = paystackPayments[0];
            await allocatePaymentToBill(updatedPayment, ledger, dbSession);

            try {
              const notifSvc = require('../../../services/notificationService');
              notifSvc.onPaymentConfirmed(updatedPayment.studentId, updatedPayment.amount, updatedPayment.feeType, updatedPayment.term, receiptNumber).catch(() => {});
            } catch {}
          }
        });

        await WebhookEvent.updateOne(
          { eventId: String(eventId), provider: 'paystack' },
          { $set: { status: 'processed' } }
        );

      } catch (err) {
        if (err.isDuplicate) {
          await WebhookEvent.updateOne(
            { eventId: String(eventId), provider: 'paystack' },
            { $set: { status: 'processed' } }
          );
          return res.status(200).send('OK');
        }
        
        console.error('[Webhook Processing Error]', err.message);
        await WebhookEvent.updateOne(
          { eventId: String(eventId), provider: 'paystack' },
          { status: 'failed', errorReason: err.message }
        ).catch(() => {});
        return res.status(500).send();
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Webhook Fatal]', err);
    res.status(500).send();
  }
};

// ── Record manual payment ─────────────────────────────────────────────────────
exports.recordManualPayment = catchAsync(async (req, res, next) => {
  const { studentId, amount, feeType, term, session, billId,
          paymentMethod, bankName, accountName, transactionRef, notes } = req.body;

  if (!studentId || !amount || !feeType || !term || !session)
    return next(new ApiError(400, 'studentId, amount, feeType, term and session are required'));

  const student = await Student.findById(studentId);
  if (!student) return next(new ApiError(404, 'Student not found'));

  const method        = paymentMethod || 'cash';
  const needsApproval = method === 'bank_transfer';
  const receiptNumber = needsApproval ? null : await generateReceiptNumber();
  const reference     = (needsApproval ? 'PENDING' : 'MANUAL') + '-' + Date.now();

  let payment;
  await ledgerService.withLedgerSession(async (ledger, dbSession) => {
    payment = await Payment.create([{
      studentId, amount: Number(amount), feeType, term, session,
      billId: billId || null,
      status:           needsApproval ? 'awaiting_approval' : 'paid',
      paymentMethod:    method,
      reference, receiptNumber,
      bankName:       bankName       || null,
      accountName:    accountName    || null,
      transactionRef: transactionRef || null,
      requiresApproval: needsApproval,
      paidAt:         needsApproval ? null : new Date(),
      recordedBy:     req.user._id,
      notes:          notes || null,
    }], { session: dbSession });
    
    payment = payment[0];

    if (!needsApproval) {
      await allocatePaymentToBill(payment, ledger, dbSession);
    }
  });

  if (!needsApproval) {
    try {
      const notifSvc = require('../../../services/notificationService');
      notifSvc.onPaymentConfirmed(studentId, Number(amount), feeType, term, receiptNumber).catch(() => {});
    } catch {}
  }

  const populated = await Payment.findById(payment._id)
    .populate({ path: 'studentId', select: 'admissionNumber userId', populate: { path: 'userId', select: 'name' } })
    .populate('recordedBy', 'name');

  res.status(201).json({
    success: true,
    message: needsApproval
      ? 'Payment submitted for approval'
      : 'Manual payment recorded successfully',
    data: populated,
  });
});

// ── Approve payment ───────────────────────────────────────────────────────────
exports.approvePayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment)                              return next(new ApiError(404, 'Payment not found'));
  if (payment.status !== 'awaiting_approval') return next(new ApiError(400, 'Not awaiting approval'));

  const receiptNumber = await generateReceiptNumber();
  let updatedPayment;

  await ledgerService.withLedgerSession(async (ledger, dbSession) => {
    updatedPayment = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: 'awaiting_approval' },
      {
        status: 'paid', paidAt: new Date(),
        receiptNumber, approvedBy: req.user._id, approvedAt: new Date(),
      },
      { new: true, session: dbSession }
    ).populate({ path: 'studentId', select: 'admissionNumber userId', populate: { path: 'userId', select: 'name' } });

    if (updatedPayment) {
      await allocatePaymentToBill(updatedPayment, ledger, dbSession);
    }
  });

  if (!updatedPayment) {
     return next(new ApiError(400, 'Payment was already processed or no longer awaiting approval'));
  }

  try {
    const notifSvc = require('../../../services/notificationService');
    notifSvc.onPaymentConfirmed(updatedPayment.studentId, updatedPayment.amount, updatedPayment.feeType, updatedPayment.term, receiptNumber).catch(() => {});
  } catch {}

  res.json({ success: true, message: 'Payment approved', data: updatedPayment });
});

// ── Reject payment ────────────────────────────────────────────────────────────
exports.rejectPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment)                              return next(new ApiError(404, 'Payment not found'));
  if (payment.status !== 'awaiting_approval') return next(new ApiError(400, 'Not awaiting approval'));

  const updated = await Payment.findByIdAndUpdate(req.params.id, {
    status: 'failed',
    rejectedReason: req.body.reason || 'Rejected by admin',
    approvedBy: req.user._id, approvedAt: new Date(),
  }, { new: true });

  res.json({ success: true, message: 'Payment rejected', data: updated });
});

// ── Reverse payment ───────────────────────────────────────────────────────────
exports.reversePayment = catchAsync(async (req, res, next) => {
  const paymentId = req.params.id;
  
  let resultPayment;
  await ledgerService.withLedgerSession(async (ledger, dbSession) => {
    const payment = await Payment.findById(paymentId).session(dbSession);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.status !== 'paid') throw new ApiError(400, 'Only paid payments can be reversed');

    // 1. Unallocate from StudentBill
    let unallocateTarget = payment.amount;
    const bill = await StudentBill.findOne({
      studentId: payment.studentId,
      session: payment.session,
      term: payment.term
    }).session(dbSession);

    let ledgerOverpayment = 0;
    if (process.env.ENABLE_CREDIT_LEDGER === 'true') {
      const CreditTransaction = require('../../models/CreditTransaction');
      const overpaymentTx = await CreditTransaction.findOne({
        sourceEventId: payment._id.toString(),
        type: 'overpayment'
      }).session(dbSession);
      if (overpaymentTx) {
        ledgerOverpayment = overpaymentTx.amount;
        unallocateTarget = payment.amount - ledgerOverpayment;
      }
    }

    if (bill && unallocateTarget > 0) {
      // Greedy unallocation bottom-to-top
      for (let i = bill.items.length - 1; i >= 0; i--) {
        const item = bill.items[i];
        if (item.paid > 0) {
          const deduction = Math.min(item.paid, unallocateTarget);
          item.paid -= deduction;
          unallocateTarget -= deduction;
          if (unallocateTarget <= 0) break;
        }
      }
      
      // Safety assertions
      if (unallocateTarget > 0) {
        throw new ApiError(500, 'Invoice-Level Financial Integrity Violation: Unable to fully unallocate payment amount from bill items.');
      }
      for (const item of bill.items) {
        if (item.paid < 0 || item.paid > item.amount) {
          throw new ApiError(500, 'Invoice-Level Financial Integrity Violation: Invalid item.paid computed during reversal.');
        }
      }
      
      await bill.save({ session: dbSession });
    }

    // 2. Reverse Ledger Overpayment
    if (ledgerOverpayment > 0 && process.env.ENABLE_CREDIT_LEDGER === 'true') {
      const student = await Student.findById(payment.studentId).session(dbSession);
      if (student && student.parentId) {
        try {
          await ledger.reversalCorrection({
            userId: student.parentId,
            amount: ledgerOverpayment,
            sourceEventId: payment._id.toString(),
            sourceEventType: 'reversal',
            notes: `Reversal of overpayment for Payment ${payment.reference}`
          });
        } catch (err) {
          if (err.message === 'INSUFFICIENT_FUNDS') {
            throw new ApiError(400, 'Cannot reverse payment because the overpayment credit has already been spent from the wallet.');
          }
          throw err;
        }
      }
    }

    // 3. Mark payment as reversed
    resultPayment = await Payment.findByIdAndUpdate(paymentId, {
      status: 'reversed',
      approvedBy: req.user._id,
      notes: payment.notes ? `${payment.notes} (Reversed by Admin)` : 'Reversed by Admin'
    }, { new: true, session: dbSession });
  });

  res.json({ success: true, message: 'Payment successfully reversed', data: resultPayment });
});

// ── Get all payments (admin) ──────────────────────────────────────────────────
exports.getAllPayments = catchAsync(async (req, res) => {
  const p = paginate(req.query);
  const { status, term, session, feeType, paymentMethod, classId } = req.query;
  const filter = {};

  if (status)        filter.status        = status;
  if (term)          filter.term          = term;
  if (session)       filter.session       = session;
  if (feeType)       filter.feeType       = feeType;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (classId) {
    const students = await Student.find({ classId }, '_id');
    filter.studentId = { $in: students.map(s => s._id) };
  }

  const total    = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate({ path: 'studentId', select: 'admissionNumber userId classId',
      populate: [
        { path: 'userId',  select: 'name' },
        { path: 'classId', select: 'name section' },
      ]})
    .populate('recordedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(p.skip).limit(p.limit);

  const revenue = await Payment.aggregate([
    { $match: { ...filter, status: 'paid' } },
    { $group: { _id: null, totalRevenue: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const pending = await Payment.countDocuments({ status: 'awaiting_approval' });

  res.json({
    success: true,
    totalRevenue:     revenue[0]?.totalRevenue || 0,
    pendingApprovals: pending,
    pagination: { total, page: p.page, pages: Math.ceil(total / p.limit) },
    data: payments,
  });
});

// ── Get student payments ──────────────────────────────────────────────────────
exports.getStudentPayments = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  const student = await Student.findById(studentId);
  if (!student) return next(new ApiError(404, 'Student not found'));

  if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id))
    return next(new ApiError(403, 'Access denied'));
  if (req.user.role === 'student' && String(student.userId) !== String(req.user._id))
    return next(new ApiError(403, 'Access denied'));

  const filter = { studentId };
  if (req.query.term)    filter.term    = req.query.term;
  if (req.query.session) filter.session = req.query.session;
  if (req.query.status)  filter.status  = req.query.status;

  const p        = paginate(req.query);
  const total    = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('recordedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(p.skip).limit(p.limit);

  const agg = await Payment.aggregate([
    { $match: { studentId: student._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    success: true,
    totalAmountPaid: agg[0]?.total || 0,
    pagination: { total, page: p.page, pages: Math.ceil(total / p.limit) },
    data: payments,
  });
});

// ── Get receipt ───────────────────────────────────────────────────────────────
exports.getReceipt = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .populate('recordedBy', 'name')
    .populate('approvedBy', 'name');

  if (!payment) return next(new ApiError(404, 'Payment not found'));
  if (payment.status !== 'paid') return next(new ApiError(400, 'Receipt only for completed payments'));

  if (req.user.role === 'parent') {
    if (String(payment.studentId?.parentId) !== String(req.user._id))
      return next(new ApiError(403, 'Access denied'));
  }
  if (req.user.role === 'student') {
    if (String(payment.studentId?.userId?._id || payment.studentId?.userId) !== String(req.user._id))
      return next(new ApiError(403, 'Access denied'));
  }

  res.json({
    success: true,
    receipt: {
      receiptNumber:   payment.receiptNumber,
      studentName:     payment.studentId?.userId?.name || 'N/A',
      admissionNumber: payment.studentId?.admissionNumber,
      amount:          payment.amount,
      feeType:         payment.feeType,
      term:            payment.term,
      session:         payment.session,
      paymentMethod:   payment.paymentMethod,
      reference:       payment.reference,
      transactionRef:  payment.transactionRef,
      bankName:        payment.bankName,
      paidAt:          payment.paidAt,
      recordedBy:      payment.recordedBy?.name || 'System',
      approvedBy:      payment.approvedBy?.name || null,
      notes:           payment.notes,
    },
  });
});

// ── Analytics ─────────────────────────────────────────────────────────────────
exports.getAnalytics = catchAsync(async (req, res) => {
  const { session, term } = req.query;
  const match = { status: 'paid' };
  if (session) match.session = session;
  if (term)    match.term    = term;

  const [byMethod, byFeeType, byMonth] = await Promise.all([
    Payment.aggregate([{ $match: match }, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Payment.aggregate([{ $match: match }, { $group: { _id: '$feeType',       total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Payment.aggregate([
      { $match: match },
      { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  res.json({ success: true, data: { byMethod, byFeeType, byMonth } });
});

// ── Wallet Balance ───────────────────────────────────────────────────────────
exports.getWalletBalance = catchAsync(async (req, res) => {
  const CreditLedger = require('../../models/CreditLedger');
  const ledger = await CreditLedger.findOne({ userId: req.user._id });
  res.json({ success: true, balance: ledger ? ledger.balance : 0 });
});

// ── Wallet Full Checkout ──────────────────────────────────────────────────────
exports.walletCheckout = catchAsync(async (req, res, next) => {
  const { billId, amount, feeType } = req.body;
  if (!billId || !amount) return next(new ApiError(400, 'billId and amount are required'));

  const bill = await StudentBill.findById(billId);
  if (!bill) return next(new ApiError(404, 'Bill not found'));

  const student = await Student.findById(bill.studentId);
  if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only pay for your own child'));
  }

  let payment;
  await ledgerService.withLedgerSession(async (ledger, dbSession) => {
    // 1. Deduct wallet
    try {
      await ledger.allocateCredit({
        userId: req.user._id,
        amount: Number(amount),
        relatedBillId: billId,
        notes: 'Full Wallet Checkout for bill ' + billId
      });
    } catch (err) {
      if (err.message === 'INSUFFICIENT_FUNDS') throw new ApiError(400, 'Insufficient wallet balance');
      throw err;
    }

    // 2. Create Payment record
    const receiptNumber = await generateReceiptNumber();
    const created = await Payment.create([{
      studentId: student._id, amount: Number(amount), feeType: feeType || 'all',
      term: bill.term, session: bill.session, billId: bill._id,
      status: 'paid', paymentMethod: 'wallet', reference: 'WALLET-' + Date.now(),
      recordedBy: req.user._id, receiptNumber, paidAt: new Date()
    }], { session: dbSession });
    
    payment = created[0];

    // 3. Allocate to bill
    await allocatePaymentToBill(payment, ledger, dbSession);
  });

  if (payment) {
    try {
      const notifSvc = require('../../../services/notificationService');
      notifSvc.onPaymentConfirmed(payment.studentId, payment.amount, payment.feeType, payment.term, payment.receiptNumber).catch(() => {});
    } catch {}
  }

  res.json({ success: true, message: 'Wallet payment successful', data: payment });
});
