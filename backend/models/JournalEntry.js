const mongoose = require('mongoose');

const journalLineItemSchema = new mongoose.Schema({
  account_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  account_code: {
    type: String,
    required: true
  },
  debit_kes: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  credit_kes: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  description: String
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
  entry_code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  posting_date: {
    type: Date,
    default: Date.now,
    required: true
  },
  reference_type: {
    type: String,
    enum: ['rent_payment', 'landlord_remittance', 'agent_payroll', 'supplier_expense', 'deposit_refund', 'manual_adjustment'],
    required: true
  },
  reference_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    index: true
  },
  line_items: {
    type: [journalLineItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length >= 2;
      },
      message: 'Journal entry must have at least 2 line items (debit and credit)'
    }
  },
  total_debit_kes: {
    type: Number,
    required: true,
    min: 0
  },
  total_credit_kes: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'posted', 'voided'],
    default: 'posted'
  },
  posted_by_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

journalEntrySchema.pre('validate', function(next) {
  if (this.line_items && this.line_items.length > 0) {
    let sumDebit = 0;
    let sumCredit = 0;
    this.line_items.forEach(item => {
      sumDebit += Number(item.debit_kes || 0);
      sumCredit += Number(item.credit_kes || 0);
    });
    this.total_debit_kes = Number(sumDebit.toFixed(2));
    this.total_credit_kes = Number(sumCredit.toFixed(2));

    if (Math.abs(this.total_debit_kes - this.total_credit_kes) > 0.001) {
      return next(new Error(`Unbalanced double-entry journal: Total Debit (KES ${this.total_debit_kes}) does not equal Total Credit (KES ${this.total_credit_kes})`));
    }
  }
  next();
});

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
