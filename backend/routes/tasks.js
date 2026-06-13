const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Task = require('../models/Task');
const User = require('../models/User');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

/**
 * GET /api/v1/tasks/agent/my
 * Fetch all tasks assigned to the currently logged-in agent.
 * Returns today's tasks first, then upcoming, then overdue.
 */
router.get('/agent/my', requireAuth, requireRole(['agent']), async (req, res, next) => {
  try {
    const now = new Date();
    const tasks = await Task.find({ assigned_to: req.user._id })
      .populate('related_property_id', 'name property_code address')
      .populate('related_tenant_id', 'full_name tenant_code phone')
      .populate('assigned_by', 'full_name email')
      .sort({ due_date: 1 })
      .lean();

    // Auto-flag overdue tasks (due_date past and still pending/in_progress)
    const overdueIds = tasks
      .filter(t => new Date(t.due_date) < now && ['pending', 'in_progress'].includes(t.status))
      .map(t => t._id);

    if (overdueIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: overdueIds } },
        { $set: { status: 'overdue' } }
      );
      tasks.forEach(t => {
        if (overdueIds.some(id => id.toString() === t._id.toString())) {
          t.status = 'overdue';
        }
      });
    }

    const summary = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.status === 'overdue').length
    };

    res.json({ success: true, data: tasks, summary });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tasks
 * Admin: view all tasks with optional filters (agent_id, status, date range).
 */
router.get('/', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { agent_id, status, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (agent_id) filter.assigned_to = agent_id;
    if (status) filter.status = status;
    if (from || to) {
      filter.due_date = {};
      if (from) filter.due_date.$gte = new Date(from);
      if (to) filter.due_date.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assigned_to', 'full_name email phone')
        .populate('assigned_by', 'full_name email')
        .populate('related_property_id', 'name property_code')
        .populate('related_tenant_id', 'full_name tenant_code')
        .sort({ due_date: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Task.countDocuments(filter)
    ]);

    res.json({ success: true, data: tasks, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tasks
 * Admin assigns a task to an agent.
 */
router.post('/',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('assigned_to').isMongoId().withMessage('Invalid agent ID'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('type').isIn(['check_in', 'payment_followup', 'inspection', 'maintenance']).withMessage('Invalid type'),
    body('due_date').isISO8601().withMessage('Due date must be a valid ISO date')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { assigned_to, title, description, type, related_property_id, related_tenant_id, due_date } = req.body;

      // Verify agent exists
      const agent = await User.findOne({ _id: assigned_to, role: 'agent', is_active: true }).lean();
      if (!agent) {
        return res.status(404).json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found or inactive' } });
      }

      const task = await Task.create({
        assigned_to,
        assigned_by: req.user._id,
        title: title.trim(),
        description: description.trim(),
        type,
        related_property_id: related_property_id || null,
        related_unit_id: req.body.related_unit_id || null,
        related_tenant_id: related_tenant_id || null,
        due_date: new Date(due_date),
        status: 'pending'
      });

      const populated = await Task.findById(task._id)
        .populate('assigned_to', 'full_name email phone')
        .populate('assigned_by', 'full_name email')
        .populate('related_property_id', 'name property_code')
        .lean();

      logger.info('Task created', { taskId: task._id, assignedTo: assigned_to, by: req.user._id });
      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/tasks/:id/status
 * Agent updates task status (in_progress or completed). Admin can update any status.
 */
router.patch('/:id/status',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid task ID'),
    body('status').isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid status')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      }

      // Agents can only update their own tasks
      if (req.user.role === 'agent' && task.assigned_to.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own tasks' } });
      }

      task.status = req.body.status;
      if (req.body.status === 'completed') task.completed_at = new Date();
      await task.save();

      logger.info('Task status updated', { taskId: task._id, status: req.body.status, by: req.user._id });
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/tasks/:id
 * Admin deletes a task.
 */
router.delete('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  param('id').isMongoId(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const task = await Task.findByIdAndDelete(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      }
      logger.info('Task deleted', { taskId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
