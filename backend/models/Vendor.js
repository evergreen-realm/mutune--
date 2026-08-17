const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  vendor_name: { type: String, required: true },
  category: { type: String, enum: ['plumbing', 'electrical', 'carpentry', 'painting', 'general'], required: true },
  phone: { type: String, required: true },
  email: String,
  mpesa_b2c_number: { type: String, required: true },
  bank_name: String,
  bank_account_number: String,
  rating: { type: Number, default: 4.5, min: 1, max: 5 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vendor', vendorSchema);
