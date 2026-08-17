const mongoose = require('mongoose');

const commissionConfigSchema = new mongoose.Schema({
  config_name: {
    type: String,
    default: 'GLOBAL_FINANCIAL_CONFIG',
    unique: true
  },
  withholding_tax_rate_resident: {
    type: Number,
    default: 7.5, // 7.5% KRA withholding tax for resident landlords
    min: 0,
    max: 100
  },
  withholding_tax_rate_non_resident: {
    type: Number,
    default: 10.0, // 10% for non-resident landlords
    min: 0,
    max: 100
  },
  letting_commission_percent: {
    type: Number,
    default: 100, // 100% of first month's rent
    min: 0,
    max: 200
  },
  management_commission_percent: {
    type: Number,
    default: 10.0, // 10% of monthly collected rent
    min: 0,
    max: 100
  },
  lease_renewal_commission_percent: {
    type: Number,
    default: 25.0, // 25% of one month's rent for renewals
    min: 0,
    max: 100
  },
  agent_initiation_fee_kes: {
    type: Number,
    default: 2500, // KES 2,500 onboarding initiation fee per property
    min: 0
  },
  agent_payroll_day_of_month: {
    type: Number,
    default: 28, // 28th of every month
    min: 1,
    max: 31
  },
  disbursement_priority: {
    type: [String],
    default: ['landlords', 'agents', 'suppliers', 'staff', 'tenants']
  },
  etims_pin: {
    type: String,
    trim: true
  },
  etims_device_serial: {
    type: String,
    trim: true
  },
  updated_by_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);
