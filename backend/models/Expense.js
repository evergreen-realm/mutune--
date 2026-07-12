const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  category: {
    type: String,
    enum: ['maintenance', 'utilities', 'taxes', 'management', 'other'],
    required: true
  },
  amount_kes: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  vendor_name: { type: String, trim: true },
  payment_date: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['paid', 'pending'],
    default: 'paid'
  },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expense', expenseSchema);
