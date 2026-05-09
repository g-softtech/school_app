/**
 * notificationService.js
 * Centralised service for creating in-app notifications AND sending emails.
 * Used by results, payments, assignments and announcements controllers.
 * Failures are always caught — they must never crash the main request.
 */
const Notification = require('../src/models/Notification');
const Student      = require('../src/models/Student');
const User         = require('../src/models/User');
const { sendEmail } = require('./emailService');

// ── Create one in-app notification ────────────────────────────────────────────
async function notify(userId, title, message, type, link) {
  try {
    await Notification.create({ userId, title, message, type: type || 'general', link: link || null });
  } catch (e) {
    console.error('[notify] Failed:', e.message);
  }
}

// ── Create in-app notifications for multiple users ────────────────────────────
async function notifyMany(userIds, title, message, type) {
  try {
    const docs = userIds.map((id) => ({ userId: id, title, message, type: type || 'general' }));
    await Notification.insertMany(docs);
  } catch (e) {
    console.error('[notifyMany] Failed:', e.message);
  }
}

// ── Results published ─────────────────────────────────────────────────────────
// Called from results controller after bulk/single upload
async function onResultsPublished(studentId, term, session) {
  try {
    const student = await Student.findById(studentId)
      .populate('userId',   'name email')
      .populate('parentId', 'name email _id');

    if (!student) return;

    const studentUser = student.userId;
    const parentUser  = student.parentId;
    const msg         = `Your ${term} term results for ${session} have been published. Log in to view them.`;
    const title       = `${term.charAt(0).toUpperCase() + term.slice(1)} Term Results Available`;

    // In-app: student
    if (studentUser?._id) await notify(studentUser._id, title, msg, 'result', '/student/results');

    // In-app: parent
    if (parentUser?._id)  await notify(parentUser._id,  title,
      `Your child (${studentUser?.name})'s ${term} term results are available.`, 'result', '/parent/results');

    // Email: student
    if (studentUser?.email) {
      await sendEmail({
        to:      studentUser.email,
        subject: title + ' — SmartSchool',
        html: `<p>Dear ${studentUser.name},</p>
               <p>Your <strong>${term} term</strong> results for the <strong>${session}</strong> session have been published.</p>
               <p>Log in to your portal to view them: <a href="${process.env.CLIENT_URL}/student/results">View Results</a></p>
               <p>SmartSchool Management System</p>`,
      });
    }

    // Email: parent
    if (parentUser?.email) {
      await sendEmail({
        to:      parentUser.email,
        subject: `${studentUser?.name}'s ${term} Term Results — SmartSchool`,
        html: `<p>Dear ${parentUser.name},</p>
               <p>Your child <strong>${studentUser?.name}</strong>'s results for the <strong>${term} term ${session}</strong> are now available.</p>
               <p>Log in to your parent portal: <a href="${process.env.CLIENT_URL}/parent/results">View Results</a></p>
               <p>SmartSchool Management System</p>`,
      });
    }
  } catch (e) {
    console.error('[onResultsPublished] Failed:', e.message);
  }
}

// ── Payment confirmed ─────────────────────────────────────────────────────────
async function onPaymentConfirmed(studentId, amount, feeType, term, receiptNumber) {
  try {
    const student = await Student.findById(studentId)
      .populate('userId',   'name email')
      .populate('parentId', 'name email _id');

    if (!student) return;

    const studentUser = student.userId;
    const parentUser  = student.parentId;
    const amountFmt   = '₦' + Number(amount).toLocaleString('en-NG');
    const title       = 'Payment Confirmed';
    const msg         = `${amountFmt} payment for ${feeType} (${term} term) confirmed. Receipt: ${receiptNumber || 'N/A'}`;

    if (studentUser?._id) await notify(studentUser._id, title, msg, 'payment', '/student/results');
    if (parentUser?._id)  await notify(parentUser._id,  title, msg, 'payment', '/parent/payments');

    if (parentUser?.email) {
      await sendEmail({
        to:      parentUser.email,
        subject: 'Payment Confirmed — SmartSchool',
        html: `<p>Dear ${parentUser.name},</p>
               <p>Your payment of <strong>${amountFmt}</strong> for <strong>${feeType}</strong> (${term} term) has been confirmed.</p>
               ${receiptNumber ? `<p>Receipt No: <strong>${receiptNumber}</strong></p>` : ''}
               <p>View payment details: <a href="${process.env.CLIENT_URL}/parent/payments">My Payments</a></p>
               <p>SmartSchool Management System</p>`,
      });
    }
  } catch (e) {
    console.error('[onPaymentConfirmed] Failed:', e.message);
  }
}

// ── Assignment graded ─────────────────────────────────────────────────────────
async function onAssignmentGraded(studentId, assignmentTitle, score, maxScore, feedback) {
  try {
    const student = await Student.findById(studentId).populate('userId', 'name email');
    if (!student?.userId) return;

    const name  = student.userId.name;
    const email = student.userId.email;
    const title = `Assignment Graded: ${assignmentTitle}`;
    const msg   = `You scored ${score}/${maxScore}.${feedback ? ' Feedback: ' + feedback : ''}`;

    await notify(student.userId._id, title, msg, 'assignment', '/student/assignments');

    if (email) {
      await sendEmail({
        to:      email,
        subject: title + ' — SmartSchool',
        html: `<p>Dear ${name},</p>
               <p>Your assignment <strong>${assignmentTitle}</strong> has been graded.</p>
               <p>Score: <strong>${score} / ${maxScore}</strong></p>
               ${feedback ? `<p>Teacher feedback: ${feedback}</p>` : ''}
               <p>Log in to view details: <a href="${process.env.CLIENT_URL}/student/assignments">My Assignments</a></p>
               <p>SmartSchool Management System</p>`,
      });
    }
  } catch (e) {
    console.error('[onAssignmentGraded] Failed:', e.message);
  }
}

// ── Broadcast announcement ────────────────────────────────────────────────────
async function onBroadcastAnnouncement(targetRole, title, message, sendEmail_ = false) {
  try {
    const users = await User.find({ role: targetRole, isActive: true }, '_id email name');
    if (!users.length) return;

    const userIds = users.map((u) => u._id);
    await notifyMany(userIds, title, message, 'announcement');

    if (sendEmail_) {
      for (const u of users) {
        if (u.email) {
          await sendEmail({
            to:      u.email,
            subject: title + ' — SmartSchool',
            html: `<p>Dear ${u.name},</p><p>${message}</p><p>SmartSchool Management System</p>`,
          });
        }
      }
    }
  } catch (e) {
    console.error('[onBroadcastAnnouncement] Failed:', e.message);
  }
}

module.exports = {
  notify,
  notifyMany,
  onResultsPublished,
  onPaymentConfirmed,
  onAssignmentGraded,
  onBroadcastAnnouncement,
};
