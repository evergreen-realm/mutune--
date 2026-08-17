const ipRangeCheck = require('ip-range-check');
const logger = require('../utils/logger');

const SAFARICOM_IPS = [
  '196.201.214.0/24',
  '196.201.215.0/24',
  '196.201.212.0/22',
  '41.215.160.0/20'
];

const requireSafaricomIP = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    return next();
  }
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  if (!SAFARICOM_IPS.some(cidr => ipRangeCheck(clientIp, cidr))) {
    logger.warn('Blocked M-Pesa callback from non-Safaricom IP', { ip: clientIp, path: req.path });
    return res.status(403).json({ success: false, error: { code: 'IP_BLOCKED', message: 'Unauthorized IP address' } });
  }
  next();
};

module.exports = { requireSafaricomIP };
