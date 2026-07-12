const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "https://REDACTED_SENTRY_DSN",
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
