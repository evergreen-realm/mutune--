const mongoose = require('mongoose');

const callbackMetadataSchema = new mongoose.Schema({
  Item: [{ Name: String, Value: mongoose.Schema.Types.Mixed }]
}, { _id: false });

const mpesaCallbackSchema = new mongoose.Schema({
  ResultCode: Number,
  ResultDesc: String,
  CallbackMetadata: callbackMetadataSchema,
  received_at: { type: Date, default: Date.now }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  transaction_id: { type: String, unique: true, required: true },
  mpesa_receipt: { type: String },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  unit_id: { type: mongoose.Schema.Types.ObjectId },
  amount_cents: { type: Number, min: 0 },
  amount_kes: { type: Number, required: true, min: 0 },
  payment_type: { type: String, enum: ['rent', 'deposit', 'penalty', 'water', 'electricity', 'service_charge'], required: true },
  channel: { type: String, enum: ['mpesa_stk', 'mpesa_c2b', 'bank_transfer', 'cash', 'diaspora_wire'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'confirmed', 'failed', 'reversed', 'manual_override'], default: 'pending' },
  workflow_state: { type: String, enum: ['PENDING_VIEWING', 'VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'HOUSE_LOCKED', 'MANUAL_REVIEW'], default: 'PENDING_VIEWING' },
  mpesa_callback: mpesaCallbackSchema,
  verified_by_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verification_method: { type: String, enum: ['auto_mpesa', 'agent_geo', 'manual_override', 'bank_recon'] },
  verification_location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  },
  verification_photo: String,
  discrepancy_flag: { type: Boolean, default: false },
  discrepancy_reason: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Compound + geo indexes (single declarations only)
paymentSchema.index({ tenant_id: 1, status: 1 });
paymentSchema.index({ mpesa_receipt: 1 }, { unique: true, sparse: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ created_at: -1 });
paymentSchema.index({ 'verification_location.coordinates': '2dsphere' }, { sparse: true });
paymentSchema.index({ tenant_id: 1, created_at: -1 });
paymentSchema.index({ property_id: 1, status: 1 });
paymentSchema.index({ channel: 1 });
paymentSchema.index({ payment_type: 1 });
paymentSchema.index({ updated_at: -1 });

paymentSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
