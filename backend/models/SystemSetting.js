const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. 'customer_care'
  value: { type: String, required: true },
  description: String,
  updated_at: { type: Date, default: Date.now }
});

systemSettingSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
