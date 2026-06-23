const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');
const logger = require('../utils/logger');

const requireAuth = async (req, res, next) => {
  try {
    await ClerkExpressRequireAuth()(req, res, async (err) => {
      if (err) {
        logger.warn('Clerk auth failed', { message: err.message });
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      const clerkId = req.auth?.userId;
      if (!clerkId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No user ID in token' } });
      }
      const user = await User.findOne({ clerk_id: clerkId }).lean();
      if (!user) {
        logger.warn('User not found in database', { clerkId });
        return res.status(403).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not registered in system' } });
      }
      if (!user.is_active) {
        logger.warn('Inactive account access attempt', { userId: user._id });
        return res.status(403).json({ success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Account deactivated' } });
      }
      if (user.is_deleted) {
        logger.warn('Deleted account access attempt', { userId: user._id });
        return res.status(403).json({ success: false, error: { code: 'ACCOUNT_DELETED', message: 'Account has been deleted' } });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Auth middleware error', { message: error.message, stack: error.stack });
    return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: error.message } });
  }
};

const verifyClerkToken = async (req, res, next) => {
  try {
    await ClerkExpressRequireAuth()(req, res, async (err) => {
      if (err) {
        logger.warn('Clerk token verification failed', { message: err.message });
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      next();
    });
  } catch (error) {
    logger.error('Token verification middleware error', { message: error.message, stack: error.stack });
    return res.status(401).json({ success: false, error: { code: 'AUTH_ERROR', message: error.message } });
  }
};

module.exports = { requireAuth, verifyClerkToken };
