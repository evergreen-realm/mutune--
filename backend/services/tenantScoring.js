const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const TenantScore = require('../models/TenantScore');

/**
 * Calculates a 12-month tenant financial health score (0-100).
 */
async function calculateTenantScore(tenantId) {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new Error('Tenant not found');

  const payments = await Payment.find({ tenant_id: tenantId }).sort({ created_at: -1 }).limit(12).lean();

  let score = 85; // Baseline initial score
  let onTimeCount = 0;
  const history = [];

  payments.forEach(p => {
    const month = new Date(p.created_at).toISOString().slice(0, 7);
    if (p.status === 'completed') {
      onTimeCount++;
      score += 2;
      history.push({ billing_month: month, status: 'on_time', days_late: 0 });
    } else if (p.status === 'pending') {
      score -= 5;
      history.push({ billing_month: month, status: 'late', days_late: 5 });
    } else {
      score -= 10;
      history.push({ billing_month: month, status: 'missed', days_late: 15 });
    }
  });

  if (tenant.arrears_kes > 0) {
    score -= 15;
  }

  score = Math.min(100, Math.max(0, score));

  let rating = 'GOOD';
  if (score >= 90) rating = 'EXCELLENT';
  else if (score >= 70) rating = 'GOOD';
  else if (score >= 50) rating = 'FAIR';
  else rating = 'POOR';

  const ratio = payments.length > 0 ? Math.round((onTimeCount / payments.length) * 100) : 100;

  const updatedScore = await TenantScore.findOneAndUpdate(
    { tenant_id: tenantId },
    {
      credit_score: score,
      punctuality_rating: rating,
      on_time_payment_ratio_percent: ratio,
      total_months_tracked: payments.length || 12,
      payment_history_summary: history,
      score_last_updated: Date.now()
    },
    { upsert: true, new: true }
  );

  return updatedScore;
}

module.exports = {
  calculateTenantScore
};
