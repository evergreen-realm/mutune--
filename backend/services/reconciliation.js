const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const logger = require('../utils/logger');
const { generateBlindIndex, normalizePhone, decryptPII } = require('../utils/security');

/**
 * Auto-reconciliation algorithm matching incoming M-Pesa payment parameters
 * against active tenant leases with confidence scoring.
 */
async function autoReconcilePayment({ mpesa_code, phone, account_reference, amount_kes, raw_payload }) {
  const cleanPhone = phone ? phone.replace(/\+/g, '').replace(/^0/, '254').trim() : '';
  const cleanRef = account_reference ? account_reference.trim().toUpperCase() : '';
  const parsedAmount = Number(amount_kes || 0);

  let matchResult = {
    matched_tenant_id: null,
    matched_property_id: null,
    matched_unit_id: null,
    confidence_score: 0,
    match_status: 'unmatched', // 'auto_matched' (>=95%), 'probable' (80-94%), 'unmatched' (<80%)
    match_reason: ''
  };

  const eligibleStatuses = ['active', 'notice_period', 'pending_move_in', 'notice', 'expired'];

  // Rule 1: Exact Tenant Code Match (100% confidence)
  if (cleanRef) {
    const tenantByCode = await Tenant.findOne({
      tenant_code: cleanRef,
      tenancy_status: { $in: eligibleStatuses }
    }).lean();

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

  // Rule 3: Phone Number Match on Tenant (95% confidence if amount matches rent, 85% otherwise)
  if (cleanPhone) {
    const bindex = generateBlindIndex(cleanPhone);
    const norm = normalizePhone(cleanPhone);
    const normBindex = norm ? generateBlindIndex(norm) : null;
    const phoneQueries = [{ phone_bindex: bindex }];
    if (normBindex && normBindex !== bindex) phoneQueries.push({ phone_bindex: normBindex });
    phoneQueries.push({ phone: cleanPhone });
    if (norm) phoneQueries.push({ phone: norm });

    const tenantByPhone = await Tenant.findOne({
      $or: phoneQueries,
      tenancy_status: { $in: eligibleStatuses }
    }).lean();

    if (tenantByPhone) {
      const exactAmountMatch = Math.abs((tenantByPhone.rent_amount_kes || 0) - parsedAmount) < 1;
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

  // Rule 4: Multi-signal AI Fallback Search
  const aiFallback = await aiTenantMatch({
    query: cleanRef,
    phone: cleanPhone,
    amount_kes: parsedAmount,
    account_reference: cleanRef
  });

  if (aiFallback.best_match && aiFallback.confidence_score >= 80) {
    matchResult = {
      matched_tenant_id: aiFallback.best_match.tenant_id,
      matched_property_id: aiFallback.best_match.property_id,
      matched_unit_id: aiFallback.best_match.unit_id,
      confidence_score: aiFallback.confidence_score,
      match_status: aiFallback.confidence_score >= 95 ? 'auto_matched' : 'probable',
      match_reason: `AI multi-signal match (${aiFallback.best_match.match_reasons.join(', ')})`
    };
    return matchResult;
  }

  // Fallback: Flag for unmatched queue
  logger.info('Payment could not be auto-reconciled, flagged for unmatched queue', {
    mpesa_code,
    phone: cleanPhone,
    account_reference: cleanRef,
    amount_kes: parsedAmount
  });

  return matchResult;
}

/**
 * AI-assisted Multi-signal Tenant Matching Engine.
 * Combines phone blind indices, tenant code, unit code, name similarity,
 * and rent amounts to resolve ambiguous incoming transactions.
 */
async function aiTenantMatch({ query, phone, amount_kes, account_reference, name }) {
  const candidatesMap = new Map();
  const parsedAmount = Number(amount_kes || 0);

  const addCandidate = (tenant, score, reason) => {
    const id = tenant._id.toString();
    if (candidatesMap.has(id)) {
      const existing = candidatesMap.get(id);
      existing.score = Math.min(100, existing.score + score);
      if (!existing.match_reasons.includes(reason)) {
        existing.match_reasons.push(reason);
      }
    } else {
      candidatesMap.set(id, {
        tenant_id: tenant._id,
        tenant_code: tenant.tenant_code,
        name: tenant.full_name,
        phone: decryptPII(tenant.phone) || tenant.phone,
        property_id: tenant.current_property_id,
        unit_id: tenant.current_unit_id,
        rent_amount_kes: tenant.rent_amount_kes,
        arrears_kes: tenant.arrears_kes,
        status: tenant.tenancy_status,
        score: Math.min(100, score),
        match_reasons: [reason]
      });
    }
  };

  const searchTerm = (query || account_reference || '').trim();
  const phoneSearch = (phone || (query && /^\+?\d{9,13}$/.test(searchTerm) ? searchTerm : '')).trim();

  // 1. Phone Lookups via Blind Index
  if (phoneSearch) {
    const norm = normalizePhone(phoneSearch);
    const bindex = generateBlindIndex(phoneSearch);
    const normBindex = norm ? generateBlindIndex(norm) : null;
    const phoneQueries = [{ phone_bindex: bindex }];
    if (normBindex && normBindex !== bindex) phoneQueries.push({ phone_bindex: normBindex });
    phoneQueries.push({ phone: phoneSearch });
    if (norm) phoneQueries.push({ phone: norm });

    const phoneMatches = await Tenant.find({ $or: phoneQueries }).lean();
    for (const t of phoneMatches) {
      addCandidate(t, 70, 'Phone blind index match');
    }
  }

  // 2. Tenant Code or Unit Lookups
  if (searchTerm) {
    const codeMatches = await Tenant.find({
      $or: [
        { tenant_code: { $regex: searchTerm, $options: 'i' } },
        { current_unit_id: searchTerm.length === 24 ? searchTerm : undefined }
      ].filter(Boolean)
    }).lean();

    for (const t of codeMatches) {
      const isExact = t.tenant_code?.toUpperCase() === searchTerm.toUpperCase();
      addCandidate(t, isExact ? 70 : 40, isExact ? 'Exact tenant code match' : 'Partial tenant code match');
    }

    const properties = await Property.find({ 'units.unit_number': { $regex: searchTerm, $options: 'i' } }).lean();
    for (const p of properties) {
      const u = p.units?.find(unit => unit.unit_number?.toUpperCase() === searchTerm.toUpperCase());
      if (u) {
        if (u.current_tenant_id) {
          const tenant = await Tenant.findById(u.current_tenant_id).lean();
          if (tenant) {
            addCandidate(tenant, 65, `Matched unit ${u.unit_number} at ${p.name}`);
          }
        }
        const tenantByUnit = await Tenant.findOne({ current_unit_id: u._id }).lean();
        if (tenantByUnit) {
          addCandidate(tenantByUnit, 65, `Matched unit ${u.unit_number} at ${p.name}`);
        }
      }
    }
  }

  // 3. Name Lookups
  const nameQuery = (name || searchTerm).trim();
  if (nameQuery && nameQuery.length >= 3) {
    const nameMatches = await Tenant.find({ full_name: { $regex: nameQuery, $options: 'i' } }).limit(5).lean();
    for (const t of nameMatches) {
      addCandidate(t, 35, 'Name similarity match');
    }
  }

  // 4. Rent Amount Cross-Validation
  if (parsedAmount > 0) {
    for (const candidate of candidatesMap.values()) {
      if (candidate.rent_amount_kes) {
        if (Math.abs(candidate.rent_amount_kes - parsedAmount) < 1) {
          candidate.score = Math.min(100, candidate.score + 25);
          candidate.match_reasons.push(`Exact rent amount match (KES ${parsedAmount})`);
        } else if (candidate.arrears_kes && Math.abs(candidate.arrears_kes - parsedAmount) < 1) {
          candidate.score = Math.min(100, candidate.score + 20);
          candidate.match_reasons.push(`Exact arrears balance match (KES ${parsedAmount})`);
        }
      }
    }
  }

  const sortedCandidates = Array.from(candidatesMap.values())
    .sort((a, b) => b.score - a.score);

  const bestMatch = sortedCandidates.length > 0 ? sortedCandidates[0] : null;

  return {
    best_match: bestMatch,
    confidence_score: bestMatch ? bestMatch.score : 0,
    candidates: sortedCandidates
  };
}

module.exports = {
  autoReconcilePayment,
  aiTenantMatch
};
