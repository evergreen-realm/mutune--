const Sentry = require('@sentry/node');
const logger = require('./logger');

const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry is disabled (SENTRY_DSN is not configured)');
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || 'development'
  });

  logger.info('Sentry initialized successfully on backend');
};

module.exports = { initSentry, Sentry };
