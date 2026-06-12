const mongoose = require('mongoose');

const deliveryStatusSchema = new mongoose.Schema({
  method: { type: String, enum: ['sms', 'email', 'portal', 'whatsapp'], required: true },
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
  timestamp: Date,
  provider_message_id: String
}, { _id: false });

const noticeSchema = new mongoose.Schema({
  notice_type: {
    type: String,
    enum: ['rent_increase', 'maintenance', 'eviction', 'lease_renewal', 'entry_inspection', 'general'],
    required: true
  },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  unit_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 5000 },
  delivery_method: [{ type: String, enum: ['sms', 'email', 'portal', 'whatsapp'] }],
  delivery_status: [deliveryStatusSchema],
  pdf_url: String,
  requires_acknowledgment: { type: Boolean, default: true },
  tenant_acknowledged: { type: Boolean, default: false },
  acknowledged_at: Date,
  effective_date: { type: Date, required: true },
  expiry_date: Date,
  legal_basis: { type: String, maxlength: 500 },
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

noticeSchema.index({ tenant_id: 1, created_at: -1 });
noticeSchema.index({ notice_type: 1 });
noticeSchema.index({ 'delivery_status.status': 1 });

noticeSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Notice', noticeSchema);
