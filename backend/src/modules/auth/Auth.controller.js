const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const { sendTokenResponse, verifyRefreshToken, generateAccessToken } = require('../../utils/generateToken');

exports.register = catchAsync(async function(req, res, next) {
  var name = req.body.name, email = req.body.email, password = req.body.password, role = req.body.role;

  if (!name || !email || !password) return next(new ApiError(400, 'Please provide name, email and password'));
  if (role === 'admin') return next(new ApiError(403, 'Admin accounts cannot be created via this endpoint'));

  var existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return next(new ApiError(409, 'An account with this email already exists'));

  var user = await User.create({ name, email, password, role: role || 'student' });
  var tokens = sendTokenResponse(user, 201, res);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });
});

exports.login = catchAsync(async function(req, res, next) {
  var email = req.body.email, password = req.body.password;

  if (!email || !password) return next(new ApiError(400, 'Please provide email and password'));

  var user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) return next(new ApiError(401, 'Incorrect email or password'));
  if (!user.isActive) return next(new ApiError(401, 'Your account has been deactivated. Contact the school admin.'));

  user.lastLogin = new Date();
  var tokens = sendTokenResponse(user, 200, res);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });
});

exports.logout = catchAsync(async function(req, res, next) {
  await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

exports.refreshToken = catchAsync(async function(req, res, next) {
  var token = req.cookies && req.cookies.refreshToken;
  if (!token) return next(new ApiError(401, 'No refresh token provided. Please log in again.'));

  var decoded = verifyRefreshToken(token);
  var user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) return next(new ApiError(401, 'Invalid or expired refresh token.'));

  res.status(200).json({ success: true, accessToken: generateAccessToken(user) });
});

exports.getMe = catchAsync(async function(req, res, next) {
  res.status(200).json({ success: true, user: req.user });
});

exports.updatePassword = catchAsync(async function(req, res, next) {
  var currentPassword = req.body.currentPassword, newPassword = req.body.newPassword;

  if (!currentPassword || !newPassword) return next(new ApiError(400, 'Please provide currentPassword and newPassword'));
  if (newPassword.length < 8) return next(new ApiError(400, 'New password must be at least 8 characters'));

  var user = await User.findById(req.user.id).select('+password');
  if (!(await user.comparePassword(currentPassword))) return next(new ApiError(401, 'Current password is incorrect'));

  user.password = newPassword;
  await user.save();
  var tokens = sendTokenResponse(user, 200, res);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });
});