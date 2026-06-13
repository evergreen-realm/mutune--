const mongoose = require('mongoose');

const lateFeeRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grace_days: { type: Number, default: 5 },
  penalty_type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  penalty_value: { type: Number, required: true },
  max_penalty_per_month: { type: Number },
  applies_to: { type: String, enum: ['all', 'residential', 'commercial'], default: 'all' },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LateFeeRule', lateFeeRuleSchema);
