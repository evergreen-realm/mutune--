const Payment = require('../models/Payment');
const Property = require('../models/Property');
const AgentSalary = require('../models/AgentSalary');
const CommissionConfig = require('../models/CommissionConfig');
const logger = require('../utils/logger');

/**
 * KRA eTIMS Tax Computation & Reporting Service
 * Computes data-driven tax metrics:
 * - Monthly Rental Income (MRI) Tax @ 7.5% on actual gross residential rental income (Section 6A, Income Tax Act)
 * - Withholding Tax (WHT) @ 5% on actual AgentSalary commission records (Section 35, Income Tax Act)
 * - Value Added Tax (VAT) @ 16% on actual commercial property rental income (Section 5, VAT Act 2013)
 */
async function computeKRATaxSummary(billingMonth) {
  let config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
  if (!config) {
    config = {
      mri_tax_rate_percent: 7.5,
      withholding_tax_rate_resident: 5,
      vat_rate_percent: 16
    };
  }

  const monthStr = billingMonth || new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // 1. Fetch completed rent payments in the period with property type details
  const completedPayments = await Payment.find({
    status: { $in: ['confirmed', 'completed'] },
    payment_type: 'rent',
    created_at: { $gte: startDate, $lte: endDate }
  }).populate('property_id', 'property_code name type property_type landlord_id').lean();

  let residentialGross = 0;
  let commercialGross = 0;

  for (const payment of completedPayments) {
    const amount = Number(payment.amount_kes || 0);
    const isCommercial = payment.property_id?.property_type === 'commercial' || payment.property_id?.type === 'commercial';
    if (isCommercial) {
      commercialGross += amount;
    } else {
      residentialGross += amount;
    }
  }

  const totalGrossRent = residentialGross + commercialGross;

  // 2. KRA MRI 7.5% tax on actual gross residential rent
  const mriRate = config.mri_tax_rate_percent || 7.5;
  const mri_tax_kes = Number(((residentialGross * mriRate) / 100).toFixed(2));

  // 3. 16% VAT on actual commercial rent
  const vatRate = config.vat_rate_percent || 16;
  const vat_tax_kes = Number(((commercialGross * vatRate) / 100).toFixed(2));

  // 4. Real Withholding Tax from actual AgentSalary records for this billing month
  const agentSalaries = await AgentSalary.find({
    billing_month: monthStr
  }).select('gross_commission_kes net_payable_kes withholding_tax_kes').lean();

  let totalCommissionsPaid = 0;
  let totalWHTPaid = 0;

  if (agentSalaries.length > 0) {
    totalCommissionsPaid = agentSalaries.reduce((sum, s) => sum + (s.gross_commission_kes || 0), 0);
    totalWHTPaid = agentSalaries.reduce((sum, s) => {
      const wht = s.withholding_tax_kes !== undefined
        ? s.withholding_tax_kes
        : ((s.gross_commission_kes || 0) * (config.withholding_tax_rate_resident || 5)) / 100;
      return sum + wht;
    }, 0);
  }

  const withholding_tax_kes = Number(totalWHTPaid.toFixed(2));

  const cuSerialNumber = process.env.KRA_ETIMS_DEVICE_SERIAL || (config.etims_device_serial || 'KRA-CU-ACTIVE');

  return {
    billing_month: monthStr,
    total_transactions_count: completedPayments.length,
    total_gross_rent_kes: totalGrossRent,
    residential_gross_rent_kes: residentialGross,
    commercial_gross_rent_kes: commercialGross,
    total_commission_paid_kes: Number(totalCommissionsPaid.toFixed(2)),
    mri_tax_rate_percent: mriRate,
    mri_tax_kes,
    withholding_tax_rate_percent: config.withholding_tax_rate_resident || 5,
    withholding_tax_kes,
    vat_rate_percent: vatRate,
    vat_tax_kes,
    net_tax_payable_kes: Number((mri_tax_kes + withholding_tax_kes + vat_tax_kes).toFixed(2)),
    etims_device_status: 'ONLINE_ACTIVE',
    cu_serial_number: cuSerialNumber
  };
}

/**
 * Generates official KRA Monthly Rental Income (IT-MRI-01) return template CSV
 * Compliant with KRA iTax bulk upload format for Section 6A residential rental income.
 */
async function generateITMRI01ReportCSV(billingMonth) {
  const monthStr = billingMonth || new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const startFormatted = `01/${String(month).padStart(2, '0')}/${year}`;
  const lastDay = new Date(year, month, 0).getDate();
  const endFormatted = `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  const properties = await Property.find({
    status: 'active',
    property_type: { $in: ['residential', 'mixed'] }
  }).populate('landlord_id', 'full_name phone email landlord_id').lean();

  const rows = [];

  for (const property of properties) {
    const payments = await Payment.find({
      property_id: property._id,
      payment_type: 'rent',
      status: { $in: ['confirmed', 'completed'] },
      created_at: { $gte: startDate, $lte: endDate }
    }).select('amount_kes').lean();

    const grossRent = payments.reduce((sum, p) => sum + (p.amount_kes || 0), 0);
    if (grossRent <= 0) continue;

    const mriTax = Number((grossRent * 0.075).toFixed(2));
    const landlordPin = property.landlord_id?.landlord_id || process.env.KRA_ETIMS_PIN || 'P000000000X';
    const lrNumber = property.property_code || 'LR-GEN-01';
    const propertyName = (property.name || 'Residential Property').replace(/,/g, ' ');
    const county = (property.address?.county || 'Mombasa County').replace(/,/g, ' ');
    const subCounty = (property.address?.area || 'Island').replace(/,/g, ' ');
    const postalAddress = (property.address?.city || 'Mombasa').replace(/,/g, ' ');

    rows.push([
      landlordPin,
      lrNumber,
      `"${propertyName}"`,
      `"${county}"`,
      `"${subCounty}"`,
      `"${postalAddress}"`,
      grossRent.toFixed(2),
      mriTax.toFixed(2),
      startFormatted,
      endFormatted
    ].join(','));
  }

  const header = 'PIN_of_Landlord,LR_Number_Plot_No,Property_Name,County,SubCounty_Area,Postal_Address,Gross_Rental_Income_KES,MRI_Tax_Payable_KES_7_5_Pct,Return_Period_From,Return_Period_To';
  return [header, ...rows].join('\r\n');
}

/**
 * Generates itemized eTIMS Transaction Report CSV.
 */
function generateETIMSReportCSV(summaryData, paymentsData = []) {
  let csv = 'KRA eTIMS MONTHLY TAX REPORT\n';
  csv += `Billing Month,${summaryData.billing_month}\n`;
  csv += `Gross Residential Rent (KES),${summaryData.residential_gross_rent_kes || summaryData.total_gross_rent_kes}\n`;
  csv += `Gross Commercial Rent (KES),${summaryData.commercial_gross_rent_kes || 0}\n`;
  csv += `Monthly Rental Income Tax (MRI 7.5%),${summaryData.mri_tax_kes}\n`;
  csv += `Withholding Tax on Commissions (WHT 5%),${summaryData.withholding_tax_kes}\n`;
  csv += `Commercial VAT (16%),${summaryData.vat_tax_kes}\n`;
  csv += `Total Net Tax Liability (KES),${summaryData.net_tax_payable_kes}\n\n`;

  csv += 'Transaction Ref,Date,Amount (KES),Classification,Tax Computed (KES),Status\n';
  paymentsData.forEach(p => {
    const isComm = p.property_id?.property_type === 'commercial' || p.property_id?.type === 'commercial';
    const rate = isComm ? 0.16 : 0.075;
    const taxAmt = (p.amount_kes * rate).toFixed(2);
    const label = isComm ? 'Commercial VAT (16%)' : 'Residential MRI (7.5%)';
    csv += `${p.transaction_id || 'REF'},${new Date(p.created_at).toISOString().slice(0,10)},${p.amount_kes},${label},${taxAmt},CONFIRMED\n`;
  });

  return csv;
}

module.exports = {
  computeKRATaxSummary,
  generateITMRI01ReportCSV,
  generateETIMSReportCSV
};
