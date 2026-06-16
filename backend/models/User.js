const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_code:   { type: String, unique: true, required: true },
  role:        { type: String, enum: ['super_admin', 'admin', 'agent', 'landlord', 'accountant', 'tenant'], required: false, index: true },
  full_name:   { type: String, required: true },
  email:       { type: String, unique: true, required: true },
  phone:       String,
  password_hash: String,
  earb_license:  String,
  earb_verified: { type: Boolean, default: false },
  earb_verification_doc_url: String,
  agent_approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'n_a'], default: 'n_a' },
  agent_rejection_reason: String,
  agent_allow_all_areas: { type: Boolean, default: false },
  landlord_id:   { type: String, unique: true, sparse: true },
  landlord_approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'n_a'], default: 'pending', index: true },
  landlord_verification_doc_url: String,
  admin_hardcoded_hash: String,
  assigned_areas:       [String],
  assigned_property_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  ai_memory_id: { type: String, unique: true, sparse: true },
  current_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  current_unit_id:     { type: mongoose.Schema.Types.ObjectId },
  // GPS check-in state (Phase 2)
  last_location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    accuracy:    Number,
    recorded_at: Date
  },
  last_checkin_photo: String,
  is_active: { type: Boolean, default: true },
  clerk_id:  { type: String, unique: true, sparse: true },
  created_at:{ type: Date, default: Date.now }
});

// Single centralized index definitions — no duplicates with field-level options
userSchema.index({ 'last_location.coordinates': '2dsphere' }, { sparse: true });

const bcrypt = require('bcryptjs');

userSchema.pre('save', async function (next) {
  if (['admin', 'super_admin'].includes(this.role) && !this.admin_hardcoded_hash) {
    const adminPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD || 'MutuneAdmin2026!';
    this.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);

