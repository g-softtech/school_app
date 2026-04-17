// Lives at: backend/src/modules/auth/auth.controller.js

// src/models/ — go up two levels (auth → modules → src) then into models/
const User = require('../../models/User');

// src/utils/ — go up two levels then into utils/
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const {
  sendTokenResponse,
  generateRefreshToken,
  verifyRefreshToken,
  generateAccessToken,
} = require('../../utils/generateToken');

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return next(new ApiError(400, 'Please provide name, email and password'));
  }

  if (role === 'admin') {
    return next(new ApiError(403, 'Admin accounts cannot be created via this endpoint'));
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ApiError(409, 'An account with this email already exists'));
  }

  const user = await User.create({ name, email, password, role });

  const { refreshToken } = sendTokenResponse(user, 201, res);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
});

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'Please provide email and password'));
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new ApiError(401, 'Incorrect email or password'));
  }

  if (!user.isAccountActive()) {
    return next(new ApiError(401, 'Your account has been deactivated. Contact the school admin.'));
  }

  user.lastLogin = new Date();

  const { refreshToken } = sendTokenResponse(user, 200, res);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return next(new ApiError(401, 'No refresh token provided. Please log in again.'));
  }

  const decoded = verifyRefreshToken(token);

  const user = await User.findById(decoded.id).select('+refreshToken');

  if (!user || user.refreshToken !== token) {
    return next(new ApiError(401, 'Invalid or expired refresh token. Please log in again.'));
  }

  const newAccessToken = generateAccessToken(user);

  res.status(200).json({ success: true, accessToken: newAccessToken });
});

// ─── Get Current User ─────────────────────────────────────────────────────────
exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({ success: true, user: req.user });
});

// ─── Update Password ──────────────────────────────────────────────────────────
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ApiError(400, 'Please provide currentPassword and newPassword'));
  }

  if (newPassword.length < 8) {
    return next(new ApiError(400, 'New password must be at least 8 characters'));
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return next(new ApiError(401, 'Current password is incorrect'));
  }

  user.password = newPassword;
  await user.save();

  const { refreshToken } = sendTokenResponse(user, 200, res);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
});