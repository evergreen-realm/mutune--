const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  account_code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  account_name: {
    type: String,
    required: true,
    trim: true
  },
  account_type: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
    lowercase: true
  },
  account_subtype: {
    type: String,
    enum: [
      'current_asset', 'fixed_asset', 'bank', 'cash', 'accounts_receivable',
      'current_liability', 'tenant_deposit_liability', 'accounts_payable',
      'owner_equity', 'rental_income', 'commission_income', 'late_fee_income',
      'maintenance_expense', 'management_expense', 'utility_expense', 'tax_expense'
    ],
    required: true
  },
  balance_kes: {
    type: Number,
    default: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

accountSchema.index({ account_type: 1, is_active: 1 });

module.exports = mongoose.model('Account', accountSchema);
