const logger = require('../utils/logger');

function sanitize(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key.startsWith('$')) {
          logger.warn(`NoSQL injection attempt blocked: stripped key "${key}"`);
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  }
  return obj;
}

const mongoSanitize = (req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
};

module.exports = mongoSanitize;
