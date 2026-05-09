const Notification = require('../../models/Notification');
const User         = require('../../models/User');
const ApiError     = require('../../utils/ApiError');
const catchAsync   = require('../../utils/catchAsync');
const paginate     = require('../../utils/paginate');

// Shared helper — create in-app notification(s)
var createNotification = async function(userId, title, message, type, link) {
  return Notification.create({ userId, title, message, type: type || 'general', link: link || null });
};

// Create notifications for multiple users at once
var createBulkNotifications = async function(userIds, title, message, type) {
  var docs = userIds.map(function(id) { return { userId: id, title, message, type: type || 'general' }; });
  return Notification.insertMany(docs);
};

// GET /api/notifications — current user's notifications
exports.getMyNotifications = catchAsync(async function(req, res, next) {
  var p = paginate(req.query);
  var filter = { userId: req.user._id };
  if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
  if (req.query.type) filter.type = req.query.type;

  var total = await Notification.countDocuments(filter);
  var notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(p.skip)
    .limit(p.limit);

  var unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

  res.status(200).json({
    success: true,
    unreadCount,
    pagination: { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) },
    data: notifications,
  });
});

// PATCH /api/notifications/:id/read
exports.markAsRead = catchAsync(async function(req, res, next) {
  var notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
  if (!notification) return next(new ApiError(404, 'Notification not found'));

  notification.isRead = true;
  await notification.save();
  res.status(200).json({ success: true, message: 'Notification marked as read' });
});

// PATCH /api/notifications/mark-all-read
exports.markAllAsRead = catchAsync(async function(req, res, next) {
  var result = await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  res.status(200).json({ success: true, message: result.modifiedCount + ' notification(s) marked as read' });
});

// POST /api/notifications/send — Admin sends notification to role
exports.sendNotification = catchAsync(async function(req, res, next) {
  var title      = req.body.title;
  var message    = req.body.message;
  var targetRole = req.body.targetRole;
  var type       = req.body.type || 'announcement';

  if (!title || !message || !targetRole) {
    return next(new ApiError(400, 'Please provide title, message and targetRole'));
  }

  var users = await User.find({ role: targetRole, isActive: true }, { _id: 1 });
  if (users.length === 0) return next(new ApiError(404, 'No active users found with role: ' + targetRole));

  var userIds = users.map(function(u) { return u._id; });
  await createBulkNotifications(userIds, title, message, type);

  // Optionally send email too (opt-in via sendEmail: true in request body)
  if (req.body.sendEmail) {
    var { sendEmail: sendEmailFn } = require('../../../services/emailService');
    for (var u of users) {
      if (u.email) {
        await sendEmailFn({
          to: u.email,
          subject: title + ' — SmartSchool',
          html: '<p>Dear ' + u.name + ',</p><p>' + message + '</p><p>SmartSchool Management System</p>',
        }).catch(() => {});
      }
    }
  }

  res.status(201).json({ success: true, message: 'Notification sent to ' + users.length + ' ' + targetRole + '(s)' });
});

// DELETE /api/notifications/:id
exports.deleteNotification = catchAsync(async function(req, res, next) {
  await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.status(200).json({ success: true, message: 'Notification deleted' });
});

module.exports.createNotification     = createNotification;
module.exports.createBulkNotifications = createBulkNotifications;