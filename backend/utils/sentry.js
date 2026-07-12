const Sentry = require('@sentry/node');

const initSentry = () => {
  // Sentry is now initialized in instrument.js at startup
};

module.exports = { initSentry, Sentry };

