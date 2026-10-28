const mongoose = require('mongoose');

const etimsInvoiceSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  payment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    index: true
  },
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  landlord_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  control_number: {
    type: String,
    index: true,
    trim: true
  },
  cu_serial_number: {
    type: String,
    trim: true
  },
  qr_code_url: {
    type: String,
    trim: true
  },
  transmission_status: {
    type: String,
    enum: ['pending', 'transmitted', 'failed', 'retrying'],
    default: 'pending',
    index: true
  },
  tax_type: {
    type: String,
    enum: ['mri', 'vat', 'exempt', 'wht'],
    default: 'mri',
    index: true
  },
  gross_amount_kes: {
    type: Number,
    required: true,
    min: 0
  },
  taxable_amount_kes: {
    type: Number,
    required: true,
    min: 0
  },
  tax_amount_kes: {
    type: Number,
    required: true,
    min: 0
  },
  tax_rate_percent: {
    type: Number,
    default: 7.5
  },
  customer_pin: {
    type: String,
    trim: true,
    default: 'P000000000X'
  },
  customer_name: {
    type: String,
    trim: true,
    default: 'Valued Tenant'
  },
  item_description: {
    type: String,
    trim: true,
    default: 'Monthly Rent Payment'
  },
  item_code: {
    type: String,
    trim: true
  },
  response_payload: {
    type: mongoose.Schema.Types.Mixed
  },
  error_message: {
    type: String
  },
  retry_count: {
    type: Number,
    default: 0
  },
  transmitted_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

etimsInvoiceSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

etimsInvoiceSchema.index({ landlord_id: 1, created_at: -1 });
etimsInvoiceSchema.index({ property_id: 1, created_at: -1 });
etimsInvoiceSchema.index({ transmission_status: 1, created_at: -1 });

module.exports = mongoose.models.EtimsInvoice
  || mongoose.model('EtimsInvoice', etimsInvoiceSchema);
