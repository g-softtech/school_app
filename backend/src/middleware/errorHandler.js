const { NODE_ENV } = require('../../config/env');
const ApiError = require('../utils/ApiError');

const handleCastError = (err) =>
  new ApiError(400, `Invalid value for field: ${err.path}`);

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new ApiError(409, `${field} already exists. Please use a different value.`);
};

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new ApiError(400, `Validation failed: ${messages.join('. ')}`);
};

const handleJWTError = () =>
  new ApiError(401, 'Invalid token. Please log in again.');

const handleJWTExpiredError = () =>
  new ApiError(401, 'Your session has expired. Please log in again.');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  const response = {
    success: false,
    status: error.status || 'error',
    message: error.message || 'Something went wrong',
    ...(error.errors?.length && { errors: error.errors }),
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;