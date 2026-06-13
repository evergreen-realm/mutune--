const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['check_in', 'payment_followup', 'inspection', 'maintenance'], required: true },
  related_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  related_unit_id: { type: mongoose.Schema.Types.ObjectId },
  related_tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  due_date: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'overdue'], default: 'pending' },
  completed_at: Date,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);
