import React, { useState, useEffect } from 'react';
import { ShieldCheck, Download, RefreshCw, Server, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { fetchETIMSSummary, downloadETIMSCSV } from '../lib/api';
import { toast } from 'react-toastify';

export default function TaxReportsTab() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [taxData, setTaxData] = useState(null);

  useEffect(() => {
    loadTaxData();
  }, [selectedMonth]);

  const loadTaxData = async () => {
    setLoading(true);
    try {
      const res = await fetchETIMSSummary(selectedMonth);
      if (res?.success && res?.data) {
        setTaxData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load KRA eTIMS tax summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await downloadETIMSCSV(selectedMonth);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KRA_eTIMS_Report_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded KRA eTIMS Tax CSV report ✓');
    } catch (err) {
      toast.error('Error downloading tax report');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <ShieldCheck size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              KRA eTIMS Tax Compliance Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Kenya Revenue Authority (KRA) Monthly Rental Income (MRI 7.5%), Withholding Tax (5%), and VAT (16%) automated reporting.
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
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <Download size={14} /> Export KRA eTIMS Report
          </button>
        </div>
      </div>

      {/* Device Status Badge */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={18} className="text-emerald-400" />
          <div>
            <div className="text-xs font-bold text-white">eTIMS Control Unit (CU) Serial</div>
            <div className="text-[11px] font-mono text-indigo-300">{taxData?.cu_serial_number || 'KRA-CU-99887766'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            {taxData?.etims_device_status || 'ONLINE_ACTIVE'}
          </span>
        </div>
      </div>

      {/* Tax Liability Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">MRI Rental Income Tax (7.5%)</p>
          <div className="text-2xl font-black font-mono text-emerald-400">
            KES {(taxData?.mri_tax_kes || 0).toLocaleString('en-KE')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Section 6A Income Tax Act</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Agency Withholding Tax (5%)</p>
          <div className="text-2xl font-black font-mono text-indigo-400">
            KES {(taxData?.withholding_tax_kes || 0).toLocaleString('en-KE')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Resident Commission Rate</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Commercial Property VAT (16%)</p>
          <div className="text-2xl font-black font-mono text-amber-400">
            KES {(taxData?.vat_tax_kes || 0).toLocaleString('en-KE')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Value Added Tax Portion</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-xl bg-emerald-500/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Total KRA Net Tax Payable</p>
          <div className="text-2xl font-black font-mono text-emerald-400">
            KES {(taxData?.net_tax_payable_kes || 0).toLocaleString('en-KE')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Due by 20th of following month</p>
        </div>
      </div>
    </div>
  );
}
