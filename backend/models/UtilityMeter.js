const mongoose = require('mongoose');

const utilityMeterSchema = new mongoose.Schema({
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  unit_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property.units', sparse: true },
  floor_number: Number,
  grouping_level: { type: String, enum: ['unit', 'floor', 'building'], default: 'unit' },
  meter_type: { type: String, enum: ['electricity', 'water'], required: true },
  provider: {
    type: String,
    enum: [
      'KPLC', 'Nairobi_Water', 'Mombasa_Water', 'Private_Submeter',
      'NAIROBI_WATER', 'MOMBASA_WATER', 'KIWASCO', 'ELDOWAS', 'RUIRU_JUJA_WATER', 'NAIVASHA_WATER',
      'KPLC_PREPAID', 'KPLC_POSTPAID'
    ],
    required: true
  },
  token_number: { type: String, required: true, index: true },
  connection_status: { type: String, enum: ['active', 'disconnected', 'pending', 'suspended'], default: 'active' },
  last_validated_at: { type: Date },
  tariff_category: { type: String, enum: ['domestic', 'commercial', 'industrial'], default: 'domestic' },
  provider_account_name: { type: String },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UtilityMeter', utilityMeterSchema);
