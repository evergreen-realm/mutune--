const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['property_approval', 'maintenance_urgent', 'payment_alert', 'agent_approval', 'general'], required: true },
  recipient_role: { type: String, enum: ['admin', 'agent', 'landlord', 'tenant'], required: true },
  recipient_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  title: { type: String, required: true },
  message: { type: String, required: true },
  related_entity_id: { type: mongoose.Schema.Types.ObjectId },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
