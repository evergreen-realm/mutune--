import React, { useState, useEffect } from 'react';
import { DollarSign, UserCheck, CheckCircle2, RefreshCw, Send, ShieldAlert, Award } from 'lucide-react';
import { fetchAgentPayrollList, processAgentPayroll } from '../lib/api';
import { toast } from 'react-toastify';

export default function AdminSalaryTab() {
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState([]);

  useEffect(() => {
    loadPayroll();
  }, [selectedMonth]);

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetchAgentPayrollList(selectedMonth);
      if (res?.success && res?.data) {
        setPayrollData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load agent payroll list');
    } finally {
      setLoading(false);
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
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 outline-none"
          />
          <button
            onClick={loadPayroll}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 transition-all"
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
                {payrollData.map(({ agent, payroll }) => (
                  <tr key={agent._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{agent.full_name || 'Agent'}</div>
                      <div className="text-[10px] text-slate-400">{agent.phone || agent.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300">
                      {agent.earb_license_number ? (
                        <span className="flex items-center gap-1">
                          <Award size={12} className="text-emerald-400" />
                          {agent.earb_license_number}
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
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
                      {payroll?.payment_status === 'approved' || payroll?.payment_status === 'disbursed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={12} /> Approved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApprovePayroll(agent._id)}
                          disabled={processingId === agent._id || (payroll?.net_payable_kes || 0) <= 0}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 mx-auto"
                        >
                          <Send size={12} />
                          {processingId === agent._id ? 'Approving...' : 'Approve Payout'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
