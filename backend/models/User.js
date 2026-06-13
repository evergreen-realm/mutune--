const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_code:   { type: String, unique: true, required: true },
  role:        { type: String, enum: ['super_admin', 'admin', 'agent', 'landlord', 'accountant', 'tenant'], required: true },
  full_name:   { type: String, required: true },
  email:       { type: String, unique: true, required: true },
  phone:       String,
  password_hash: String,
  earb_license:  String,
  earb_verified: { type: Boolean, default: false },
  earb_verification_doc_url: String,
  agent_approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'n_a'], default: 'n_a' },
  agent_rejection_reason: String,
  assigned_areas:       [String],
  assigned_property_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  ai_memory_id: { type: String, sparse: true },
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
  clerk_id:  { type: String, sparse: true },
  created_at:{ type: Date, default: Date.now }
});

// Single centralized index definitions — no duplicates with field-level options
userSchema.index({ email:         1 }, { unique: true });
userSchema.index({ clerk_id:      1 }, { unique: true, sparse: true });
userSchema.index({ ai_memory_id:  1 }, { unique: true, sparse: true });
userSchema.index({ role:          1 });
userSchema.index({ 'last_location.coordinates': '2dsphere' }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
