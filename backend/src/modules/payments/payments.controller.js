const Payment      = require('../../models/Payment');
const Student      = require('../../models/Student');
const StudentBill  = require('../../models/StudentBill');
const ApiError     = require('../../utils/ApiError');
const catchAsync   = require('../../utils/catchAsync');
const paginate     = require('../../utils/paginate');
const generateReceiptNumber = require('../../utils/generateReceiptNumber');
const { initializePayment: psInit, verifyPayment: psVerify, verifyWebhookSignature } = require('../../../services/paystackService');

// ── Helper: sync bill after payment ──────────────────────────────────────────
async function syncStudentBill(studentId, session, term) {
  try {
    const bill = await StudentBill.findOne({ studentId, session, term });
    if (!bill) return;
    const payments  = await Payment.find({ studentId, session, term, status: 'paid' });
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    let remaining   = totalPaid;
    bill.items.forEach(item => {
      if (item.status === 'waived') return;
      const pay = Math.min(item.netAmount, remaining);
      item.paid = pay;
      remaining = Math.max(0, remaining - pay);
    });
    await bill.save();
  } catch (e) { console.error('[syncStudentBill]', e.message); }
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

  const payment = await Payment.create({
    studentId, amount: Number(amount), feeType, term, session,
    billId: billId || null, status: 'pending', paymentMethod: 'paystack',
    reference, recordedBy: req.user._id, notes: notes || null,
  });

  const psRes = await psInit(
    student.userId.email, Number(amount) * 100, reference,
    { studentId, paymentId: String(payment._id) }
  );

  if (!psRes.status) {
    await Payment.findByIdAndDelete(payment._id);
    return next(new ApiError(502, 'Paystack initialization failed: ' + (psRes.message || '')));
  }

  res.json({
    success: true, message: 'Payment initialized',
    data: {
      reference, paymentId: payment._id,
      authorizationUrl: psRes.data.authorization_url,
      accessCode:       psRes.data.access_code,
    },
  });
});

// ── Verify Paystack payment ───────────────────────────────────────────────────
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findOne({ reference: req.params.reference });
  if (!payment) return next(new ApiError(404, 'Payment record not found'));
  if (payment.status === 'paid')
    return res.json({ success: true, message: 'Already verified', data: payment });

  const psRes = await psVerify(req.params.reference);
  if (!psRes.status || psRes.data.status !== 'success') {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    return next(new ApiError(402, 'Payment not successful'));
  }

  const receiptNumber = await generateReceiptNumber();
  const updated = await Payment.findByIdAndUpdate(payment._id, {
    status: 'paid', paidAt: new Date(),
    receiptNumber, paystackData: psRes.data,
  }, { new: true });

  await syncStudentBill(payment.studentId, payment.session, payment.term);

  try {
    const notifSvc = require('../../../services/notificationService');
    notifSvc.onPaymentConfirmed(payment.studentId, payment.amount, payment.feeType, payment.term, receiptNumber).catch(() => {});
  } catch {}

  res.json({ success: true, message: 'Payment verified successfully', data: updated });
});

// ── Paystack Webhook ──────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const sig = req.headers['x-paystack-signature'];
    if (!verifyWebhookSignature(JSON.stringify(req.body), sig))
      return res.status(401).json({ message: 'Invalid signature' });

    if (req.body.event === 'charge.success') {
      const payment = await Payment.findOne({ reference: req.body.data.reference });
      if (payment && payment.status !== 'paid') {
        const receiptNumber = await generateReceiptNumber();
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'paid', paidAt: new Date(),
          receiptNumber, paystackData: req.body.data,
        });
        await syncStudentBill(payment.studentId, payment.session, payment.term);
      }
    }
    res.json({ message: 'OK' });
  } catch { res.json({ message: 'OK' }); }
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

  const payment = await Payment.create({
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
  });

  if (!needsApproval) {
    await syncStudentBill(studentId, session, term);
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
  const updated = await Payment.findByIdAndUpdate(req.params.id, {
    status: 'paid', paidAt: new Date(),
    receiptNumber, approvedBy: req.user._id, approvedAt: new Date(),
  }, { new: true })
    .populate({ path: 'studentId', select: 'admissionNumber userId', populate: { path: 'userId', select: 'name' } });

  await syncStudentBill(payment.studentId, payment.session, payment.term);

  try {
    const notifSvc = require('../../../services/notificationService');
    notifSvc.onPaymentConfirmed(payment.studentId, payment.amount, payment.feeType, payment.term, receiptNumber).catch(() => {});
  } catch {}

  res.json({ success: true, message: 'Payment approved', data: updated });
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
