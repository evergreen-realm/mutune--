const mongoose = require('mongoose');

const damageItemSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  condition: { type: String, enum: ['good', 'fair', 'damaged', 'missing'], required: true },
  repair_cost_kes: { type: Number, default: 0, min: 0 },
  photo_url: String,
  notes: String
});

const damageInspectionReportSchema = new mongoose.Schema({
  report_code: { type: String, required: true, unique: true, uppercase: true },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  unit_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inspection_date: { type: Date, default: Date.now },
  vacate_notice_date: Date,
  
  deposit_paid_kes: { type: Number, required: true, min: 0 },
  total_damage_deductions_kes: { type: Number, default: 0, min: 0 },
  unpaid_utility_deductions_kes: { type: Number, default: 0, min: 0 },
  net_deposit_refund_kes: { type: Number, required: true },
  
  damages: [damageItemSchema],
  
  refund_status: { type: String, enum: ['pending_review', 'approved', 'refunded', 'disputed'], default: 'pending_review' },
  refund_mpesa_b2c_receipt: String,
  gl_journal_entry_id: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  
  agent_notes: String,
  tenant_signed_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('DamageInspectionReport', damageInspectionReportSchema);
