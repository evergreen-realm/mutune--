import React, { useState, useEffect } from 'react';
import { DollarSign, UserCheck, CheckCircle2, RefreshCw, Send, ShieldAlert, Award, Settings, Sliders, X, Edit2, Save, Loader2 } from 'lucide-react';
import { fetchAgentPayrollList, processAgentPayroll, fetchCommissionConfig, updateCommissionConfig, updateAgentCommissionConfig } from '../lib/api';
import { toast } from 'react-toastify';

export default function AdminSalaryTab() {
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState([]);
  
  // Commission settings modal
  const [configModal, setConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configForm, setConfigForm] = useState({
    base_salary_kes: 25000,
    letting_commission_rate: 50,
    management_commission_rate: 5,
    withholding_tax_rate: 5,
    tenant_onboarding_initiation_fee_kes: 1000
  });

  // Individual agent rates edit modal
  const [agentModal, setAgentModal] = useState({ open: false, agent: null });
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentForm, setAgentForm] = useState({
    base_salary_kes: '',
    letting_commission_rate: '',
    management_commission_rate: ''
  });

  useEffect(() => {
    loadPayroll();
    loadCommissionConfig();
  }, [selectedMonth]);

  const loadCommissionConfig = async () => {
    try {
      const res = await fetchCommissionConfig();
      if (res?.data) {
        setConfigForm({
          base_salary_kes: res.data.base_salary_kes ?? 25000,
          letting_commission_rate: (res.data.letting_commission_rate ?? 0.5) * 100,
          management_commission_rate: (res.data.management_commission_rate ?? 0.05) * 100,
          withholding_tax_rate: (res.data.withholding_tax_rate ?? 0.05) * 100,
          tenant_onboarding_initiation_fee_kes: res.data.tenant_onboarding_initiation_fee_kes ?? 1000
        });
      }
    } catch (err) {
      console.warn('Failed to load global commission config:', err.message);
    }
  };

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetchAgentPayrollList(selectedMonth);
      if (res?.success && res?.data) {
        setPayrollData(res.data);
      } else {
        setPayrollData([]);
      }
    } catch (err) {
      toast.error('Failed to load agent payroll list');
      setPayrollData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    try {
      await updateCommissionConfig({
        base_salary_kes: Number(configForm.base_salary_kes),
        letting_commission_rate: Number(configForm.letting_commission_rate) / 100,
        management_commission_rate: Number(configForm.management_commission_rate) / 100,
        withholding_tax_rate: Number(configForm.withholding_tax_rate) / 100,
        tenant_onboarding_initiation_fee_kes: Number(configForm.tenant_onboarding_initiation_fee_kes)
      });
      toast.success('Global commission & salary rules updated ✓');
      setConfigModal(false);
      loadPayroll();
    } catch (err) {
      toast.error(err?.error?.message || err?.message || 'Failed to update commission settings');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleOpenAgentModal = (agent, payroll) => {
    setAgentModal({ open: true, agent });
    setAgentForm({
      base_salary_kes: agent.base_salary_kes ?? (payroll?.base_salary_kes ?? configForm.base_salary_kes),
      letting_commission_rate: agent.letting_commission_rate !== undefined ? agent.letting_commission_rate * 100 : '',
      management_commission_rate: agent.management_commission_rate !== undefined ? agent.management_commission_rate * 100 : ''
    });
  };

  const handleSaveAgentConfig = async (e) => {
    e.preventDefault();
    if (!agentModal.agent?._id) return;
    setAgentSaving(true);
    try {
      const payload = {};
      if (agentForm.base_salary_kes !== '') payload.base_salary_kes = Number(agentForm.base_salary_kes);
      if (agentForm.letting_commission_rate !== '') payload.letting_commission_rate = Number(agentForm.letting_commission_rate) / 100;
      if (agentForm.management_commission_rate !== '') payload.management_commission_rate = Number(agentForm.management_commission_rate) / 100;

      await updateAgentCommissionConfig(agentModal.agent._id, payload);
      toast.success(`Updated rates for ${agentModal.agent.full_name || 'Agent'} ✓`);
      setAgentModal({ open: false, agent: null });
      loadPayroll();
    } catch (err) {
      toast.error(err?.error?.message || err?.message || 'Failed to update agent custom rates');
    } finally {
      setAgentSaving(false);
    }
  };

  const handleApprovePayroll = async (agentId) => {
    setProcessingId(agentId);
    try {
      const res = await processAgentPayroll({
        agent_id: agentId,
        billing_month: selectedMonth
      });
      if (res?.success) {
        toast.success('Agent payroll approved & M-Pesa B2C payout scheduled!');
        loadPayroll();
      } else {
        toast.error(res?.error?.message || 'Failed to process payroll');
      }
    } catch (err) {
      toast.error('Error approving agent payroll');
    } finally {
      setProcessingId(null);
    }
  };

  const totalNetPayable = payrollData.reduce((sum, item) => sum + (item.payroll?.net_payable_kes || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <DollarSign size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              Agent Salary & Commission Payroll
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Review agent commissions (letting, management, initiation) and execute M-Pesa B2C payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfigModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            title="Configure Commission & Salary Settings"
          >
            <Settings size={14} />
            <span>Salary & Commission Settings</span>
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 outline-none"
          />
          <button
            onClick={loadPayroll}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Refresh Payroll"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overview Stat Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Active Field Agents</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{payrollData.length}</span>
            <span className="text-xs text-slate-500">Registered</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Net Payroll ({selectedMonth})</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              KES {totalNetPayable.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payroll Status</p>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Ready for Daraja B2C Batch Execution</span>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <UserCheck size={16} className="text-indigo-400" />
            Itemized Agent Commission Payroll Table
          </h3>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Calculating commission structures...
          </div>
        ) : payrollData.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No agent records found for {selectedMonth}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Agent Name</th>
                  <th className="py-3 px-4">EARB License</th>
                  <th className="py-3 px-4 text-right">Base Salary</th>
                  <th className="py-3 px-4 text-right">Letting Fee</th>
                  <th className="py-3 px-4 text-right">Mgmt Fee</th>
                  <th className="py-3 px-4 text-right">Initiation Fee</th>
                  <th className="py-3 px-4 text-right">Gross (KES)</th>
                  <th className="py-3 px-4 text-right">Tax (5%)</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {payrollData.map(({ agent, payroll }, index) => (
                  <tr key={agent?._id || index} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{agent?.full_name || 'Agent'}</div>
                      <div className="text-[10px] text-slate-400">{agent?.phone || agent?.email || 'N/A'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300">
                      {agent?.earb_license_number ? (
                        <span className="flex items-center gap-1">
                          <Award size={12} className="text-emerald-400" />
                          {agent.earb_license_number}
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-300 font-semibold">
                      {(payroll?.base_salary_kes || agent?.base_salary_kes || configForm.base_salary_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {(payroll?.letting_commission_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {(payroll?.management_commission_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {(payroll?.initiation_fees_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                      {(payroll?.gross_earnings_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-400">
                      -{(payroll?.withholding_tax_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      KES {(payroll?.net_payable_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenAgentModal(agent, payroll)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                          title="Adjust Agent Rates & Salary"
                        >
                          <Edit2 size={12} />
                        </button>
                        {payroll?.payment_status === 'approved' || payroll?.payment_status === 'disbursed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} /> Approved
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApprovePayroll(agent._id)}
                            disabled={processingId === agent._id || (payroll?.net_payable_kes || 0) <= 0}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send size={12} />
                            {processingId === agent._id ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Commission & Salary Structure Modal */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative animate-fade-in text-white">
            <button
              onClick={() => setConfigModal(false)}
              className="absolute top-5 right-5 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-base font-black">Commission & Salary Structure</h3>
                <p className="text-xs text-slate-400">Administrative settings for agent compensation</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Default Agent Base Salary (KES)
                </label>
                <input
                  type="number"
                  value={configForm.base_salary_kes}
                  onChange={(e) => setConfigForm({ ...configForm, base_salary_kes: e.target.value })}
                  placeholder="e.g. 25000"
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Letting Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.letting_commission_rate}
                    onChange={(e) => setConfigForm({ ...configForm, letting_commission_rate: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">% of 1st month rent</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Management Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.management_commission_rate}
                    onChange={(e) => setConfigForm({ ...configForm, management_commission_rate: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">% of ongoing monthly rent</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Withholding Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.withholding_tax_rate}
                    onChange={(e) => setConfigForm({ ...configForm, withholding_tax_rate: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">KRA Statutory WHT (5%)</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Tenant Initiation Bonus (KES)
                  </label>
                  <input
                    type="number"
                    value={configForm.tenant_onboarding_initiation_fee_kes}
                    onChange={(e) => setConfigForm({ ...configForm, tenant_onboarding_initiation_fee_kes: e.target.value })}
                    placeholder="e.g. 1000"
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Flat bonus per new tenant</p>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={configLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {configLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Structure
                </button>
                <button
                  type="button"
                  onClick={() => setConfigModal(false)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Agent Rates Override Modal */}
      {agentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in text-white">
            <button
              onClick={() => setAgentModal({ open: false, agent: null })}
              className="absolute top-5 right-5 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-black">Agent Compensation Rates</h3>
                <p className="text-xs text-slate-400">{agentModal.agent?.full_name || 'Agent'}</p>
              </div>
            </div>

            <form onSubmit={handleSaveAgentConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Base Salary (KES)
                </label>
                <input
                  type="number"
                  value={agentForm.base_salary_kes}
                  onChange={(e) => setAgentForm({ ...agentForm, base_salary_kes: e.target.value })}
                  placeholder={`Default: ${configForm.base_salary_kes}`}
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Custom Letting Commission (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={agentForm.letting_commission_rate}
                  onChange={(e) => setAgentForm({ ...agentForm, letting_commission_rate: e.target.value })}
                  placeholder={`Default: ${configForm.letting_commission_rate}%`}
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Custom Management Commission (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={agentForm.management_commission_rate}
                  onChange={(e) => setAgentForm({ ...agentForm, management_commission_rate: e.target.value })}
                  placeholder={`Default: ${configForm.management_commission_rate}%`}
                  className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={agentSaving}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {agentSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Rates
                </button>
                <button
                  type="button"
                  onClick={() => setAgentModal({ open: false, agent: null })}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
