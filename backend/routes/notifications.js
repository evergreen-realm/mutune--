const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { paginate } = require('../utils/paginate');

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Get notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of notifications with unread count
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;
    const role = req.user.role;

    const filter = {
      recipient_role: role,
      $or: [
        { recipient_ids: { $size: 0 } },
        { recipient_ids: userId }
      ],
      dismissed_by: { $ne: userId }
    };

    const result = await paginate(Notification, filter, {
      page,
      limit,
      sort: { created_at: -1 }
    });

    const unreadCount = await Notification.countDocuments({
      ...filter,
      read_by: { $ne: userId }
    });

    res.json({ success: true, ...result, unreadCount });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
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
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
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
 * @openapi
 * /notifications:
 *   post:
 *     summary: Broadcast or send notification (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - recipient_role
 *               - title
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *               recipient_role:
 *                 type: string
 *               recipient_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created
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

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     summary: Dismiss or delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification dismissed
 */
router.delete('/:id',
  requireAuth,
  param('id').isMongoId().withMessage('Invalid notification ID'),
  async (req, res, next) => {
    try {
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
      await Notification.findByIdAndUpdate(
        req.params.id,
        {
          $addToSet: {
            read_by: req.user._id,
            dismissed_by: req.user._id
          }
        }
      );
      logger.info('Notification dismissed', { notifId: req.params.id, userId: req.user._id });
      res.json({ success: true, message: 'Notification dismissed' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /notifications:
 *   delete:
 *     summary: Dismiss all notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications dismissed
 */
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    await Notification.updateMany(
      {
        recipient_role: role,
        $or: [{ recipient_ids: { $size: 0 } }, { recipient_ids: userId }]
      },
      { $addToSet: { read_by: userId, dismissed_by: userId } }
    );

    logger.info('All notifications cleared', { userId });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
