require("./instrument.js");
require('dotenv').config();
if (process.env.NODE_ENV !== 'production') {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
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

const compression = require('compression');
app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "unpkg.com", "*.clerk.accounts.dev", "clerk.mutune.co.ke"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com", "api.mapbox.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.tile.openstreetmap.org", "*.cloudflare.com", "*.mapbox.com", "img.clerk.com"],
      connectSrc: ["'self'", "*.mongodb.net", "*.sentry.io", "api.render.com", "api.mapbox.com", "events.mapbox.com", "*.clerk.accounts.dev", "clerk.mutune.co.ke", "api.moonshot.ai"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

const ALLOWED_ORIGINS = [
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  'https://mutunerent-web.vercel.app',
  'https://mutunerent-web-mishael-s-alpha.vercel.app',
  'https://mutune-alpha.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const isVercelSubdomain = /^https:\/\/(mutunerent|mutune)(-[a-zA-Z0-9_-]+)*\.vercel\.app$/.test(origin);
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

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    error: { code: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts. Try again later.' }
  })
});

// Relaxed rate limiter for high-volume webhooks and payment callbacks
const callbackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize);

app.get('/api/v1/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(dbStatus === 'connected' ? 200 : 503).json({
    success: dbStatus === 'connected',
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: dbStatus,
    uptime: Math.floor(process.uptime())
  });
});
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Step 8.1: OpenAPI / Swagger Documentation UI & JSON spec
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'MutuneRent Pro API Documentation'
}));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api/v1/payments', callbackLimiter, require('./routes/payments'));
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
app.use('/api/v1/scans',         require('./routes/scans'));          // Phase 5: 3D Scans
app.use('/api/v1/settings',      require('./routes/settings'));       // Financial Settings & Trial Balance
app.use('/api/v1/commission',    require('./routes/commission'));     // Agent Salary & Commission Payroll
app.use('/api/v1/disbursement',  require('./routes/disbursement'));   // Priority Bulk Disbursement Engine
app.use('/api/v1/paperwork',     require('./routes/paperwork'));      // Multi-Role Paperwork Suite & PDF Engine
app.use('/api/v1/tax',           require('./routes/tax'));            // KRA eTIMS Tax Compliance & Reporting Engine
app.use('/api/v1/vacation',      require('./routes/vacation'));       // Tenant Vacation & Move-Out Damage Survey Engine
app.use('/api/v1/exchange',      require('./routes/exchange'));       // CBK Live USD/KES Exchange Rate Engine
app.use('/api/v1/audit',         require('./routes/audit'));          // Audit Log Compliance Engine
app.use('/api/v1/utilities',     require('./routes/utilities'));      // Multi-Level Utility Submetering Engine
app.use('/api/v1/scoring',       require('./routes/scoring'));        // Tenant Financial Health Scoring Engine
app.use('/api/v1/vendors',       require('./routes/vendors'));        // Vendor Maintenance & B2C Payout Engine
app.use('/api/v1/bank-payments',  require('./routes/bankPayments'));   // Multi-Bank Checkout & Aggregator Webhooks
app.use('/api/v1/ussd',           require('./routes/ussd'));           // Africa's Talking USSD Gateway Handler
app.use('/api/v1/listings',       require('./routes/listings'));       // Public Property Listings & Inquiries

const Sentry = require("@sentry/node");

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { path: req.path, method: req.method, message: err.message, stack: err.stack });

  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (status >= 500 && isProduction) ? 'Internal server error' : (err.message || 'Internal server error');

  res.status(status).json({
    success: false,
    error: { code: err.code || 'INTERNAL_ERROR', message }
  });
});

const PORT = process.env.PORT || 3000;
const tenantLeaseCleanup = require('./cron/tenant-lease-cleanup');
const lateFeeApplicator = require('./cron/late-fee-applicator');
const accrueRent = require('./cron/accrueRent');

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    const ensureIndexes = require('./config/indexes');
    ensureIndexes().catch(err => logger.error('Index sync error', { error: err.message }));
  });
  tenantLeaseCleanup.start();
  logger.info('Cron scheduled: tenant lease cleanup (daily 00:05 EAT)');
  lateFeeApplicator.start();
  logger.info('Cron scheduled: late fee applicator (daily 00:10 EAT)');
  accrueRent.start();
  logger.info('Cron scheduled: monthly rent accrual (monthly 1st 00:01 EAT)');
};
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
