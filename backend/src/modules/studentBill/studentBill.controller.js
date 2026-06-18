/**
 * studentBill.controller.js — FINAL VERSION
 * - NO catchAsync, NO next parameter anywhere
 * - Lazy-loads all models to avoid circular deps
 * - All errors returned via res.status().json()
 * - THE FIX: term: { $in: [term, 'all'] } instead of double $or
 */

function getStudentBill()  { return require('../../models/StudentBill');  }
function getFeeStructure() { return require('../../models/FeeStructure'); }
function getStudent()      { return require('../../models/Student');      }
function getPayment()      { return require('../../models/Payment');      }
function getClass()        { return require('../../models/Class');        }

function ok(res, data, code)  { return res.status(code||200).json(Object.assign({ success: true }, data)); }
function bad(res, code, msg)  { return res.status(code).json({ success: false, message: msg }); }

exports.generateBills = async function(req, res) {
  try {
    var classId = req.body.classId;
    var session = req.body.session;
    var term    = req.body.term;
    if (!classId || !session || !term)
      return bad(res, 400, 'classId, session and term are required');

    var Class        = getClass();
    var Student      = getStudent();
    var FeeStructure = getFeeStructure();
    var StudentBill  = getStudentBill();

    var cls = await Class.findById(classId);
    if (!cls) return bad(res, 404, 'Class not found');

    var students = await Student.find({ classId: classId, isActive: true });
    if (!students.length) return bad(res, 400, 'No active students in this class');

    var fees = await FeeStructure.find({
      session:  session,
      isActive: true,
      term:     { $in: [term, 'all'] },
      $or: [
        { scope: 'all_classes' },
        { scope: 'specific_class', classId: classId },
      ],
    });

    if (!fees.length)
      return bad(res, 400, 'No fee structures found for ' + term + ' term ' + session + '. Create fee structures first.');

    var created = 0, updated = 0, skipped = 0, results = [];

    for (var i = 0; i < students.length; i++) {
      var student = students[i];
      var items = fees.map(function(fee) {
        return { feeStructureId: fee._id, feeName: fee.name, feeType: fee.feeType,
                 amount: fee.amount, discount: 0, netAmount: fee.amount,
                 paid: 0, balance: fee.amount, status: 'unpaid' };
      });

      var bill = await StudentBill.findOne({ studentId: student._id, session: session, term: term });
      if (bill) {
        var existing = bill.items.map(function(x) { return String(x.feeStructureId); });
        var newItems = items.filter(function(x) { return !existing.includes(String(x.feeStructureId)); });
        if (newItems.length) { newItems.forEach(function(ni) { bill.items.push(ni); }); await bill.save(); updated++; }
        else skipped++;
      } else {
        bill = new StudentBill({ studentId: student._id, classId: classId, session: session, term: term, items: items, createdBy: req.user._id });
        await bill.save();
        created++;
      }
      results.push({ student: student.admissionNumber, billId: bill._id, totalAmount: bill.totalAmount, status: bill.status });
    }

    return ok(res, { message: 'Bills generated: ' + created + ' created, ' + updated + ' updated, ' + skipped + ' unchanged',
                     summary: { created: created, updated: updated, skipped: skipped, total: students.length }, data: results }, 201);
  } catch (e) {
    console.error('[generateBills]', e.stack || e.message);
    return bad(res, 500, e.message || 'Failed to generate bills');
  }
};

exports.generateSingleBill = async function(req, res) {
  try {
    var StudentBill = getStudentBill(); var FeeStructure = getFeeStructure(); var Student = getStudent();
    var studentId = req.body.studentId, session = req.body.session, term = req.body.term;
    if (!studentId || !session || !term) return bad(res, 400, 'studentId, session and term required');
    var student = await Student.findById(studentId).populate('classId');
    if (!student) return bad(res, 404, 'Student not found');
    if (!student.classId) return bad(res, 400, 'Student has no class');
    var classId = student.classId._id;
    var fees = await FeeStructure.find({ session: session, isActive: true, term: { $in: [term,'all'] },
      $or: [{ scope:'all_classes' },{ scope:'specific_class', classId: classId },{ scope:'specific_student', studentId: studentId }] });
    var items = fees.map(function(fee) {
      return { feeStructureId: fee._id, feeName: fee.name, feeType: fee.feeType,
               amount: fee.amount, discount: 0, netAmount: fee.amount, paid: 0, balance: fee.amount, status: 'unpaid' };
    });
    var bill = await StudentBill.findOne({ studentId: studentId, session: session, term: term });
    if (bill) {
      var existing = bill.items.map(function(x) { return String(x.feeStructureId); });
      items.filter(function(x) { return !existing.includes(String(x.feeStructureId)); }).forEach(function(ni) { bill.items.push(ni); });
      await bill.save();
    } else {
      bill = new StudentBill({ studentId: studentId, classId: classId, session: session, term: term, items: items, createdBy: req.user._id });
      await bill.save();
    }
    return ok(res, { message: 'Bill generated', data: bill }, 201);
  } catch (e) { return bad(res, 500, e.message); }
};

exports.getAllBills = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var page = Math.max(1, Number(req.query.page)||1), limit = Math.max(1, Number(req.query.limit)||20);
    var filter = {};
    if (req.query.session) filter.session = req.query.session;
    if (req.query.term)    filter.term    = req.query.term;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.status)  filter.status  = req.query.status;
    var total = await StudentBill.countDocuments(filter);
    var bills = await StudentBill.find(filter)
      .populate({ path: 'studentId', select: 'admissionNumber userId', populate: { path: 'userId', select: 'name' } })
      .populate('classId', 'name section').sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit);
    var agg = await StudentBill.aggregate([{ $match: filter },
      { $group: { _id: null, totalBilled: { $sum: '$totalAmount' }, totalPaid: { $sum: '$totalPaid' }, totalBalance: { $sum: '$totalBalance' },
        countPaid: { $sum: { $cond: [{ $eq: ['$status','paid'] }, 1, 0] } },
        countPartial: { $sum: { $cond: [{ $eq: ['$status','partial'] }, 1, 0] } },
        countUnpaid: { $sum: { $cond: [{ $eq: ['$status','unpaid'] }, 1, 0] } } } }]);
    return ok(res, { pagination: { total: total, page: page, pages: Math.ceil(total/limit) }, summary: agg[0]||{}, data: bills });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.getStudentBills = async function(req, res) {
  try {
    var Student = getStudent();
    if (req.user.role !== 'admin') {
      var student = await Student.findById(req.params.studentId);
      if (!student) return bad(res, 404, 'Student not found');
      if (req.user.role === 'parent' && String(student.parentId) !== String(req.user._id)) return bad(res, 403, 'Access denied');
      if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) return bad(res, 403, 'Access denied');
    }

    var StudentBill = getStudentBill();
    var filter = { studentId: req.params.studentId };
    if (req.query.session) filter.session = req.query.session;
    if (req.query.term)    filter.term    = req.query.term;
    var bills = await StudentBill.find(filter).populate('classId','name section')
      .populate('items.feeStructureId','name allowInstallment minInstallment').sort({ session:-1, term:-1 });
    return ok(res, { totals: { totalBilled: bills.reduce(function(s,b){return s+b.totalAmount;},0),
      totalPaid: bills.reduce(function(s,b){return s+b.totalPaid;},0),
      totalBalance: bills.reduce(function(s,b){return s+b.totalBalance;},0) }, data: bills });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.getBill = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var bill = await StudentBill.findById(req.params.id)
      .populate({ path:'studentId', select:'admissionNumber userId classId parentId', populate:{path:'userId',select:'name email'} })
      .populate('classId','name section').populate('items.feeStructureId','name feeType allowInstallment minInstallment');
    if (!bill) return bad(res, 404, 'Bill not found');

    if (req.user.role !== 'admin') {
      if (req.user.role === 'parent' && String(bill.studentId.parentId) !== String(req.user._id)) return bad(res, 403, 'Access denied');
      if (req.user.role === 'student' && String(bill.studentId.userId._id || bill.studentId.userId) !== String(req.user._id)) return bad(res, 403, 'Access denied');
    }

    return ok(res, { data: bill });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.applyDiscount = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    var item = bill.items.id(req.body.itemId);
    if (!item) return bad(res, 404, 'Line item not found');
    var discount = Number(req.body.discount);
    if (discount < 0 || discount > item.amount) return bad(res, 400, 'Invalid discount');
    item.discount = discount; item.netAmount = item.amount - discount;
    if (req.body.note) bill.discountNote = req.body.note;
    await bill.save();
    return ok(res, { message: 'Discount applied', data: bill });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.waiveItem = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    var item = bill.items.id(req.body.itemId);
    if (!item) return bad(res, 404, 'Line item not found');
    item.status = 'waived'; item.discount = item.amount; item.netAmount = 0;
    await bill.save();
    return ok(res, { message: 'Item waived', data: bill });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.setCarryOver = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    bill.carryOver = Number(req.body.carryOver) || 0;
    await bill.save();
    return ok(res, { data: bill });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.syncBill = async function(req, res) {
  try {
    var StudentBill = getStudentBill(); var Payment = getPayment();
    var bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    var payments = await Payment.find({ studentId: bill.studentId, session: bill.session, term: bill.term, status: 'paid' });
    var remaining = payments.reduce(function(s,p){ return s+p.amount; }, 0);
    bill.items.forEach(function(item) {
      if (item.status === 'waived') return;
      var pay = Math.min(item.netAmount, remaining); item.paid = pay; remaining = Math.max(0, remaining-pay);
    });
    await bill.save();
    return ok(res, { message: 'Bill synced', data: bill });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.deleteBill = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var bill = await StudentBill.findById(req.params.id);
    if (!bill) return bad(res, 404, 'Bill not found');
    if (bill.totalPaid > 0) return bad(res, 400, 'Cannot delete bill with payments');
    await StudentBill.findByIdAndDelete(req.params.id);
    return ok(res, { message: 'Bill deleted' });
  } catch (e) { return bad(res, 500, e.message); }
};

exports.getDefaulters = async function(req, res) {
  try {
    var StudentBill = getStudentBill();
    var filter = {
      status:       { $in: ['unpaid', 'partial'] },
      totalBalance: { $gt: Number(req.query.minBalance) || 0 },
    };
    if (req.query.session) filter.session = req.query.session;
    if (req.query.term)    filter.term    = req.query.term;
    if (req.query.classId) filter.classId = req.query.classId;

    var bills = await StudentBill.find(filter)
      .populate({ path: 'studentId', select: 'admissionNumber userId',
                  populate: { path: 'userId', select: 'name email' } })
      .populate('classId', 'name section')
      .sort({ totalBalance: -1 });

    return ok(res, {
      count: bills.length,
      totalOutstanding: bills.reduce(function(s,b){ return s + b.totalBalance; }, 0),
      data:  bills,
    });
  } catch (e) { return bad(res, 500, e.message); }
};
