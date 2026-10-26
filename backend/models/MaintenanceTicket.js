const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  ticket_code:         { type: String, unique: true, required: true },
  title:               { type: String, maxlength: 200 },
  property_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: false },
  unit_id:             { type: mongoose.Schema.Types.ObjectId, required: false },
  unit_code:           { type: String, required: false },
  tenant_id:           { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false },
  created_by:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  category: {
    type: String,
    enum: ['plumbing', 'electrical', 'structural', 'security', 'appliance', 'pest_control', 'cleaning', 'carpentry', 'general', 'painting', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency', 'urgent'],
    default: 'medium'
  },
  description:          { type: String, required: true, maxlength: 2000 },
  photos:               [String],
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'pending_parts', 'resolved', 'closed', 'tenant_disputed'],
    default: 'open'
  },
  assigned_agent_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_vendor_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  work_order_status:    { type: String, enum: ['unassigned', 'dispatched', 'in_progress', 'completed', 'approved', 'rejected'], default: 'unassigned' },
  estimated_cost_kes:   { type: Number, min: 0 },
  actual_cost_kes:      { type: Number, min: 0 },
  invoice_url:          String,
  vendor_invoice_url:   String,
  vendor_payout_status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  vendor_payout_ref:    String,
  agent_notes:          String,
  tenant_satisfaction:  { type: Number, min: 1, max: 5 },
  created_at:           { type: Date, default: Date.now },
  updated_at:           { type: Date, default: Date.now },
  resolved_at:          Date
});

maintenanceSchema.index({ property_id: 1, status: 1 });
maintenanceSchema.index({ tenant_id: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ created_by: 1 });
maintenanceSchema.index({ assigned_vendor_id: 1 }, { sparse: true });

maintenanceSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

// Use mongoose.models to prevent model recompilation in hot-reload contexts
module.exports = mongoose.models.MaintenanceTicket
  || mongoose.model('MaintenanceTicket', maintenanceSchema);
