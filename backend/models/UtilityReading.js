const mongoose = require('mongoose');

const utilityReadingSchema = new mongoose.Schema({
  meter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UtilityMeter', required: false, index: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  unit_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property.units' },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  reading_date: { type: Date, default: Date.now, index: true },
  billing_month: { type: String, required: true }, // Format YYYY-MM
  previous_reading: { type: Number, default: 0 },
  current_reading: { type: Number, required: true },
  consumption_units: { type: Number, required: true },
  rate_per_unit_kes: { type: Number, required: true },
  total_amount_kes: { type: Number, required: true },
  is_billed: { type: Boolean, default: false }
});

module.exports = mongoose.model('UtilityReading', utilityReadingSchema);
