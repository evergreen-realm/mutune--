const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unit_number: { type: String, required: true },
  unit_type: String,
  bedrooms: Number,
  bathrooms: Number,
  floor: Number,
  size_sqft: Number,
  size_sqm: Number,
  rent_kes: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['vacant', 'occupied', 'maintenance', 'notice_issued'], default: 'vacant' },
  current_tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  lock_status: { type: String, enum: ['unlocked', 'pending_viewing', 'viewed_unlocked', 'payment_confirmed', 'locked'], default: 'unlocked' },
  unit_geolocation: {
    type:        { type: String, enum: ['Point'], default: undefined },
    coordinates: { type: [Number], default: undefined }  // [longitude, latitude]
  }
}, { _id: true });

const inventoryItemSchema = new mongoose.Schema({
  item_id: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['furniture', 'electronics', 'fixture', 'appliance', 'other'], default: 'other' },
  condition: { type: String, enum: ['new', 'good', 'fair', 'damaged', 'auctionable'], default: 'good' },
  auctionable: { type: Boolean, default: false },
  auctionable_marked_at: Date,
  auctionable_reason: String,
  auction_status: { type: String, enum: ['pending', 'sold', 'reclaimed', 'disposed'], default: 'pending' },
  auction_sold_at: Date,
  auction_buyer: String,
  auction_sale_amount: Number,
  reclaimed_at: Date,
  reclaim_receipt_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  unit_id: { type: mongoose.Schema.Types.ObjectId },
  estimated_value_kes: Number,
  photos: [String],
  added_date: { type: Date, default: Date.now },
  last_audit_date: Date,
  audit_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const propertySchema = new mongoose.Schema({
  property_code: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio', 'house', 'single'], required: true },
  address: {
    street: String,
    area: String,
    city: { type: String, default: 'Mombasa' },
    county: { type: String, default: 'Mombasa County' },
    plus_code: String
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  boundaries: {
    type: { type: String, enum: ['Polygon'] },
    coordinates: { type: [[[Number]]] }
  },
  units: [unitSchema],
  landlord_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  agent_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inventory: [inventoryItemSchema],
  amenities: [String],
  status: { type: String, enum: ['pending_admin_approval', 'active', 'inactive'], default: 'active' },
  contract_pdf_url: String,
  tier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyTier' },
  proposed_tier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyTier' },
  tier_approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tier_approved_at: Date,
  review_status: { type: String, enum: ['pending_agent', 'pending_admin', 'approved', 'rejected'], default: 'pending_agent' },
  photos: [String],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

propertySchema.index({ location: '2dsphere' });
propertySchema.index({ 'units.unit_geolocation': '2dsphere' }); // Phase 4: per-unit spatial index
propertySchema.index({ property_code: 1 });
propertySchema.index({ landlord_id: 1 });
propertySchema.index({ 'units.current_tenant_id': 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ review_status: 1 });
propertySchema.index({ tier_id: 1 }, { sparse: true });
propertySchema.index({ proposed_tier_id: 1 }, { sparse: true });
propertySchema.index({ type: 1 });
propertySchema.index({ 'address.area': 1 });
propertySchema.index({ 'address.city': 1 });
propertySchema.index({ created_at: -1 });
propertySchema.index({ updated_at: -1 });

propertySchema.pre('validate', function(next) {
  if (this.location && (!this.location.coordinates || this.location.coordinates.length === 0)) {
    this.location = undefined;
  }
  if (this.inventory && this.inventory.length > 0) {
    this.inventory.forEach(item => {
      if (!item.item_id) {
        item.item_id = item._id ? item._id.toString() : new mongoose.Types.ObjectId().toString();
      }
    });
  }
  next();
});

propertySchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Property', propertySchema);
