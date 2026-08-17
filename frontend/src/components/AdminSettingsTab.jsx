import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Scale, RefreshCw, Save, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { fetchFinancialSettings, updateFinancialSettings, fetchTrialBalance } from '../lib/api';
import { toast } from 'react-toastify';

export default function AdminSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    withholding_tax_rate_resident: 7.5,
    withholding_tax_rate_non_resident: 10.0,
    letting_commission_percent: 100,
    management_commission_percent: 10.0,
    lease_renewal_commission_percent: 25.0,
    agent_initiation_fee_kes: 2500,
    agent_payroll_day_of_month: 28,
    disbursement_priority: ['landlords', 'agents', 'suppliers', 'staff', 'tenants'],
    etims_pin: 'P051234567Z',
    etims_device_serial: 'MUTUNE-ETIMS-001'
  });

  const [trialBalance, setTrialBalance] = useState(null);
  const [loadingTb, setLoadingTb] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTrialBalance();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetchFinancialSettings();
      if (res?.success && res?.data) {
        setConfig(res.data);
      }
    } catch (err) {
      toast.error('Failed to load financial settings');
    } finally {
      setLoading(false);
    }
  };

  const loadTrialBalance = async () => {
    setLoadingTb(true);
    try {
      const res = await fetchTrialBalance();
      if (res?.success && res?.data) {
        setTrialBalance(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch trial balance:', err);
    } finally {
      setLoadingTb(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateFinancialSettings(config);
      if (res?.success) {
        toast.success('Financial parameters updated successfully!');
        if (res.data) setConfig(res.data);
      } else {
        toast.error(res?.error?.message || 'Failed to save settings');
      }
    } catch (err) {
      toast.error('Error saving financial settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Loading financial configurations...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Sliders size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              Financial & Tax Configurations
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Set global commission rates, KRA withholding tax rules, and general ledger settings.
          </p>
        </div>
        <button
          onClick={() => { loadSettings(); loadTrialBalance(); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-700"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Reload Settings
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Tax & Commission Rates */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-2.5 text-sm font-bold text-indigo-400 pb-2 border-b border-slate-800">
            <Shield size={18} />
            <span>Tax & Agency Commission Rates</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Resident Landlord KRA Withholding Tax (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={config.withholding_tax_rate_resident || 7.5}
              onChange={(e) => setConfig({ ...config, withholding_tax_rate_resident: parseFloat(e.target.value) })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Agent Letting Commission (% of 1st Month Rent)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="200"
              value={config.letting_commission_percent || 100}
              onChange={(e) => setConfig({ ...config, letting_commission_percent: parseFloat(e.target.value) })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Monthly Property Management Fee (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={config.management_commission_percent || 10.0}
              onChange={(e) => setConfig({ ...config, management_commission_percent: parseFloat(e.target.value) })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Agent Onboarding Initiation Fee (KES)
            </label>
            <input
              type="number"
              step="100"
              min="0"
              value={config.agent_initiation_fee_kes || 2500}
              onChange={(e) => setConfig({ ...config, agent_initiation_fee_kes: parseFloat(e.target.value) })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans text-slate-200"
            />
          </div>
        </div>

        {/* Card 2: eTIMS & Payout Governance */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-2.5 text-sm font-bold text-emerald-400 pb-2 border-b border-slate-800">
            <Scale size={18} />
            <span>KRA eTIMS & Disbursement Priority</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Company KRA eTIMS PIN
            </label>
            <input
              type="text"
              value={config.etims_pin || 'P051234567Z'}
              onChange={(e) => setConfig({ ...config, etims_pin: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans uppercase text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              eTIMS Device Serial Number
            </label>
            <input
              type="text"
              value={config.etims_device_serial || 'MUTUNE-ETIMS-001'}
              onChange={(e) => setConfig({ ...config, etims_device_serial: e.target.value })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans uppercase text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Agent Payroll Disbursement Day of Month
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.agent_payroll_day_of_month || 28}
              onChange={(e) => setConfig({ ...config, agent_payroll_day_of_month: parseInt(e.target.value) })}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm outline-none font-sans text-slate-200"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Save size={16} />
              {saving ? 'Saving Configurations...' : 'Save Financial Parameters'}
            </button>
          </div>
        </div>
      </form>

      {/* Trial Balance General Ledger Summary Card */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-bold text-indigo-400">
            <FileText size={18} />
            <span>General Ledger Trial Balance Summary</span>
          </div>
          {trialBalance && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              trialBalance.is_balanced ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {trialBalance.is_balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {trialBalance.is_balanced ? 'Ledger Balanced (Debit = Credit)' : 'Unbalanced Ledger Alert'}
            </div>
          )}
        </div>

        {loadingTb ? (
          <div className="text-xs text-slate-400 py-4 text-center">Loading Trial Balance...</div>
        ) : trialBalance?.rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 rounded-l-lg">Account Code</th>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Debit (KES)</th>
                  <th className="py-2.5 px-4 text-right rounded-r-lg">Credit (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {trialBalance.rows.map((row) => (
                  <tr key={row.account_code} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono text-indigo-300 font-bold">{row.account_code}</td>
                    <td className="py-2.5 px-4 text-slate-200">{row.account_name}</td>
                    <td className="py-2.5 px-4 text-slate-400 uppercase text-[10px]">{row.account_type}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-200">
                      {row.debit_kes > 0 ? row.debit_kes.toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-200">
                      {row.credit_kes > 0 ? row.credit_kes.toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-950/80 font-bold">
                  <td colSpan="3" className="py-3 px-4 text-slate-200">Total General Ledger Balance</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                    KES {trialBalance.total_debit_kes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                    KES {trialBalance.total_credit_kes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
