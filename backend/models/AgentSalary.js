const mongoose = require('mongoose');

const agentSalarySchema = new mongoose.Schema({
  payroll_code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  billing_month: {
    type: String, // Format: YYYY-MM
    required: true,
    index: true
  },
  letting_commission_kes: {
    type: Number,
    default: 0,
    min: 0
  },
  management_commission_kes: {
    type: Number,
    default: 0,
    min: 0
  },
  renewal_commission_kes: {
    type: Number,
    default: 0,
    min: 0
  },
  initiation_fees_kes: {
    type: Number,
    default: 0,
    min: 0
  },
  gross_earnings_kes: {
    type: Number,
    required: true,
    min: 0
  },
  withholding_tax_kes: {
    type: Number,
    default: 0,
    min: 0
  },
  net_payable_kes: {
    type: Number,
    required: true,
    min: 0
  },
  payment_status: {
    type: String,
    enum: ['pending', 'approved', 'disbursed', 'failed'],
    default: 'pending'
  },
  mpesa_b2c_receipt: String,
  disbursed_at: Date,
  processed_by_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

agentSalarySchema.index({ agent_id: 1, billing_month: 1 }, { unique: true });

module.exports = mongoose.model('AgentSalary', agentSalarySchema);
