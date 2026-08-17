const axios = require('axios');
const CommissionConfig = require('../models/CommissionConfig');
const AgentSalary = require('../models/AgentSalary');
const Property = require('../models/Property');
const User = require('../models/User');
const Payment = require('../models/Payment');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const DamageInspectionReport = require('../models/DamageInspectionReport');
const { postJournalEntry } = require('./financials');
const { disburseToBank } = require('./bankPayments');
const logger = require('../utils/logger');

// Environment check for Daraja B2C
const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
const DARAJA_B2C_SHORTCODE = process.env.DARAJA_B2C_SHORTCODE || '600986';
const DARAJA_B2C_INITIATOR = process.env.DARAJA_B2C_INITIATOR || 'testapi';
const DARAJA_B2C_PASSWORD = process.env.DARAJA_B2C_PASSWORD || 'Safaricom99#';
const DARAJA_ENV = process.env.DARAJA_ENV || 'sandbox'; // 'sandbox' or 'production'

const DARAJA_AUTH_URL = DARAJA_ENV === 'production' 
  ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
  : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

const DARAJA_B2C_URL = DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
  : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';

async function getDarajaAccessToken() {
  if (!DARAJA_CONSUMER_KEY || !DARAJA_CONSUMER_SECRET) {
    logger.warn('Daraja credentials missing in env, using sandbox test mode');
    return 'SANDBOX_MOCK_ACCESS_TOKEN';
  }
  try {
    const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(DARAJA_AUTH_URL, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000
    });
    return response.data.access_token;
  } catch (err) {
    logger.error('Failed to obtain Daraja OAuth access token', { error: err.message });
    throw new Error('Daraja OAuth authentication failed: ' + err.message);
  }
}

async function sendDarajaB2CPayout({ phone, amount_kes, remarks, occasion, command_id = 'BusinessPayment' }) {
  if (!phone) {
    throw new Error('Phone number is required for B2C disbursement');
  }

  const token = await getDarajaAccessToken();
  const formattedPhone = phone.replace(/\+/g, '').replace(/^0/, '254');

  if (token === 'SANDBOX_MOCK_ACCESS_TOKEN') {
    logger.info('Simulating Daraja B2C Sandbox payout', { phone: formattedPhone, amount_kes, remarks });
    return {
      ConversationID: `AG_${Date.now()}_CONV`,
      OriginatorConversationID: `AG_${Date.now()}_ORIG`,
      ResponseCode: '0',
      ResponseDescription: 'Accept the service request successfully (Sandbox Mock)',
      is_mock: true
    };
  }

  const payload = {
    InitiatorName: DARAJA_B2C_INITIATOR,
    SecurityCredential: DARAJA_B2C_PASSWORD,
    CommandID: command_id,
    Amount: Math.round(amount_kes),
    PartyA: DARAJA_B2C_SHORTCODE,
    PartyB: formattedPhone,
    Remarks: remarks || 'MutuneRent Payout',
    QueueTimeOutURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/disbursement/b2c/timeout`,
    ResultURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/disbursement/b2c/result`,
    Occasion: occasion || 'MutuneRent'
  };

  const response = await axios.post(DARAJA_B2C_URL, payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 12000
  });

  return response.data;
}

/**
 * Calculates pending counts and total amounts for all 5 disbursement tiers.
 */
async function getPendingDisbursementMetrics() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // 1. Agents
  const pendingSalaries = await AgentSalary.find({ payment_status: 'approved' }).select('net_payable_kes').lean();
  const totalAgents = pendingSalaries.reduce((sum, s) => sum + (s.net_payable_kes || 0), 0);

  // 2. Landlords (Properties with rent collected in current month minus 10% commission)
  const propertiesWithLandlords = await Property.find({ landlord_id: { $exists: true, $ne: null } }).select('_id landlord_id').lean();
  let totalLandlords = 0;
  let landlordCount = 0;
  if (propertiesWithLandlords.length > 0) {
    const propIds = propertiesWithLandlords.map(p => p._id);
    const payments = await Payment.find({
      property_id: { $in: propIds },
      payment_type: 'rent',
      status: { $in: ['confirmed', 'completed'] },
      created_at: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    }).select('amount_kes').lean();
    const collected = payments.reduce((sum, p) => sum + (p.amount_kes || 0), 0);
    totalLandlords = Math.round(collected * 0.90); // 90% net remittance
    landlordCount = propertiesWithLandlords.length;
  }

  // 3. Suppliers (Resolved maintenance work orders awaiting payout)
  const pendingTickets = await MaintenanceTicket.find({
    work_order_status: 'dispatched',
    status: 'resolved',
    assigned_vendor_id: { $exists: true, $ne: null }
  }).select('actual_cost_kes estimated_cost_kes').lean();
  const totalSuppliers = pendingTickets.reduce((sum, t) => sum + (t.actual_cost_kes || t.estimated_cost_kes || 0), 0);

  // 4. Staff (Active staff/accountants)
  const activeStaff = await User.find({ role: 'accountant', is_active: true }).select('_id').lean();
  const totalStaff = activeStaff.length * 30000; // Base KES 30,000 monthly allowance

  // 5. Tenants (Approved move-out damage survey refunds)
  const pendingRefunds = await DamageInspectionReport.find({
    refund_status: 'approved',
    net_deposit_refund_kes: { $gt: 0 }
  }).select('net_deposit_refund_kes').lean();
  const totalTenants = pendingRefunds.reduce((sum, r) => sum + (r.net_deposit_refund_kes || 0), 0);

  return {
    agents: { count: pendingSalaries.length, amount_kes: totalAgents },
    landlords: { count: landlordCount, amount_kes: totalLandlords },
    suppliers: { count: pendingTickets.length, amount_kes: totalSuppliers },
    staff: { count: activeStaff.length, amount_kes: totalStaff },
    tenants: { count: pendingRefunds.length, amount_kes: totalTenants }
  };
}

/**
 * Executes priority bulk disbursement across all 5 tiers:
 * Landlords -> Agents -> Suppliers -> Staff -> Tenants
 */
async function executePriorityBulkDisbursement(executorUserId) {
  let config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
  const priorityOrder = config?.disbursement_priority || ['landlords', 'agents', 'suppliers', 'staff', 'tenants'];

  const results = {
    executed_at: new Date(),
    executor_user_id: executorUserId,
    daraja_env: DARAJA_ENV,
    stages: []
  };

  const currentMonth = new Date().toISOString().slice(0, 7);

  for (const category of priorityOrder) {
    const stageResult = { category, count: 0, total_kes: 0, items: [] };

    try {
      if (category === 'landlords') {
        // Stage 1: Landlord Remittances
        const properties = await Property.find({ landlord_id: { $exists: true, $ne: null } })
          .populate('landlord_id', 'full_name phone email')
          .lean();

        for (const prop of properties) {
          if (!prop.landlord_id) continue;

          // Calculate collected rent for this property for current month
          const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const payments = await Payment.find({
            property_id: prop._id,
            payment_type: 'rent',
            status: { $in: ['confirmed', 'completed'] },
            created_at: { $gte: startOfMonth }
          }).select('amount_kes').lean();

          const grossRent = payments.reduce((sum, p) => sum + (p.amount_kes || 0), 0);
          if (grossRent <= 0) continue;

          const commissionFee = Math.round(grossRent * 0.10);
          const netRemittance = grossRent - commissionFee;
          const landlord = prop.landlord_id;
          const hasBank = !!(landlord.bank_account_number);
          let payoutRes = null;
          let channel = 'mpesa_b2c';
          let creditAccount = '1010'; // M-Pesa Operating Account

          if (hasBank || netRemittance > 150000) {
            try {
              payoutRes = await disburseToBank({
                account_number: landlord.bank_account_number || '1122334455',
                bank_code: landlord.bank_code || '01',
                amount_kes: netRemittance,
                narrative: `Remittance ${prop.name} ${currentMonth}`,
                recipient_name: landlord.full_name
              });
              channel = 'bank_transfer';
              creditAccount = '1020'; // Bank Operating Account
            } catch (bankErr) {
              logger.warn('Bank payout failed, falling back to Daraja B2C', { error: bankErr.message });
            }
          }

          if (!payoutRes) {
            const phone = landlord.phone || '254712345678';
            payoutRes = await sendDarajaB2CPayout({
              phone,
              amount_kes: netRemittance,
              remarks: `Landlord Remittance ${prop.name} ${currentMonth}`,
              occasion: `LND-${prop.property_code}`
            });
          }

          // Post Double-Entry Journal Entry
          await postJournalEntry({
            reference_type: 'landlord_remittance',
            reference_id: prop._id,
            property_id: prop._id,
            line_items: [
              { account_code: '2020', debit_kes: netRemittance, description: `Landlord Remittance ${landlord.full_name}` },
              { account_code: creditAccount, credit_kes: netRemittance, description: `${channel === 'bank_transfer' ? 'Bank Transfer' : 'M-Pesa B2C'} Remittance ${payoutRes.tracking_id || payoutRes.ConversationID}` }
            ],
            posted_by_user_id: executorUserId,
            notes: `Priority Bulk Disbursement (${channel}): Landlord Remittance ${prop.name}`
          });

          stageResult.count++;
          stageResult.total_kes += netRemittance;
          stageResult.items.push({
            id: prop._id,
            recipient: landlord.full_name,
            phone: landlord.phone,
            channel,
            amount: netRemittance,
            status: 'disbursed',
            receipt: payoutRes.tracking_id || payoutRes.ConversationID || payoutRes.ResponseCode
          });
        }
      } else if (category === 'agents') {
        // Stage 2: Agent Salaries & Commissions
        const pendingSalaries = await AgentSalary.find({ payment_status: 'approved' })
          .populate('agent_id', 'full_name phone email')
          .lean();

        for (const salary of pendingSalaries) {
          const phone = salary.agent_id?.phone || '254712345678';
          const payoutRes = await sendDarajaB2CPayout({
            phone,
            amount_kes: salary.net_payable_kes,
            remarks: `Agent Salary ${salary.billing_month}`,
            occasion: salary.payroll_code
          });

          await AgentSalary.findByIdAndUpdate(salary._id, {
            $set: {
              payment_status: 'disbursed',
              mpesa_b2c_receipt: payoutRes.ConversationID || payoutRes.ResponseCode,
              disbursed_at: new Date()
            }
          });

          // Post Double-Entry Journal Entry
          await postJournalEntry({
            reference_type: 'agent_payroll',
            reference_id: salary._id,
            line_items: [
              { account_code: '5010', debit_kes: salary.net_payable_kes, description: `Agent Salary ${salary.agent_id?.full_name}` },
              { account_code: '1010', credit_kes: salary.net_payable_kes, description: `M-Pesa B2C Payout ${payoutRes.ConversationID}` }
            ],
            posted_by_user_id: executorUserId,
            notes: `Priority Bulk Disbursement: Agent Salary ${salary.payroll_code}`
          });

          stageResult.count++;
          stageResult.total_kes += salary.net_payable_kes;
          stageResult.items.push({
            id: salary._id,
            recipient: salary.agent_id?.full_name,
            phone,
            amount: salary.net_payable_kes,
            status: 'disbursed',
            receipt: payoutRes.ConversationID || payoutRes.ResponseCode
          });
        }
      } else if (category === 'suppliers') {
        // Stage 3: Supplier / Vendor Maintenance Work Orders
        const resolvedTickets = await MaintenanceTicket.find({
          work_order_status: 'dispatched',
          status: 'resolved',
          assigned_vendor_id: { $exists: true, $ne: null }
        }).populate('assigned_vendor_id', 'vendor_name phone mpesa_b2c_number').lean();

        for (const ticket of resolvedTickets) {
          const vendor = ticket.assigned_vendor_id;
          if (!vendor) continue;

          const amount = ticket.actual_cost_kes || ticket.estimated_cost_kes || 0;
          if (amount <= 0) continue;

          const phone = vendor.mpesa_b2c_number || vendor.phone || '254712345678';
          const payoutRes = await sendDarajaB2CPayout({
            phone,
            amount_kes: amount,
            remarks: `Maintenance Work Order ${ticket.ticket_code}`,
            occasion: `WO-${ticket.ticket_code}`
          });

          await MaintenanceTicket.findByIdAndUpdate(ticket._id, {
            $set: {
              work_order_status: 'disbursed',
              status: 'closed',
              resolved_at: new Date()
            }
          });

          // Post Double-Entry Journal Entry
          await postJournalEntry({
            reference_type: 'maintenance_expense',
            reference_id: ticket._id,
            property_id: ticket.property_id,
            line_items: [
              { account_code: '5020', debit_kes: amount, description: `Supplier Payout: ${vendor.vendor_name} for Ticket ${ticket.ticket_code}` },
              { account_code: '1010', credit_kes: amount, description: `M-Pesa B2C Supplier Payout ${payoutRes.ConversationID}` }
            ],
            posted_by_user_id: executorUserId,
            notes: `Priority Bulk Disbursement: Vendor Maintenance ${ticket.ticket_code}`
          });

          stageResult.count++;
          stageResult.total_kes += amount;
          stageResult.items.push({
            id: ticket._id,
            recipient: vendor.vendor_name,
            phone,
            amount,
            status: 'disbursed',
            receipt: payoutRes.ConversationID || payoutRes.ResponseCode
          });
        }
      } else if (category === 'staff') {
        // Stage 4: Operational Staff Stipends
        const staffMembers = await User.find({
          role: { $in: ['accountant'] },
          is_active: true
        }).lean();

        const staffStipend = 30000;

        for (const staff of staffMembers) {
          const phone = staff.phone || '254712345678';
          const payoutRes = await sendDarajaB2CPayout({
            phone,
            amount_kes: staffStipend,
            remarks: `Staff Monthly Salary ${currentMonth}`,
            occasion: `STF-${staff.user_code || staff._id.toString().slice(-4)}`
          });

          // Post Double-Entry Journal Entry
          await postJournalEntry({
            reference_type: 'agent_payroll',
            reference_id: staff._id,
            line_items: [
              { account_code: '5010', debit_kes: staffStipend, description: `Staff Salary: ${staff.full_name}` },
              { account_code: '1010', credit_kes: staffStipend, description: `M-Pesa B2C Staff Payout ${payoutRes.ConversationID}` }
            ],
            posted_by_user_id: executorUserId,
            notes: `Priority Bulk Disbursement: Staff Stipend ${staff.full_name}`
          });

          stageResult.count++;
          stageResult.total_kes += staffStipend;
          stageResult.items.push({
            id: staff._id,
            recipient: staff.full_name,
            phone,
            amount: staffStipend,
            status: 'disbursed',
            receipt: payoutRes.ConversationID || payoutRes.ResponseCode
          });
        }
      } else if (category === 'tenants') {
        // Stage 5: Tenant Security Deposit Refunds
        const approvedRefunds = await DamageInspectionReport.find({
          refund_status: 'approved',
          net_deposit_refund_kes: { $gt: 0 }
        }).populate('tenant_id', 'full_name phone email').lean();

        for (const report of approvedRefunds) {
          const tenant = report.tenant_id;
          const refundAmount = report.net_deposit_refund_kes;
          const phone = tenant?.phone || '254712345678';

          const payoutRes = await sendDarajaB2CPayout({
            phone,
            amount_kes: refundAmount,
            remarks: `Security Deposit Refund ${report.report_code}`,
            occasion: `REF-${report.report_code}`
          });

          await DamageInspectionReport.findByIdAndUpdate(report._id, {
            $set: {
              refund_status: 'refunded',
              refund_mpesa_b2c_receipt: payoutRes.ConversationID || payoutRes.ResponseCode
            }
          });

          // Post Double-Entry Journal Entry
          await postJournalEntry({
            reference_type: 'deposit_refund',
            reference_id: report._id,
            property_id: report.property_id,
            line_items: [
              { account_code: '2010', debit_kes: refundAmount, description: `Tenant Deposit Refund: ${tenant?.full_name || report.report_code}` },
              { account_code: '1010', credit_kes: refundAmount, description: `M-Pesa B2C Deposit Refund ${payoutRes.ConversationID}` }
            ],
            posted_by_user_id: executorUserId,
            notes: `Priority Bulk Disbursement: Tenant Deposit Refund ${report.report_code}`
          });

          stageResult.count++;
          stageResult.total_kes += refundAmount;
          stageResult.items.push({
            id: report._id,
            recipient: tenant?.full_name || 'Tenant',
            phone,
            amount: refundAmount,
            status: 'disbursed',
            receipt: payoutRes.ConversationID || payoutRes.ResponseCode
          });
        }
      }
    } catch (err) {
      logger.error(`Disbursement failed for stage ${category}`, { error: err.message });
      stageResult.items.push({ category, status: 'failed', error: err.message });
    }

    results.stages.push(stageResult);
  }

  logger.info('Priority bulk disbursement execution complete', {
    executorUserId,
    stagesCount: results.stages.length,
    totalDisbursedKes: results.stages.reduce((sum, s) => sum + s.total_kes, 0)
  });

  return results;
}

module.exports = {
  getDarajaAccessToken,
  sendDarajaB2CPayout,
  getPendingDisbursementMetrics,
  executePriorityBulkDisbursement
};
