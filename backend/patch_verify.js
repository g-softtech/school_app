const fs = require('fs');
const file = 'src/modules/payments/payments.controller.js';
let content = fs.readFileSync(file, 'utf8');

const verifyPaymentLogic = `// ── Verify Paystack payment ───────────────────────────────────────────────────
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
});`;

const webhookLogic = `// ── Paystack Webhook ──────────────────────────────────────────────────────────
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
};`;

content = content.replace(
  /\/\/ ── Verify Paystack payment ───────────────────────────────────────────────────[\s\S]*?\/\/ ── Paystack Webhook ──────────────────────────────────────────────────────────/,
  verifyPaymentLogic + '\n\n// ── Paystack Webhook ──────────────────────────────────────────────────────────'
);

content = content.replace(
  /\/\/ ── Paystack Webhook ──────────────────────────────────────────────────────────[\s\S]*?\/\/ ── Record manual payment ─────────────────────────────────────────────────────/,
  webhookLogic + '\n\n// ── Record manual payment ─────────────────────────────────────────────────────'
);

fs.writeFileSync(file, content);
console.log("Success");
