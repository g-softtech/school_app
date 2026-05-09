const AdmissionApplication = require('../../models/AdmissionApplication');
const ContactMessage       = require('../../models/ContactMessage');
const ApiError             = require('../../utils/ApiError');
const catchAsync           = require('../../utils/catchAsync');
const { sendEmail }        = require('../../../services/emailService');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

// ── POST /api/contact ─────────────────────────────────────────────────────────
exports.submitContact = catchAsync(async (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) {
    return next(new ApiError(400, 'Name, email and message are required'));
  }

  const contact = await ContactMessage.create({ name, email, phone, subject, message });

  // Email admin
  if (ADMIN_EMAIL) {
    await sendEmail({
      to:      ADMIN_EMAIL,
      subject: `New Contact Message: ${subject || 'General Enquiry'} — SmartSchool`,
      html: `<h3>New Contact Form Submission</h3>
             <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
             ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
             ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
             <p><strong>Message:</strong></p>
             <p>${message.replace(/\n/g, '<br>')}</p>
             <hr><p><small>Submitted via SmartSchool Contact Form</small></p>`,
    }).catch(() => {});
  }

  // Auto-reply to sender
  await sendEmail({
    to:      email,
    subject: 'We received your message — SmartSchool',
    html: `<p>Dear ${name},</p>
           <p>Thank you for contacting SmartSchool. We have received your message and will get back to you within 24 hours.</p>
           <p>Your message: <em>${message}</em></p>
           <p>SmartSchool Management Team</p>`,
  }).catch(() => {});

  res.status(201).json({ success: true, message: 'Message received. We will get back to you within 24 hours.' });
});

// ── POST /api/contact/admissions ─────────────────────────────────────────────
exports.submitAdmission = catchAsync(async (req, res, next) => {
  const { fullName, dateOfBirth, gender, applyingFor, parentName, email, phone, address, notes } = req.body;
  if (!fullName || !email || !phone || !applyingFor || !parentName) {
    return next(new ApiError(400, 'Student name, parent name, email, phone and class are required'));
  }

  const app = await AdmissionApplication.create({
    fullName, dateOfBirth, gender, applyingFor, parentName, email, phone, address, notes,
  });

  // Email admin
  if (ADMIN_EMAIL) {
    await sendEmail({
      to:      ADMIN_EMAIL,
      subject: `New Admission Application — ${fullName} (${applyingFor})`,
      html: `<h3>New Admission Application</h3>
             <table style="border-collapse:collapse;width:100%">
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Student Name</strong></td><td style="padding:6px;border:1px solid #ddd">${fullName}</td></tr>
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Applying For</strong></td><td style="padding:6px;border:1px solid #ddd">${applyingFor}</td></tr>
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Gender</strong></td><td style="padding:6px;border:1px solid #ddd">${gender || '—'}</td></tr>
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Parent/Guardian</strong></td><td style="padding:6px;border:1px solid #ddd">${parentName}</td></tr>
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Email</strong></td><td style="padding:6px;border:1px solid #ddd">${email}</td></tr>
               <tr><td style="padding:6px;border:1px solid #ddd"><strong>Phone</strong></td><td style="padding:6px;border:1px solid #ddd">${phone}</td></tr>
               ${address ? `<tr><td style="padding:6px;border:1px solid #ddd"><strong>Address</strong></td><td style="padding:6px;border:1px solid #ddd">${address}</td></tr>` : ''}
               ${notes ? `<tr><td style="padding:6px;border:1px solid #ddd"><strong>Notes</strong></td><td style="padding:6px;border:1px solid #ddd">${notes}</td></tr>` : ''}
             </table>
             <p><a href="${process.env.CLIENT_URL}/admin/admissions">View in Admin Portal</a></p>`,
    }).catch(() => {});
  }

  // Auto-reply to parent
  await sendEmail({
    to:      email,
    subject: 'Admission Application Received — SmartSchool',
    html: `<p>Dear ${parentName},</p>
           <p>Thank you for applying to SmartSchool for <strong>${fullName}</strong> (${applyingFor}).</p>
           <p>We have received your application and will review it within 3 working days. You will be contacted at this email address with the outcome.</p>
           <p>Application Reference: <strong>#${app._id.toString().slice(-6).toUpperCase()}</strong></p>
           <p>SmartSchool Admissions Team</p>`,
  }).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully! You will be contacted within 3 working days.',
    data: { applicationId: app._id },
  });
});

// ── Admin: GET /api/contact/admissions ───────────────────────────────────────
exports.getAdmissions = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const total = await AdmissionApplication.countDocuments(filter);
  const apps  = await AdmissionApplication.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('reviewedBy', 'name');

  res.json({
    success: true,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    data: apps,
  });
});

// ── Admin: PATCH /api/contact/admissions/:id ─────────────────────────────────
exports.updateAdmission = catchAsync(async (req, res, next) => {
  const { status, adminNotes } = req.body;
  const app = await AdmissionApplication.findByIdAndUpdate(
    req.params.id,
    { status, adminNotes, reviewedBy: req.user._id, reviewedAt: new Date() },
    { new: true }
  );
  if (!app) return next(new ApiError(404, 'Application not found'));

  // Notify applicant of decision
  if (status === 'accepted' || status === 'rejected') {
    await sendEmail({
      to:      app.email,
      subject: `Admission Application ${status === 'accepted' ? 'Accepted' : 'Update'} — SmartSchool`,
      html: status === 'accepted'
        ? `<p>Dear ${app.parentName},</p>
           <p>We are pleased to inform you that <strong>${app.fullName}</strong>'s application for <strong>${app.applyingFor}</strong> has been <strong style="color:green">ACCEPTED</strong>.</p>
           ${adminNotes ? `<p>Note: ${adminNotes}</p>` : ''}
           <p>Please visit the school or contact us to complete enrolment.</p>
           <p>SmartSchool Admissions Team</p>`
        : `<p>Dear ${app.parentName},</p>
           <p>We regret to inform you that <strong>${app.fullName}</strong>'s application for <strong>${app.applyingFor}</strong> was not successful at this time.</p>
           ${adminNotes ? `<p>Reason: ${adminNotes}</p>` : ''}
           <p>You are welcome to reapply in the next admission cycle. Contact us for more information.</p>
           <p>SmartSchool Admissions Team</p>`,
    }).catch(() => {});
  }

  res.json({ success: true, message: `Application ${status}`, data: app });
});

// ── Admin: GET /api/contact/messages ─────────────────────────────────────────
exports.getMessages = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const total    = await ContactMessage.countDocuments();
  const messages = await ContactMessage.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({
    success: true,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    data: messages,
  });
});

// ── Admin: PATCH /api/contact/messages/:id/read ───────────────────────────────
exports.markMessageRead = catchAsync(async (req, res, next) => {
  const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
  if (!msg) return next(new ApiError(404, 'Message not found'));
  res.json({ success: true, data: msg });
});

// ── Public: GET /api/contact/stats ───────────────────────────────────────────
// Returns real school stats for homepage
exports.getPublicStats = catchAsync(async (req, res) => {
  const Student = require('../../models/Student');
  const User    = require('../../models/User');
  const Result  = require('../../models/Result');

  const [students, teachers, results] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'teacher', isActive: true }),
    Result.find({}, 'total grade'),
  ]);

  const passGrades = ['A1','B2','B3','C4','C5','C6'];
  const passed     = results.filter(r => passGrades.includes(r.grade)).length;
  const passRate   = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;

  res.json({
    success: true,
    data: {
      students,
      teachers,
      passRate,
      yearsOfExcellence: new Date().getFullYear() - 2009,
    },
  });
});
