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
      
      const { enqueueSyncJob } = require('../../utils/syncQueue');
      await enqueueSyncJob(bill._id.toString());
      
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
    
    const { enqueueSyncJob } = require('../../utils/syncQueue');
    await enqueueSyncJob(bill._id.toString());
    
    return ok(res, { message: 'Bill generated successfully', data: bill }, 201);
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

    // Increment Revision ONLY for Adjustments
    const mongoose = require('mongoose');
    await StudentBill.updateOne({ _id: bill._id }, { $inc: { revision: 1 } });

    // BACKGROUND: Enqueue deterministic rebuild projection
    const { enqueueSyncJob } = require('../../utils/syncQueue');
    await enqueueSyncJob(bill._id.toString());

    // RETURN FAST
    return ok(res, { message: type + ' logged successfully. Pending rebuild.' });
  } catch (e) {
    return bad(res, e.message.includes('not found') ? 404 : 500, e.message);
  }
};



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

exports.siblingTransfer = async function(req, res) {
  try {
    const { sourceBillId, targetBillId, sourceItemId, targetItemId, amount, reason } = req.body;
    if (!sourceBillId || !targetBillId || !sourceItemId || !targetItemId || !amount) {
      return bad(res, 400, 'sourceBillId, targetBillId, sourceItemId, targetItemId, and amount are required');
    }

    const StudentBill = getStudentBill();
    const BillAdjustment = require('../../models/BillAdjustment');
    const mongoose = require('mongoose');

    const sourceBill = await StudentBill.findById(sourceBillId);
    const targetBill = await StudentBill.findById(targetBillId);

    if (!sourceBill || !targetBill) return bad(res, 404, 'Source or target bill not found');

    const sourceItem = sourceBill.items.id(sourceItemId);
    const targetItem = targetBill.items.id(targetItemId);

    if (!sourceItem || !targetItem) return bad(res, 404, 'Source or target item not found');

    const transferGroupId = new mongoose.Types.ObjectId().toString();

    await BillAdjustment.create({
      billId: sourceBillId,
      itemId: sourceItemId,
      type: 'transfer_out',
      amount,
      reason: reason || 'Sibling transfer to ' + targetBillId,
      transferGroupId,
      approvedBy: req.user._id
    });

    await BillAdjustment.create({
      billId: targetBillId,
      itemId: targetItemId,
      type: 'transfer_in',
      amount,
      reason: reason || 'Sibling transfer from ' + sourceBillId,
      transferGroupId,
      approvedBy: req.user._id
    });

    await StudentBill.updateOne({ _id: sourceBillId }, { $inc: { revision: 1 } });
    await StudentBill.updateOne({ _id: targetBillId }, { $inc: { revision: 1 } });

    const { enqueueSyncJob } = require('../../utils/syncQueue');
    await enqueueSyncJob(sourceBillId.toString());
    await enqueueSyncJob(targetBillId.toString());

    return ok(res, { message: 'Sibling transfer logged successfully. Both bills pending rebuild.' });

  } catch (e) {
    console.error('[siblingTransfer]', e.stack || e.message);
    return bad(res, 500, e.message || 'Failed to process sibling transfer');
  }
};

exports.reconcileBills = async function(req, res) {
  try {
    const { classId, session, term, billIds, reason } = req.body;
    
    const StudentBill = getStudentBill();
    let filter = {};
    
    if (billIds && Array.isArray(billIds) && billIds.length > 0) {
      filter._id = { $in: billIds };
    } else {
      if (!session && !term && !classId) {
        return bad(res, 400, 'Must provide either billIds array OR session/term/classId filters');
      }
      if (session) filter.session = session;
      if (term) filter.term = term;
      if (classId) filter.classId = classId;
    }

    const bills = await StudentBill.find(filter).select('_id');
    
    if (!bills.length) {
      return bad(res, 404, 'No bills found matching the given criteria');
    }

    const { enqueueSyncJob } = require('../../utils/syncQueue');
    
    for (const bill of bills) {
      // Re-enqueue every matching bill. ZADD NX will inherently deduplicate
      // if it's already in the queue, but if it's not, it will be queued for
      // deterministic re-projection by the Phase 4 engine.
      await enqueueSyncJob(bill._id.toString());
    }

    // Reason can optionally be logged to an audit table here if desired, 
    // but the Phase 4 engine handles the raw correctness independently.
    if (reason) {
      console.log(`[Reconciliation] ${bills.length} bills enqueued. Reason: ${reason}`);
    }

    return ok(res, { 
      message: 'Reconciliation triggered successfully', 
      count: bills.length 
    });

  } catch (e) {
    console.error('[reconcileBills]', e.stack || e.message);
    return bad(res, 500, e.message || 'Failed to trigger reconciliation');
  }
};
