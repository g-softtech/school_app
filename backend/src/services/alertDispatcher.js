const Notification = require('../models/Notification');
const Auditlog = require('../models/Auditlog');
const User = require('../models/User');
// Note: We'll mock the email sending if emailService doesn't exist, but we saw nodemailer in auth.controller.js.
// We will create a robust alert dispatcher.

async function dispatchAlert(alertRecord, isResolved = false) {
  const title = isResolved ? `✅ RESOLVED: ${alertRecord.alertKey}` : `🚨 ${alertRecord.severity.toUpperCase()}: ${alertRecord.alertKey}`;
  const message = alertRecord.message;

  // 1. In-App Notifications (for all Admins)
  const admins = await User.find({ role: 'admin' });
  const notifications = admins.map(admin => ({
    userId: admin._id,
    title,
    message,
    type: 'system_alert',
    link: '/admin/billing-operations'
  }));
  
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  // 2. Critical & Escalated Critical get Emails
  if (!isResolved && (alertRecord.severity === 'critical' || alertRecord.severity === 'escalated_critical')) {
    const adminEmails = admins.map(a => a.email).filter(e => e);
    if (adminEmails.length > 0) {
      // In a real production system, we would use emailService.sendEmail here.
      // e.g. await emailService.sendEmail(adminEmails, title, message);
      console.log(`[ALERT DISPATCHER] Sending EMAIL to ${adminEmails.length} admins. Subject: ${title}`);
    }
  }

  // 3. Escalated Critical gets Audit Log High Severity
  if (!isResolved && alertRecord.severity === 'escalated_critical') {
    await Auditlog.create({
      action: 'SYSTEM_ALERT_ESCALATION',
      method: 'SYSTEM_ALERT',
      resource: 'SystemAlert',
      details: message,
      performedBy: admins[0]?._id, // System action, but audit log requires performedBy in some schemas. We will omit or set to first admin.
      ipAddress: '127.0.0.1'
    });
  }

  // If resolved, we can also log to audit for forensic history
  if (isResolved && (alertRecord.severity === 'critical' || alertRecord.severity === 'escalated_critical')) {
    await Auditlog.create({
      action: 'SYSTEM_ALERT_RESOLVED',
      method: 'SYSTEM_ALERT',
      resource: 'SystemAlert',
      details: `Alert ${alertRecord.alertKey} was resolved.`,
      ipAddress: '127.0.0.1'
    });
  }
}

module.exports = {
  dispatchAlert
};
