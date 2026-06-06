const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_code: { type: String, unique: true, required: true },
  role: { type: String, enum: ['super_admin', 'admin', 'agent', 'landlord', 'accountant', 'tenant'], required: true, index: true },
  full_name: { type: String, required: true },
  email: { type: String, unique: true, required: true, index: true },
  phone: String,
  password_hash: String,
  earb_license: String,
  earb_verified: { type: Boolean, default: false },
  assigned_areas: [String],
  assigned_property_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  ai_memory_id: { type: String, unique: true, sparse: true },
  last_location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' },
    timestamp: Date,
    accuracy: Number
  },
  is_active: { type: Boolean, default: true },
  clerk_id: { type: String, unique: true, sparse: true, index: true },
  created_at: { type: Date, default: Date.now }
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ ai_memory_id: 1 });
userSchema.index({ 'last_location.coordinates': '2dsphere' });
userSchema.index({ clerk_id: 1 });

module.exports = mongoose.model('User', userSchema);
