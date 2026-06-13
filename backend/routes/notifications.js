const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * GET /api/v1/notifications
 * Returns notifications scoped to the requesting user's role and ID.
 * Admins see admin-role notifications, agents see agent-role, etc.
 * Returns max 50, newest first, unread count in response.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    // Match notifications where either:
    // - recipient_role matches user's role AND (recipient_ids is empty OR contains this user)
    const notifications = await Notification.find({
      recipient_role: role,
      $or: [
        { recipient_ids: { $size: 0 } },
        { recipient_ids: userId }
      ]
    })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter(n => !n.read_by.some(id => id.toString() === userId.toString())).length;

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a specific notification as read by the current user.
 */
router.patch('/:id/read',
  requireAuth,
  param('id').isMongoId().withMessage('Invalid notification ID'),
  async (req, res, next) => {
    try {
      const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { read_by: req.user._id } },
        { new: true }
      );
      if (!notification) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all of the current user's notifications as read.
 */
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    await Notification.updateMany(
      {
        recipient_role: role,
        $or: [{ recipient_ids: { $size: 0 } }, { recipient_ids: userId }],
        read_by: { $ne: userId }
      },
      { $addToSet: { read_by: userId } }
    );

    logger.info('All notifications marked read', { userId });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/notifications (internal / admin use)
 * Admin can broadcast a notification to a role.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    }
    const { type, recipient_role, recipient_ids, title, message, related_entity_id } = req.body;
    const notification = await Notification.create({
      type,
      recipient_role,
      recipient_ids: recipient_ids || [],
      title,
      message,
      related_entity_id: related_entity_id || null
    });
    logger.info('Notification created', { notifId: notification._id, by: req.user._id });
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
