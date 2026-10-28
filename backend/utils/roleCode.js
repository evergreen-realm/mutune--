const logger = require('./logger');

/**
 * Standard role prefix mapping according to MutuneRent Pro enterprise rules
 */
const ROLE_PREFIXES = {
  tenant: 'TEN-MOM-',
  agent: 'AGT-MOM-',
  landlord: 'LLD-MOM-',
  admin: 'ADM-MOM-',
  super_admin: 'ADM-MOM-',
  caretaker: 'CRT-MOM-',
  accountant: 'ACC-MOM-'
};

/**
 * Formats a role code given role and number
 */
function formatRoleCode(role, num) {
  const prefix = ROLE_PREFIXES[role] || 'TEN-MOM-';
  const padLength = role === 'agent' && num < 1000 ? 3 : 4;
  return `${prefix}${String(num).padStart(padLength, '0')}`;
}

/**
 * Generates the next guaranteed-unique role code for a given role
 */
async function generateNextRoleCode(role, User, Tenant) {
  const normRole = (role || 'tenant').toLowerCase().trim();
  const prefix = ROLE_PREFIXES[normRole] || 'TEN-MOM-';

  try {
    let baseCount = 1;
    if (normRole === 'tenant') {
      const userTenantCount = await User.countDocuments({ role: 'tenant' });
      const tenantCount = Tenant ? await Tenant.countDocuments() : 0;
      baseCount = Math.max(userTenantCount, tenantCount) + 1;
    } else if (['admin', 'super_admin'].includes(normRole)) {
      const count = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
      baseCount = count + 1;
    } else {
      const count = await User.countDocuments({ role: normRole });
      baseCount = count + 1;
    }

    // Ensure uniqueness by checking if the code is already assigned
    let candidate = formatRoleCode(normRole, baseCount);
    let attempts = 0;
    while (attempts < 1000) {
      const existsInUser = await User.exists({ user_code: candidate });
      let existsInTenant = false;
      if (normRole === 'tenant' && Tenant) {
        existsInTenant = await Tenant.exists({ tenant_code: candidate });
      }
      if (!existsInUser && !existsInTenant) {
        return candidate;
      }
      baseCount++;
      candidate = formatRoleCode(normRole, baseCount);
      attempts++;
    }
    return candidate;
  } catch (err) {
    logger.error('Error generating role code, falling back to timestamp suffix', { error: err.message, role });
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Validates or checks if an input matches a role code or expected ID
 */
function isMatchingRoleOrTenantCode(input, expectedCodes = []) {
  if (!input || typeof input !== 'string') return false;
  const clean = input.trim().toLowerCase();
  for (const exp of expectedCodes) {
    if (!exp || typeof exp !== 'string') continue;
    const cleanExp = exp.trim().toLowerCase();
    if (clean === cleanExp) return true;

    // Support TNT-MOM- vs TEN-MOM- equivalence
    if (clean.replace(/^tnt-mom-/, 'ten-mom-') === cleanExp.replace(/^tnt-mom-/, 'ten-mom-')) return true;
    if (clean.replace(/^ten-mom-/, 'tnt-mom-') === cleanExp.replace(/^ten-mom-/, 'tnt-mom-')) return true;
  }
  return false;
}

module.exports = {
  ROLE_PREFIXES,
  formatRoleCode,
  generateNextRoleCode,
  isMatchingRoleOrTenantCode
};
