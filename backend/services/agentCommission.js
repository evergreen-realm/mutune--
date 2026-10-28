const User = require('../models/User');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const CommissionConfig = require('../models/CommissionConfig');
const AgentSalary = require('../models/AgentSalary');
const logger = require('../utils/logger');

async function calculateAgentCommission(agentId, billingMonth) {
  let config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
  if (!config) {
    config = {
      base_salary_kes: 0,
      letting_commission_percent: 100,
      management_commission_percent: 10,
      lease_renewal_commission_percent: 25,
      agent_initiation_fee_kes: 2500,
      withholding_tax_rate_resident: 5
    };
  }

  const agent = await User.findById(agentId).lean();
  const userPropIds = agent?.assigned_property_ids || [];

  // 0. Base Salary (per agent override or global default)
  const base_salary_kes = Number(agent?.base_salary_kes ?? config?.base_salary_kes ?? 0);
  const lettingPercent = Number(agent?.letting_commission_rate ?? config?.letting_commission_percent ?? 100);
  const mgmtPercent = Number(agent?.management_commission_rate ?? config?.management_commission_percent ?? 10);

  // Find all assigned properties for this agent
  const assignedProperties = await Property.find({
    $or: [
      { agent_ids: agentId },
      { _id: { $in: userPropIds } }
    ]
  }).select('_id name units').lean();
  const propertyIds = assignedProperties.map(p => p._id);

  // 1. Management commission: % of collected rent payments in this billing month
  const [year, month] = billingMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const collectedPayments = await Payment.find({
    property_id: { $in: propertyIds },
    status: 'confirmed',
    created_at: { $gte: startDate, $lte: endDate }
  }).lean();

  const totalCollectedRent = collectedPayments.reduce((sum, p) => sum + (p.amount_kes || 0), 0);
  const management_commission_kes = Number(((totalCollectedRent * mgmtPercent) / 100).toFixed(2));

  // 2. Letting commission: New tenant leases created in this billing month
  const newTenants = await Tenant.find({
    current_property_id: { $in: propertyIds },
    created_at: { $gte: startDate, $lte: endDate }
  }).lean();

  let letting_commission_kes = 0;
  newTenants.forEach(t => {
    letting_commission_kes += Number((((t.rent_amount_kes || 0) * lettingPercent) / 100).toFixed(2));
  });

  // 3. Initiation fees: KES 2,500 per property assigned in this billing month
  const newlyAssignedProps = await Property.countDocuments({
    $or: [
      { agent_ids: agentId },
      { _id: { $in: userPropIds } }
    ],
    created_at: { $gte: startDate, $lte: endDate }
  });
  const initiation_fees_kes = newlyAssignedProps * (config.agent_initiation_fee_kes || 2500);

  const renewal_commission_kes = 0; // Reserved for renewals

  const gross_earnings_kes = Number((base_salary_kes + letting_commission_kes + management_commission_kes + renewal_commission_kes + initiation_fees_kes).toFixed(2));
  const withholding_tax_rate = (config.withholding_tax_rate_resident || 5) / 100;
  const withholding_tax_kes = Number((gross_earnings_kes * withholding_tax_rate).toFixed(2));
  const net_payable_kes = Number((gross_earnings_kes - withholding_tax_kes).toFixed(2));

  return {
    agent_id: agentId,
    billing_month: billingMonth,
    base_salary_kes,
    letting_commission_rate: lettingPercent,
    management_commission_rate: mgmtPercent,
    letting_commission_kes,
    management_commission_kes,
    renewal_commission_kes,
    initiation_fees_kes,
    gross_earnings_kes,
    withholding_tax_kes,
    net_payable_kes
  };
}

async function processAgentPayroll(agentId, billingMonth, processedByUserId) {
  const calc = await calculateAgentCommission(agentId, billingMonth);
  const count = await AgentSalary.countDocuments();
  const payroll_code = `PAY-${billingMonth}-${String(count + 1).padStart(4, '0')}`;

  const salary = await AgentSalary.findOneAndUpdate(
    { agent_id: agentId, billing_month: billingMonth },
    {
      $set: {
        payroll_code,
        ...calc,
        payment_status: 'approved',
        processed_by_user_id: processedByUserId,
        updated_at: new Date()
      }
    },
    { new: true, upsert: true }
  );

  logger.info('Agent payroll processed', { agentId, billingMonth, payroll_code, net_payable_kes: calc.net_payable_kes });
  return salary;
}

module.exports = {
  calculateAgentCommission,
  processAgentPayroll
};
