require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } })
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/v1/payments', require('./routes/payments'));
app.use('/api/v1/properties', require('./routes/properties'));
app.use('/api/v1/properties', require('./routes/properties-gps'));   // Phase 2: GPS capture
app.use('/api/v1/tenants', require('./routes/tenants'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/agents', require('./routes/agents'));              // Phase 2: check-in
app.use('/api/v1/admin', require('./routes/admin'));                // Phase 2: charts
app.use('/api/v1/maintenance', require('./routes/maintenance'));    // Phase 2: tickets
app.use('/api/v1/reports', require('./routes/reports'));            // Phase 2: KRA CSV

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { path: req.path, method: req.method, message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Internal server error' }
  });
});

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' }));
};
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
