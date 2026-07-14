const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const dsn = process.env.SENTRY_DSN;

if (!dsn) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[Sentry] SENTRY_DSN is not set. Sentry error tracking is DISABLED in production. ' +
      'Set SENTRY_DSN in your environment variables (Render dashboard or render.yaml).'
    );
  } else {
    console.info('[Sentry] SENTRY_DSN is not set — Sentry is disabled in development.');
  }
} else {
  Sentry.init({
    dsn,
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',
  });
}
