const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const logger = require('../utils/logger');

/**
 * Auto-reconciliation algorithm matching incoming M-Pesa payment parameters
 * against active tenant leases with confidence scoring.
 */
async function autoReconcilePayment({ mpesa_code, phone, account_reference, amount_kes, raw_payload }) {
  const cleanPhone = phone ? phone.replace(/\+/g, '').replace(/^0/, '254') : '';
  const cleanRef = account_reference ? account_reference.trim().toUpperCase() : '';

  let matchResult = {
    matched_tenant_id: null,
    matched_property_id: null,
    matched_unit_id: null,
    confidence_score: 0,
    match_status: 'unmatched', // 'auto_matched' (>=95%), 'probable' (80-94%), 'unmatched' (<80%)
    match_reason: ''
  };

  // Rule 1: Exact Tenant Code Match (100% confidence)
  if (cleanRef) {
    const tenantByCode = await Tenant.findOne({ tenant_code: cleanRef, tenancy_status: 'active' }).lean();
    if (tenantByCode) {
      matchResult = {
        matched_tenant_id: tenantByCode._id,
        matched_property_id: tenantByCode.current_property_id,
        matched_unit_id: tenantByCode.current_unit_id,
        confidence_score: 100,
        match_status: 'auto_matched',
        match_reason: `Exact match on Tenant Code ${cleanRef}`
      };
      return matchResult;
    }

    // Rule 2: Exact Unit Number Match in active property units
    const propertyWithUnit = await Property.findOne({ 'units.unit_number': cleanRef }).lean();
    if (propertyWithUnit) {
      const matchedUnit = propertyWithUnit.units.find(u => u.unit_number?.toUpperCase() === cleanRef);
      if (matchedUnit && matchedUnit.current_tenant_id) {
        matchResult = {
          matched_tenant_id: matchedUnit.current_tenant_id,
          matched_property_id: propertyWithUnit._id,
          matched_unit_id: matchedUnit._id,
          confidence_score: 98,
          match_status: 'auto_matched',
          match_reason: `Exact match on Unit Number ${cleanRef}`
        };
        return matchResult;
      }
    }
  }

  // Rule 3: Phone Number Match on Active Tenant (95% confidence if amount matches rent)
  if (cleanPhone) {
    const tenantByPhone = await Tenant.findOne({ phone: cleanPhone, tenancy_status: 'active' }).lean();
    if (tenantByPhone) {
      const exactAmountMatch = Math.abs((tenantByPhone.rent_amount_kes || 0) - amount_kes) < 1;
      const confidence = exactAmountMatch ? 95 : 85;
      matchResult = {
        matched_tenant_id: tenantByPhone._id,
        matched_property_id: tenantByPhone.current_property_id,
        matched_unit_id: tenantByPhone.current_unit_id,
        confidence_score: confidence,
        match_status: confidence >= 95 ? 'auto_matched' : 'probable',
        match_reason: `Phone match on ${cleanPhone} ${exactAmountMatch ? '(Exact rent amount)' : '(Partial amount match)'}`
      };
      return matchResult;
    }
  }

  // Fallback: Add to Unmatched Payment Queue for Agent Manual Resolution
  logger.info('Payment could not be auto-reconciled, flagged for unmatched queue', { mpesa_code, phone, account_reference, amount_kes });
  return matchResult;
}

module.exports = {
  autoReconcilePayment
};
