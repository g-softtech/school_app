// Lives at: backend/src/middleware/roleMiddleware.js

// src/utils/ is a sibling of src/middleware/
const ApiError = require('../utils/ApiError');

/**
 * restrictTo
 * Usage: router.delete('/:id', protect, restrictTo('admin'), deleteStudent);
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. This action is restricted to: ${roles.join(', ')}.`)
      );
    }
    next();
  };
};

module.exports = restrictTo;