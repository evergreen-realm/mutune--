import React, { useState, useEffect } from 'react';
import { Layers, Send, CheckCircle2, RefreshCw, AlertCircle, ArrowUpRight, Play, Server } from 'lucide-react';
import { fetchDisbursementPriority, executeBulkDisbursement } from '../lib/api';
import { toast } from 'react-toastify';

export default function DisbursementTab() {
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [queueData, setQueueData] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await fetchDisbursementPriority();
      if (res?.success && res?.data) {
        setQueueData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load disbursement queue');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteBulk = async () => {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const res = await executeBulkDisbursement();
      if (res?.success) {
        toast.success('Priority bulk disbursement completed successfully!');
        setExecutionResult(res.data);
        loadQueue();
      } else {
        toast.error(res?.error?.message || 'Bulk disbursement failed');
      }
    } catch (err) {
      toast.error('Error executing bulk disbursement');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Loading priority disbursement queue...
      </div>
    );
  }

  const categoryLabels = {
    landlords: '1. Landlords (Net Property Remittances)',
    agents: '2. Field Agents (Monthly Salary & Commissions)',
    suppliers: '3. Contractors & Maintenance Suppliers',
    staff: '4. Administrative Staff Payroll',
    tenants: '5. Tenant Deposit Refunds'
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Layers size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              Priority Bulk Disbursement Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Batch execute payouts via Safaricom Daraja B2C API in strict priority sequence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 flex items-center gap-2">
            <Server size={14} />
            <span>Sandbox Mode (B2C)</span>
          </div>
          <button
            onClick={handleExecuteBulk}
            disabled={executing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <Play size={14} />
            {executing ? 'Executing Batch Payouts...' : 'Execute Priority Bulk Disbursement'}
          </button>
        </div>
      </div>

      {/* Priority Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {queueData?.queue_summary?.map((item) => (
          <div key={item.category} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Priority #{item.priority_rank}
            </div>
            <div className="text-sm font-bold text-white capitalize mb-2">
              {item.category}
            </div>
            <div className="text-lg font-black font-mono text-emerald-400">
              KES {(item.pending_amount_kes || 0).toLocaleString('en-KE')}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {item.pending_count} pending payouts
            </div>
          </div>
        ))}
      </div>

      {/* Execution Results Log */}
      {executionResult && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 size={18} />
            <span>Daraja B2C Execution Results Summary</span>
          </div>

          <div className="space-y-3 text-xs">
            {executionResult.stages?.map((stage) => (
              <div key={stage.category} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 capitalize">{stage.category} Payouts:</span>
                  <span className="text-slate-400 ml-2">{stage.count} processed</span>
                </div>
                <span className="font-mono text-emerald-400 font-bold">
                  KES {(stage.total_kes || 0).toLocaleString('en-KE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
