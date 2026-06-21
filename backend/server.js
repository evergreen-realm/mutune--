require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { initSentry } = require('./utils/sentry');
const mongoSanitize = require('./middleware/sanitize');

initSentry();

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.tile.openstreetmap.org", "*.cloudflare.com"],
      connectSrc: ["'self'", "*.mongodb.net", "*.sentry.io", "api.render.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mutunerent-web.vercel.app',
  'https://mutunerent-web-mishael-s-alpha.vercel.app',
  'https://mutune-alpha.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    const isVercelSubdomain = /^https:\/\/(mutunerent|mutune)(-.+)?\.vercel\.app$/.test(origin);
    if (ALLOWED_ORIGINS.includes(origin) || isVercelSubdomain) return callback(null, true);
    logger.warn('CORS blocked origin', { origin });
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } })
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize);

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/v1/payments', require('./routes/payments'));
app.use('/api/v1/properties', require('./routes/properties'));
app.use('/api/v1/tenants', require('./routes/tenants'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/agents', require('./routes/agents'));              // Phase 2: check-in
app.use('/api/v1/admin', require('./routes/admin'));                // Phase 2: charts
app.use('/api/v1/maintenance', require('./routes/maintenance'));    // Phase 2: tickets
app.use('/api/v1/reports', require('./routes/reports'));            // Phase 2: KRA CSV
app.use('/api/v1/notices', require('./routes/notices'));            // Phase 3: digital notices
app.use('/api/v1/ai', require('./routes/ai'));                      // Phase 3: AI chat
app.use('/api/v1/tasks', require('./routes/tasks'));                  // Phase 4: Agent task tracking
app.use('/api/v1/inventory', require('./routes/inventory'));          // Phase 4: Inventory & auction
app.use('/api/v1/notifications', require('./routes/notifications')); // Phase 4: In-app notifications
app.use('/api/v1/upload',        require('./routes/upload'));         // Phase 5: Verification doc upload (R2)

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { path: req.path, method: req.method, message: err.message, stack: err.stack });

  if (process.env.SENTRY_DSN) {
    const { Sentry } = require('./utils/sentry');
    Sentry.withScope((scope) => {
      if (req.user) {
        scope.setUser({ id: req.user._id?.toString(), email: req.user.email, role: req.user.role });
      }
      scope.setExtra('path', req.path);
      scope.setExtra('method', req.method);
      Sentry.captureException(err);
    });
  }

  const status = err.status || 500;
  const message = `${err.message} | Stack: ${err.stack}`;

  res.status(status).json({
    success: false,
    error: { code: err.code || 'INTERNAL_ERROR', message }
  });
});

const PORT = process.env.PORT || 3000;
const tenantLeaseCleanup = require('./cron/tenant-lease-cleanup');
const lateFeeApplicator = require('./cron/late-fee-applicator');

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' }));
  tenantLeaseCleanup.start();
  logger.info('Cron scheduled: tenant lease cleanup (daily 00:05 EAT)');
  lateFeeApplicator.start();
  logger.info('Cron scheduled: late fee applicator (daily 00:10 EAT)');
};
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
