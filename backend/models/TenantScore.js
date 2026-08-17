const mongoose = require('mongoose');

const tenantScoreSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  credit_score: { type: Number, default: 85, min: 0, max: 100 },
  punctuality_rating: { type: String, enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'], default: 'GOOD' },
  on_time_payment_ratio_percent: { type: Number, default: 100 },
  total_months_tracked: { type: Number, default: 12 },
  payment_history_summary: [{
    billing_month: String,
    status: { type: String, enum: ['on_time', 'late', 'missed', 'waived'] },
    days_late: Number
  }],
  score_last_updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TenantScore', tenantScoreSchema);
