const mongoose = require('mongoose');
const { getAdminPassword, encryptPII, decryptPII, generateBlindIndex, normalizePhone, decryptLeanDoc } = require('../utils/security');
const logger = require('../utils/logger');

const userSchema = new mongoose.Schema({
  user_code:   { type: String, unique: true, required: true },
  role:        { type: String, enum: ['super_admin', 'admin', 'agent', 'landlord', 'accountant', 'tenant', 'caretaker'], required: false, index: true },
  full_name:   { type: String, required: true },
  email:       { type: String, unique: true, required: true },
  phone:       String,
  phone_bindex: String,
  id_number:   { type: String, get: decryptPII },
  id_number_bindex: String,
  password_hash: String,
  earb_license:  String,
  earb_verified: { type: Boolean, default: false },
  earb_verification_doc_url: String,
  agent_approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'n_a'], default: 'n_a' },
  agent_rejection_reason: String,
  agent_allow_all_areas: { type: Boolean, default: false },
  base_salary_kes: { type: Number, default: 0, min: 0 },
  letting_commission_rate: { type: Number, min: 0, max: 200 },
  management_commission_rate: { type: Number, min: 0, max: 100 },
  landlord_id:   { type: String, unique: true, sparse: true },
  landlord_approval_status: { type: String, enum: ['pending', 'approved', 'rejected', 'n_a'], default: 'n_a', index: true },
  landlord_verification_doc_url: String,
  bank_name:            String,
  bank_account_number:  String,
  bank_code:            String,
  admin_hardcoded_hash: String,
  assigned_areas:       [String],
  assigned_property_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  assigned_properties:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  ai_memory_id: { type: String, unique: true, sparse: true },
  current_property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  current_unit_id:     { type: mongoose.Schema.Types.ObjectId },
  // GPS check-in state (Phase 2)
  last_location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    accuracy:    Number,
    recorded_at: Date
  },
  profile_picture: String,
  last_checkin_photo: String,
  is_active: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  clerk_id:  { type: String, unique: true, sparse: true },
  created_at:{ type: Date, default: Date.now }
}, { toJSON: { getters: true }, toObject: { getters: true } });

// Single centralized index definitions — no duplicates with field-level options
userSchema.index({ 'last_location.coordinates': '2dsphere' }, { sparse: true });
userSchema.index({ role: 1, is_active: 1 });
userSchema.index({ agent_approval_status: 1 });
userSchema.index({ is_deleted: 1 }, { sparse: true });
userSchema.index({ created_at: -1 });
userSchema.index({ id_number_bindex: 1 }, { sparse: true });
userSchema.index({ phone_bindex: 1 }, { sparse: true });

function applyUserBlindIndexToFilter(filter) {
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

userSchema.pre(/^find/, function(next) {
  applyUserBlindIndexToFilter(this.getQuery());
  if (typeof next === 'function') next();
});
userSchema.pre('countDocuments', function(next) {
  applyUserBlindIndexToFilter(this.getQuery());
  if (typeof next === 'function') next();
});

userSchema.post(/^find/, function(res) {
  if (res) decryptLeanDoc(res);
});
userSchema.post('aggregate', function(res) {
  if (res) decryptLeanDoc(res);
});

userSchema.pre('validate', function (next) {
  if (!this.user_code) {
    const timestamp = Date.now().toString().slice(-4);
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.user_code = `USR-AUTO-${timestamp}-${rand}`;
  }
  next();
});

const bcrypt = require('bcryptjs');

userSchema.pre('save', async function (next) {
  if (this.id_number && (this.isModified('id_number') || !this._doc.id_number || !this._doc.id_number.startsWith('enc:'))) {
    this.id_number_bindex = generateBlindIndex(this.id_number);
    this.id_number = encryptPII(this.id_number);
  }
  if (this.phone && (this.isModified('phone') || !this.phone_bindex)) {
    const norm = normalizePhone(this.phone);
    this.phone_bindex = generateBlindIndex(norm || this.phone);
  }

  if (['admin', 'super_admin'].includes(this.role) && !this.admin_hardcoded_hash) {
    if (process.env.NODE_ENV !== 'production' && (process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD)) {
      try {
        const adminPass = getAdminPassword();
        this.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
      } catch (err) {
        logger.warn('Skipped admin hardcoded hash auto-generation', { error: err.message });
      }
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);

