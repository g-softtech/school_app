const Payment  = require('../../models/Payment');
const notifSvc         = require('../../../services/notificationService');
const Student  = require('../../models/Student');
const User     = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const paginate   = require('../../utils/paginate');
const generateReceiptNumber = require('../../utils/generateReceiptNumber');
const { initializePayment, verifyPayment, verifyWebhookSignature } = require('../../../services/paystackService');

// ─── Initialize Paystack payment ──────────────────────────────────────────────
// POST /api/payments/initialize
// Admin, Parent
exports.initializePayment = catchAsync(async function(req, res, next) {
  var studentId = req.body.studentId;
  var amount    = Number(req.body.amount);
  var feeType   = req.body.feeType;
  var term      = req.body.term;
  var session   = req.body.session;
  var notes     = req.body.notes;

  if (!studentId || !amount || !feeType || !term || !session) {
    return next(new ApiError(400, 'Please provide studentId, amount, feeType, term and session'));
  }

  var student = await Student.findById(studentId).populate('userId', 'name email');
  if (!student) return next(new ApiError(404, 'Student not found'));

  // Parents can only pay for their own child
  if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only make payments for your own child'));
  }

  // Generate unique reference
  var reference = 'SS-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  // Create pending payment record first
  var payment = await Payment.create({
    studentId:     studentId,
    amount:        amount,
    feeType:       feeType,
    term:          term,
    session:       session,
    status:        'pending',
    paymentMethod: 'paystack',
    reference:     reference,
    notes:         notes || null,
    recordedBy:    req.user._id,
  });

  // Call Paystack API — amount must be in kobo (multiply by 100)
  var paystackRes = await initializePayment(
    student.userId.email,
    amount * 100,
    reference,
    { studentId: studentId, paymentId: String(payment._id), studentName: student.userId.name }
  );

  if (!paystackRes.status) {
    await Payment.findByIdAndDelete(payment._id);
    return next(new ApiError(502, 'Paystack initialization failed: ' + (paystackRes.message || 'Unknown error')));
  }

  res.status(200).json({
    success: true,
    message: 'Payment initialized. Redirect user to the authorization URL.',
    data: {
      reference:        reference,
      paymentId:        payment._id,
      authorizationUrl: paystackRes.data.authorization_url,
      accessCode:       paystackRes.data.access_code,
    },
  });
});

// ─── Verify Paystack payment ──────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// Public (called after Paystack redirect)
exports.verifyPayment = catchAsync(async function(req, res, next) {
  var reference = req.params.reference;

  var payment = await Payment.findOne({ reference: reference });
  if (!payment) return next(new ApiError(404, 'Payment record not found'));

  if (payment.status === 'paid') {
    return res.status(200).json({ success: true, message: 'Payment already verified', data: payment });
  }

  // Call Paystack verify API
  var paystackRes = await verifyPayment(reference);

  if (!paystackRes.status || paystackRes.data.status !== 'success') {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed', paystackData: paystackRes.data });
    return next(new ApiError(402, 'Payment was not successful. Status: ' + (paystackRes.data ? paystackRes.data.status : 'unknown')));
  }

  // Generate receipt number and mark as paid
  var receiptNumber = await generateReceiptNumber();

  // Fire payment notification after successful update
  notifSvc.onPaymentConfirmed(
    payment.studentId, payment.amount, payment.feeType,
    payment.term, receiptNumber
  ).catch(() => {});

  var updated = await Payment.findByIdAndUpdate(
    payment._id,
    {
      status:        'paid',
      paidAt:        new Date(),
      receiptNumber: receiptNumber,
      paystackData:  paystackRes.data,
    },
    { new: true }
  ).populate('studentId', 'admissionNumber');

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    data:    updated,
  });
});

// ─── Paystack Webhook ─────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Public (called by Paystack servers — no auth)
exports.webhook = async function(req, res) {
  try {
    var signature = req.headers['x-paystack-signature'];
    var rawBody   = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    var event = req.body;

    if (event.event === 'charge.success') {
      var reference = event.data.reference;
      var payment   = await Payment.findOne({ reference: reference });

      if (payment && payment.status !== 'paid') {
        var receiptNumber = await generateReceiptNumber();
        await Payment.findByIdAndUpdate(payment._id, {
          status:        'paid',
          paidAt:        new Date(),
          receiptNumber: receiptNumber,
          paystackData:  event.data,
        });
      }
    }

    res.status(200).json({ message: 'Webhook received' });
  } catch (err) {
    res.status(200).json({ message: 'Webhook processed' }); // always 200 to Paystack
  }
};

// ─── Record manual payment (cash / bank transfer) ────────────────────────────
// POST /api/payments/manual
// Admin only
exports.recordManualPayment = catchAsync(async function(req, res, next) {
  var studentId     = req.body.studentId;
  var amount        = Number(req.body.amount);
  var feeType       = req.body.feeType;
  var term          = req.body.term;
  var session       = req.body.session;
  var paymentMethod = req.body.paymentMethod || 'cash';
  var notes         = req.body.notes;

  if (!studentId || !amount || !feeType || !term || !session) {
    return next(new ApiError(400, 'Please provide studentId, amount, feeType, term and session'));
  }

  var student = await Student.findById(studentId);
  if (!student) return next(new ApiError(404, 'Student not found'));

  var receiptNumber = await generateReceiptNumber();
  var reference     = 'MANUAL-' + Date.now();

  var payment = await Payment.create({
    studentId:     studentId,
    amount:        amount,
    feeType:       feeType,
    term:          term,
    session:       session,
    status:        'paid',
    paymentMethod: paymentMethod,
    reference:     reference,
    receiptNumber: receiptNumber,
    paidAt:        new Date(),
    recordedBy:    req.user._id,
    notes:         notes || null,
  });

  var populated = await Payment.findById(payment._id)
    .populate('studentId', 'admissionNumber')
    .populate('recordedBy', 'name');

  res.status(201).json({
    success: true,
    message: 'Manual payment recorded successfully',
    data:    populated,
  });
});

// ─── Get payments for a student ───────────────────────────────────────────────
// GET /api/payments/student/:studentId
// Admin, Parent (own child only)
exports.getStudentPayments = catchAsync(async function(req, res, next) {
  var studentId = req.params.studentId;
  var term      = req.query.term;
  var session   = req.query.session;
  var status    = req.query.status;

  var student = await Student.findById(studentId);
  if (!student) return next(new ApiError(404, 'Student not found'));

  if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id)) {
    return next(new ApiError(403, 'You can only view payments for your own child'));
  }

  var filter = { studentId: studentId };
  if (term)    filter.term    = term;
  if (session) filter.session = session;
  if (status)  filter.status  = status;

  var p = paginate(req.query);
  var total    = await Payment.countDocuments(filter);
  var payments = await Payment.find(filter)
    .populate('studentId',  'admissionNumber')
    .populate('recordedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(p.skip)
    .limit(p.limit);

  // Total amount paid
  var totalPaid = await Payment.aggregate([
    { $match: { studentId: student._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.status(200).json({
    success: true,
    totalAmountPaid: totalPaid.length > 0 ? totalPaid[0].total : 0,
    pagination: { total: total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: payments,
  });
});

// ─── Get all payments (admin overview) ───────────────────────────────────────
// GET /api/payments
// Admin only
exports.getAllPayments = catchAsync(async function(req, res, next) {
  var p       = paginate(req.query);
  var status  = req.query.status;
  var term    = req.query.term;
  var session = req.query.session;
  var feeType = req.query.feeType;

  var filter = {};
  if (status)  filter.status  = status;
  if (term)    filter.term    = term;
  if (session) filter.session = session;
  if (feeType) filter.feeType = feeType;

  var total    = await Payment.countDocuments(filter);
  var payments = await Payment.find(filter)
    .populate('studentId',  'admissionNumber')
    .populate('recordedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(p.skip)
    .limit(p.limit);

  // Revenue summary
  var revenue = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.status(200).json({
    success: true,
    totalRevenue: revenue.length > 0 ? revenue[0].total : 0,
    pagination: { total: total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: payments,
  });
});

// ─── Get receipt ──────────────────────────────────────────────────────────────
// GET /api/payments/:id/receipt
// Admin, Parent
exports.getReceipt = catchAsync(async function(req, res, next) {
  var payment = await Payment.findById(req.params.id)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .populate('recordedBy', 'name');

  if (!payment) return next(new ApiError(404, 'Payment not found'));
  if (payment.status !== 'paid') return next(new ApiError(400, 'Receipt only available for completed payments'));

  if (req.user.role === 'parent') {
    if (!payment.studentId.parentId || String(payment.studentId.parentId) !== String(req.user._id)) {
      return next(new ApiError(403, 'You can only view receipts for your own child'));
    }
  }

  res.status(200).json({
    success: true,
    receipt: {
      receiptNumber:  payment.receiptNumber,
      studentName:    payment.studentId.userId ? payment.studentId.userId.name : 'N/A',
      admissionNumber:payment.studentId.admissionNumber,
      amount:         payment.amount,
      feeType:        payment.feeType,
      term:           payment.term,
      session:        payment.session,
      paymentMethod:  payment.paymentMethod,
      reference:      payment.reference,
      paidAt:         payment.paidAt,
      recordedBy:     payment.recordedBy ? payment.recordedBy.name : 'System',
      notes:          payment.notes,
    },
  });
});