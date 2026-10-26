const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  month: { type: String, required: true },
  amount_kes: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['paid', 'partial', 'overdue', 'waived'], required: true },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
}, { _id: false });

const kycDocumentSchema = new mongoose.Schema({
  type: { type: String, enum: ['id_front', 'id_back', 'passport_photo', 'employment_letter'] },
  url: String,
  uploaded_at: Date
}, { _id: false });

const { encryptPII, decryptPII, generateBlindIndex, normalizePhone, decryptLeanDoc } = require('../utils/security');

const tenantSchema = new mongoose.Schema({
  tenant_code: { type: String, unique: true, required: true },
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  full_name: { type: String, required: true },
  id_number: { type: String, required: true, get: decryptPII },
  id_number_bindex: { type: String },
  phone: { type: String, required: true, get: decryptPII },
  phone_bindex: { type: String },
  email: String,
  emergency_contact: {
    name: String,
    phone: String,
    relationship: String
  },
  kyc_verified: { type: Boolean, default: false },
  kyc_documents: [kycDocumentSchema],
  current_unit_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property.units' },
  current_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  lease_start: Date,
  lease_end: Date,
  rent_amount_kes: { type: Number, min: 0 },
  deposit_paid_kes: { type: Number, min: 0 },
  deposit_kes: { type: Number, min: 0 },
  deposit_amount_kes: { type: Number, min: 0 },
  deposit_held: { type: Boolean, default: true },
  payment_history: [paymentHistorySchema],
  arrears_kes: { type: Number, default: 0, min: 0 },
  tenancy_status: {
    type: String,
    enum: ['active', 'terminated', 'notice', 'notice_period', 'pending', 'pending_move_in', 'expired', 'departed', 'vacated', 'evicted', 'ended'],
    default: 'active'
  },
  departed_at: Date,
  notice_status:    { type: String, enum: ['none', '7_day', '30_day', 'eviction_pending'], default: 'none' },
  preferred_channel: { type: String, enum: ['email', 'sms', 'both'], default: 'both' },
  notes: String,
  guarantor: {
    full_name: String,
    phone: String,
    id_number: String,
    relationship: String
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { toJSON: { getters: true }, toObject: { getters: true } });

// Single index declarations — no duplicates
tenantSchema.index({ phone_bindex: 1 }, { sparse: true });
tenantSchema.index({ email: 1 }, { sparse: true });
tenantSchema.index({ id_number_bindex: 1 }, { sparse: true });
tenantSchema.index({ current_unit_id: 1 });
tenantSchema.index({ current_property_id: 1 });
tenantSchema.index({ tenancy_status: 1 });

function applyBlindIndexToFilter(filter) {
  if (!filter || typeof filter !== 'object') return;

  const andClauses = [];

  if (filter.phone && typeof filter.phone === 'string' && !filter.phone.startsWith('enc:')) {
    const raw = filter.phone;
    const bindex = generateBlindIndex(raw);
    const norm = normalizePhone(raw);
    const normBindex = norm ? generateBlindIndex(norm) : null;
    delete filter.phone;
    const phoneOr = [{ phone_bindex: bindex }, { phone: raw }];
    if (normBindex && normBindex !== bindex) {
      phoneOr.push({ phone_bindex: normBindex }, { phone: norm });
    }
    andClauses.push({ $or: phoneOr });
  }

  if (filter.id_number && typeof filter.id_number === 'string' && !filter.id_number.startsWith('enc:')) {
    const raw = filter.id_number;
    const bindex = generateBlindIndex(raw);
    delete filter.id_number;
    andClauses.push({
      $or: [{ id_number_bindex: bindex }, { id_number: raw }]
    });
  }

  if (Array.isArray(filter.$or)) {
    const updatedOr = [];
    for (const item of filter.$or) {
      if (item && typeof item === 'object') {
        if (item.phone && typeof item.phone === 'string' && !item.phone.startsWith('enc:')) {
          const raw = item.phone;
          const bindex = generateBlindIndex(raw);
          const norm = normalizePhone(raw);
          const normBindex = norm ? generateBlindIndex(norm) : null;
          const phoneOr = [{ phone_bindex: bindex }, { phone: raw }];
          if (normBindex && normBindex !== bindex) {
            phoneOr.push({ phone_bindex: normBindex }, { phone: norm });
          }
          const { phone: _, ...rest } = item;
          if (Object.keys(rest).length === 0) {
            updatedOr.push(...phoneOr);
          } else {
            updatedOr.push({ ...rest, $or: phoneOr });
          }
          continue;
        }
        if (item.id_number && typeof item.id_number === 'string' && !item.id_number.startsWith('enc:')) {
          const raw = item.id_number;
          const bindex = generateBlindIndex(raw);
          const { id_number: _, ...rest } = item;
          if (Object.keys(rest).length === 0) {
            updatedOr.push({ id_number_bindex: bindex }, { id_number: raw });
          } else {
            updatedOr.push({ ...rest, $or: [{ id_number_bindex: bindex }, { id_number: raw }] });
          }
          continue;
        }
      }
      updatedOr.push(item);
    }
    filter.$or = updatedOr;
  }

  if (andClauses.length > 0) {
    if (andClauses.length === 1 && !filter.$or && !filter.$and) {
      filter.$or = andClauses[0].$or;
    } else {
      filter.$and = filter.$and || [];
      if (filter.$or) {
        filter.$and.push({ $or: filter.$or });
        delete filter.$or;
      }
      filter.$and.push(...andClauses);
    }
  }
}

tenantSchema.pre(/^find/, function(next) {
  applyBlindIndexToFilter(this.getQuery());
  if (typeof next === 'function') next();
});
tenantSchema.pre('countDocuments', function(next) {
  applyBlindIndexToFilter(this.getQuery());
  if (typeof next === 'function') next();
});
tenantSchema.pre('count', function(next) {
  applyBlindIndexToFilter(this.getQuery());
  if (typeof next === 'function') next();
});

tenantSchema.post(/^find/, function(res) {
  if (res) decryptLeanDoc(res);
});
tenantSchema.post('aggregate', function(res) {
  if (res) decryptLeanDoc(res);
});

tenantSchema.pre('save', function(next) {
  this.updated_at = Date.now();

  const dep = this.deposit_paid_kes ?? this.deposit_kes ?? this.deposit_amount_kes;
  if (dep !== undefined) {
    this.deposit_paid_kes = dep;
    this.deposit_kes = dep;
    this.deposit_amount_kes = dep;
  }

  // Generate blind indexes before encrypting fields
  if (this.id_number && (this.isModified('id_number') || !this._doc.id_number || !this._doc.id_number.startsWith('enc:'))) {
    this.id_number_bindex = generateBlindIndex(this.id_number);
    this.id_number = encryptPII(this.id_number);
  }
  if (this.phone && (this.isModified('phone') || !this._doc.phone || !this._doc.phone.startsWith('enc:'))) {
    const norm = normalizePhone(this.phone);
    this.phone_bindex = generateBlindIndex(norm || this.phone);
    this.phone = encryptPII(this.phone);
  }

  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);
