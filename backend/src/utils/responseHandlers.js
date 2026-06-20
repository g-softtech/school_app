/**
 * Standard API response helpers.
 * ok(res, data, message, statusCode)
 * bad(res, statusCode, message)
 */

exports.ok = function(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

exports.bad = function(res, statusCode = 500, message = 'An error occurred') {
  return res.status(statusCode).json({
    success: false,
    message
  });
};
