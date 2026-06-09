const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  month: { type: String, required: true },
  amount_kes: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['paid', 'partial', 'overdue', 'waived'], required: true },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
}, { _id: false });

const kycDocumentSchema = new mongoose.Schema({
  type: { type: String, enum: ['id_front', 'id_back', 'passport_photo', 'employment_letter'] },
  url: String,
  uploaded_at: Date
}, { _id: false });

const tenantSchema = new mongoose.Schema({
  tenant_code: { type: String, unique: true, required: true },
  full_name: { type: String, required: true },
  id_number: { type: String, required: true },
  phone: { type: String, required: true },
  email: String,
  emergency_contact: {
    name: String,
    phone: String,
    relationship: String
  },
  kyc_verified: { type: Boolean, default: false },
  kyc_documents: [kycDocumentSchema],
  current_unit_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property.units' },
  current_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  lease_start: Date,
  lease_end: Date,
  rent_amount_kes: { type: Number, min: 0 },
  deposit_paid_kes: { type: Number, min: 0 },
  deposit_held: { type: Boolean, default: true },
  payment_history: [paymentHistorySchema],
  arrears_kes: { type: Number, default: 0, min: 0 },
  tenancy_status: { type: String, enum: ['active', 'terminated', 'notice', 'pending'], default: 'active' },
  notice_status:    { type: String, enum: ['none', '7_day', '30_day', 'eviction_pending'], default: 'none' },
  preferred_channel: { type: String, enum: ['email', 'sms', 'both'], default: 'both' },
  notes: String,
  guarantor: {
    full_name: String,
    phone: String,
    id_number: String,
    relationship: String
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Single index declarations — no duplicates
tenantSchema.index({ phone: 1 });
tenantSchema.index({ id_number: 1 });
tenantSchema.index({ current_unit_id: 1 });
tenantSchema.index({ current_property_id: 1 });
tenantSchema.index({ tenancy_status: 1 });

tenantSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);
