/**
 * Wraps async route handlers to automatically catch unhandled promise rejections
 * and pass them to the Express error handling middleware.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
