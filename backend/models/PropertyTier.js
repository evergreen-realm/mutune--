const mongoose = require('mongoose');

const propertyTierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_rent_kes: { type: Number, required: true },
  max_rent_kes: { type: Number, required: true },
  description: String,
  criteria: String, // e.g., 'Swimming pool, gym, parking'
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

propertyTierSchema.index({ is_active: 1 });
propertyTierSchema.index({ min_rent_kes: 1, max_rent_kes: 1 });

module.exports = mongoose.model('PropertyTier', propertyTierSchema);
