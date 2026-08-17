const mongoose = require('mongoose');

const leaseSignatureSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  unit_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  document_type: {
    type: String,
    default: 'lease_agreement'
  },
  signing_status: {
    type: String,
    enum: ['pending_otp', 'signed', 'rejected'],
    default: 'pending_otp',
    index: true
  },
  otp_code_hash: String,
  otp_expires_at: Date,
  signer_phone: String,
  signer_name: String,
  signer_ip: String,
  signed_at: Date,
  verification_hash: String,
  attestation_text: String,
  stamp_duty_kes: Number,
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LeaseSignature', leaseSignatureSchema);
