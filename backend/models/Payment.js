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
  transaction_id: { type: String, unique: true, required: true, index: true },
  mpesa_receipt: { type: String, index: true },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', index: true },
  unit_id: { type: mongoose.Schema.Types.ObjectId, index: true },
  amount_kes: { type: Number, required: true, min: 0 },
  payment_type: { type: String, enum: ['rent', 'deposit', 'penalty', 'water', 'electricity', 'service_charge'], required: true },
  channel: { type: String, enum: ['mpesa_stk', 'mpesa_c2b', 'bank_transfer', 'cash', 'diaspora_wire'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'confirmed', 'failed', 'reversed', 'manual_override'], default: 'pending', index: true },
  workflow_state: { type: String, enum: ['PENDING_VIEWING', 'VIEWED_UNLOCKED', 'PAYMENT_CONFIRMED', 'HOUSE_LOCKED', 'MANUAL_REVIEW'], default: 'PENDING_VIEWING' },
  mpesa_callback: mpesaCallbackSchema,
  verified_by_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verification_method: { type: String, enum: ['auto_mpesa', 'agent_geo', 'manual_override', 'bank_recon'] },
  verification_location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  verification_photo: String,
  discrepancy_flag: { type: Boolean, default: false },
  discrepancy_reason: String,
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

paymentSchema.index({ tenant_id: 1, status: 1 });
paymentSchema.index({ mpesa_receipt: 1 });
paymentSchema.index({ 'verification_location.coordinates': '2dsphere' });

paymentSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
