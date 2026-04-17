// Lives at: backend/src/middleware/authMiddleware.js

// src/models/ is a sibling of src/middleware/ — go up one level then into models/
const User = require('../models/User');

// src/utils/ is a sibling of src/middleware/ — go up one level then into utils/
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { verifyAccessToken } = require('../utils/generateToken');

const protect = catchAsync(async (req, res, next) => {
  // 1. Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Access denied. No token provided. Please log in.'));
  }

  const token = authHeader.split(' ')[1];

  // 2. Verify the token (throws JsonWebTokenError or TokenExpiredError on failure)
  const decoded = verifyAccessToken(token);

  // 3. Check the user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new ApiError(401, 'The user belonging to this token no longer exists.'));
  }

  // 4. Check the account is still active
  if (!currentUser.isAccountActive()) {
    return next(new ApiError(401, 'Your account has been deactivated. Please contact the school admin.'));
  }

  // 5. Attach user to request
  req.user = currentUser;
  next();
});

module.exports = protect;