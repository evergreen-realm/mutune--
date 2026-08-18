import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, CreditCard, FileText, ShieldCheck, Layers, Droplets, RefreshCw,
  Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock,
  DollarSign, Users, Building2, Receipt, Scale, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, Printer, Eye, Filter, Search, ChevronDown, Calculator,
  Wallet, PieChart, BookOpen
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import {
  fetchAdminStats, fetchOverdueTenants, fetchReportsSummary, fetchIncomeStatement,
  fetchTrialBalance, fetchETIMSSummary, downloadETIMSCSV, downloadITMRI01CSV,
  downloadKRACSV, fetchUnmatchedPayments, assignUnmatchedPayment,
  fetchUtilityProviders, fetchWaterAnalytics, calculateMewascoWaterBill
} from '../lib/api';
import { exportToExcel, exportMultiSheetExcel } from '../lib/excelExport';
import TaxReportsTab from '../components/TaxReportsTab';
import AdminUtilitiesTab from '../components/AdminUtilitiesTab';
import UnmatchedPaymentsTab from '../components/UnmatchedPaymentsTab';
import PaperworkSuiteTab from '../components/PaperworkSuiteTab';

const TABS = [
  { key: 'overview',       label: 'Overview',           icon: BarChart3 },
  { key: 'gl',             label: 'GL & Trial Balance', icon: BookOpen },
  { key: 'payments',       label: 'Payments',           icon: CreditCard },
  { key: 'tax',            label: 'KRA Tax',            icon: ShieldCheck },
  { key: 'reports',        label: 'Financial Reports',  icon: FileSpreadsheet },
  { key: 'utilities',      label: 'Utilities',          icon: Droplets },
  { key: 'reconciliation', label: 'Reconciliation',     icon: Layers },
  { key: 'paperwork',      label: 'Paperwork',          icon: Receipt },
];

const KPI_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`;
  return `KES ${Number(n).toLocaleString('en-KE')}`;
}

function fmtNum(n) {
  return n != null ? Number(n).toLocaleString('en-KE') : '—';
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [statsRes, overdueRes] = await Promise.all([
        fetchAdminStats().catch(() => ({ data: {} })),
        fetchOverdueTenants().catch(() => ({ data: [] })),
      ]);
      setStats(statsRes?.data?.data || statsRes?.data || {});
      setOverdue(Array.isArray(overdueRes?.data?.data) ? overdueRes.data.data : []);

      // Build 6-month trend
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7));
      }
      const trend = await Promise.all(
        months.map(async (m) => {
          try {
            const r = await fetchReportsSummary(m);
            return { month: m.slice(5), revenue: r?.data?.data?.confirmedRevenue || 0 };
          } catch { return { month: m.slice(5), revenue: 0 }; }
        })
      );
      setTrendData(trend);
    } catch (err) {
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    if (!stats) return [];
    const totalRevenue = stats.totalRevenue || stats.confirmedRevenue || 0;
    const arrears = stats.totalArrears || stats.arrears || 0;
    const taxPayable = Math.round(totalRevenue * 0.075 + (totalRevenue * 0.2) * 0.1);
    const occupancy = stats.occupancyRate || stats.occupancy || 0;
    const netDisbursable = totalRevenue - taxPayable - arrears;
    return [
      { label: 'Total Revenue',     value: fmt(totalRevenue),     icon: TrendingUp,     color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Outstanding Arrears', value: fmt(arrears),        icon: AlertTriangle,  color: 'text-amber-400',   bg: 'bg-amber-500/10' },
      { label: 'Tax Payable',        value: fmt(taxPayable),      icon: ShieldCheck,    color: 'text-red-400',     bg: 'bg-red-500/10' },
      { label: 'Occupancy Rate',     value: `${(occupancy * 100 || occupancy || 0).toFixed(1)}%`, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Active Tenants',     value: fmtNum(stats.totalTenants || stats.tenants || 0), icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      { label: 'Net Disbursable',    value: fmt(netDisbursable),   icon: Wallet,         color: 'text-purple-400',  bg: 'bg-purple-500/10' },
    ];
  }, [stats]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${k.bg}`}>
                <k.icon size={14} className={k.color} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mb-0.5">{k.label}</p>
            <p className="text-lg font-black text-white tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Trend + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" /> Revenue Trend (6 Months)
            </h3>
            <button onClick={() => exportToExcel(trendData, [{key:'month',label:'Month'},{key:'revenue',label:'Revenue (KES)'}], 'Revenue_Trend')}
              className="text-[10px] px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1">
              <Download size={10} /> Excel
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
              <Tooltip formatter={(v) => [`KES ${Number(v).toLocaleString()}`, 'Revenue']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Overdue Tenants */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" /> Top Overdue Tenants
          </h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {overdue.length === 0 && <p className="text-xs text-slate-500">No overdue accounts</p>}
            {overdue.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/50">
                <div>
                  <p className="text-xs font-bold text-white">{t.tenant_name || t.full_name || '—'}</p>
                  <p className="text-[10px] text-slate-500">{t.tenant_code || t.property_name || ''}</p>
                </div>
                <span className="text-xs font-black text-amber-400">{fmt(t.arrears_kes || t.amount || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GL & TRIAL BALANCE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function GLTrialBalanceTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTB(); }, []);

  const loadTB = async () => {
    setLoading(true);
    try {
      const res = await fetchTrialBalance();
      setData(res?.data?.data || res?.data || null);
    } catch { toast.error('Failed to load trial balance'); }
    finally { setLoading(false); }
  };

  const typeColors = {
    asset: 'text-blue-400', liability: 'text-red-400', revenue: 'text-emerald-400',
    expense: 'text-amber-400', equity: 'text-indigo-400'
  };

  const handleExport = () => {
    if (!data?.rows) return;
    exportToExcel(data.rows, [
      { key: 'account_code', label: 'Account Code' },
      { key: 'account_name', label: 'Account Name' },
      { key: 'account_type', label: 'Type' },
      { key: 'debit_kes', label: 'Debit (KES)' },
      { key: 'credit_kes', label: 'Credit (KES)' },
    ], 'GL_Trial_Balance', 'Trial Balance');
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-400" /> General Ledger — Trial Balance
          </h2>
          <p className="text-xs text-slate-400 mt-1">Double-entry GL with debit = credit verification</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadTB} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all">
            <RefreshCw size={14} />
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all">
            <FileSpreadsheet size={13} /> Export Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Balance Check Badge */}
      {data && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold ${
          data.is_balanced
            ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400'
            : 'bg-red-950/30 border-red-500/20 text-red-400'
        }`}>
          {data.is_balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {data.is_balanced
            ? `✅ Trial Balance is BALANCED — Debits: KES ${fmtNum(data.total_debit_kes)} = Credits: KES ${fmtNum(data.total_credit_kes)}`
            : `❌ IMBALANCED — Debits: KES ${fmtNum(data.total_debit_kes)} ≠ Credits: KES ${fmtNum(data.total_credit_kes)}`
          }
        </div>
      )}

      {/* GL Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left p-3 font-semibold">Code</th>
                <th className="text-left p-3 font-semibold">Account Name</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-right p-3 font-semibold">Debit (KES)</th>
                <th className="text-right p-3 font-semibold">Credit (KES)</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows?.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-mono text-slate-300">{row.account_code}</td>
                  <td className="p-3 font-bold text-white">{row.account_name}</td>
                  <td className={`p-3 font-semibold capitalize ${typeColors[row.account_type] || 'text-slate-400'}`}>{row.account_type}</td>
                  <td className="p-3 text-right font-mono text-slate-200">{row.debit_kes > 0 ? fmtNum(row.debit_kes) : '—'}</td>
                  <td className="p-3 text-right font-mono text-slate-200">{row.credit_kes > 0 ? fmtNum(row.credit_kes) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-indigo-500/30 bg-slate-950/40">
                <td colSpan={3} className="p-3 font-black text-white text-right">TOTALS</td>
                <td className="p-3 text-right font-mono font-black text-emerald-400">{fmtNum(data?.total_debit_kes)}</td>
                <td className="p-3 text-right font-mono font-black text-emerald-400">{fmtNum(data?.total_credit_kes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL REPORTS TAB (Income Statement + Balance Sheet)
// ═══════════════════════════════════════════════════════════════════════════════
function FinancialReportsTab() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [incomeData, setIncomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('income');

  useEffect(() => { loadReports(); }, [month]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetchIncomeStatement(month);
      setIncomeData(res?.data?.data || null);
    } catch { toast.error('Failed to load income statement'); }
    finally { setLoading(false); }
  };

  const handleExportIncome = () => {
    if (!incomeData) return;
    const rows = [];
    // Revenue rows
    incomeData.revenue?.breakdown?.forEach(r => {
      rows.push({ section: 'Revenue', category: r.property_type, gross: r.gross_kes, tax: r.tax_kes, net: r.net_kes, count: r.count });
    });
    rows.push({ section: 'Revenue Total', category: '', gross: incomeData.revenue?.total, tax: '', net: '', count: '' });
    // Expense rows
    incomeData.expenses?.breakdown?.forEach(e => {
      rows.push({ section: 'Expense', category: e.category, gross: e.amount_kes, tax: '', net: '', count: e.count });
    });
    rows.push({ section: 'Expense Total', category: '', gross: incomeData.expenses?.total, tax: '', net: '', count: '' });
    rows.push({ section: 'NET INCOME', category: '', gross: incomeData.netIncome, tax: '', net: '', count: '' });

    exportToExcel(rows, [
      { key: 'section', label: 'Section' }, { key: 'category', label: 'Category' },
      { key: 'gross', label: 'Amount (KES)' }, { key: 'tax', label: 'Tax (KES)' },
      { key: 'net', label: 'Net (KES)' }, { key: 'count', label: 'Count' },
    ], `Income_Statement_${month}`, 'Income Statement');
  };

  const pieData = useMemo(() => {
    if (!incomeData?.expenses?.breakdown) return [];
    return incomeData.expenses.breakdown.map(e => ({ name: e.category || 'Other', value: e.amount_kes }));
  }, [incomeData]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-indigo-400" /> Financial Reports
          </h2>
          <p className="text-xs text-slate-400 mt-1">Income Statement, Balance Sheet & Cash Flow analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none" />
          <button onClick={handleExportIncome} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-fit">
        {[{k:'income',l:'Income Statement'},{k:'balance',l:'Balance Sheet'},{k:'cashflow',l:'Cash Flow'}].map(r => (
          <button key={r.k} onClick={() => setReportType(r.k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportType === r.k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {r.l}
          </button>
        ))}
      </div>

      {reportType === 'income' && incomeData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Income Statement */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">Income Statement — {month}</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Revenue Section */}
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Revenue</h4>
                {incomeData.revenue?.breakdown?.map((r, i) => (
                  <div key={i} className="flex justify-between py-1.5 px-2 rounded hover:bg-slate-800/30 text-xs">
                    <span className="text-slate-300 capitalize">{r.property_type} ({r.count} payments)</span>
                    <span className="font-mono text-white font-bold">KES {fmtNum(r.gross_kes)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 px-2 border-t border-slate-800 mt-1 text-xs font-black">
                  <span className="text-emerald-400">Total Revenue</span>
                  <span className="text-emerald-400 font-mono">KES {fmtNum(incomeData.revenue?.total)}</span>
                </div>
              </div>

              {/* Expense Section */}
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Expenses</h4>
                {incomeData.expenses?.breakdown?.map((e, i) => (
                  <div key={i} className="flex justify-between py-1.5 px-2 rounded hover:bg-slate-800/30 text-xs">
                    <span className="text-slate-300 capitalize">{e.category}</span>
                    <span className="font-mono text-white font-bold">KES {fmtNum(e.amount_kes)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 px-2 border-t border-slate-800 mt-1 text-xs font-black">
                  <span className="text-amber-400">Total Expenses</span>
                  <span className="text-amber-400 font-mono">KES {fmtNum(incomeData.expenses?.total)}</span>
                </div>
              </div>

              {/* Tax Liability */}
              <div>
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Tax Liability</h4>
                <div className="flex justify-between py-1.5 px-2 text-xs">
                  <span className="text-slate-300">MRI Withholding (7.5%)</span>
                  <span className="font-mono text-white">KES {fmtNum(incomeData.taxLiability?.mri)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-xs">
                  <span className="text-slate-300">WHT Commercial (10%)</span>
                  <span className="font-mono text-white">KES {fmtNum(incomeData.taxLiability?.wht)}</span>
                </div>
              </div>

              {/* Net Income */}
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                <div className="flex justify-between text-sm font-black">
                  <span className="text-indigo-300 flex items-center gap-2">
                    {incomeData.netIncome >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    Net Income
                  </span>
                  <span className={incomeData.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    KES {fmtNum(incomeData.netIncome)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown Pie */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <h3 className="text-sm font-bold text-slate-200 mb-3">Expense Breakdown</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `KES ${Number(v).toLocaleString()}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : <p className="text-xs text-slate-500">No expense data for this period</p>}
          </div>
        </div>
      )}

      {reportType === 'balance' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <h3 className="text-sm font-black text-white mb-4">Balance Sheet — {month}</h3>
          <p className="text-xs text-slate-400 mb-4">Derived from General Ledger account balances. View the GL & Trial Balance tab for full account details.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20">
              <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Assets</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Cash at Bank (M-Pesa Float)</span><span className="text-white font-mono">—</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Accounts Receivable</span><span className="text-white font-mono">—</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Property Deposits</span><span className="text-white font-mono">—</span></div>
              </div>
              <div className="mt-3 pt-2 border-t border-blue-500/20 flex justify-between text-xs font-black">
                <span className="text-blue-400">Total Assets</span><span className="text-blue-400 font-mono">—</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20">
              <h4 className="text-xs font-bold text-red-400 uppercase mb-3">Liabilities</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Security Deposits Held</span><span className="text-white font-mono">—</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tax Payable</span><span className="text-white font-mono">KES {fmtNum((incomeData?.taxLiability?.mri || 0) + (incomeData?.taxLiability?.wht || 0))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tenant Overpayments</span><span className="text-white font-mono">—</span></div>
              </div>
              <div className="mt-3 pt-2 border-t border-red-500/20 flex justify-between text-xs font-black">
                <span className="text-red-400">Total Liabilities</span><span className="text-red-400 font-mono">—</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
              <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3">Equity</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Retained Earnings</span><span className="text-white font-mono">KES {fmtNum(incomeData?.netIncome)}</span></div>
              </div>
              <div className="mt-3 pt-2 border-t border-indigo-500/20 flex justify-between text-xs font-black">
                <span className="text-indigo-400">Total Equity</span><span className="text-indigo-400 font-mono">KES {fmtNum(incomeData?.netIncome)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'cashflow' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <h3 className="text-sm font-black text-white mb-4">Cash Flow Statement — {month}</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
              <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Cash from Operations</h4>
              <div className="flex justify-between text-xs py-1"><span className="text-slate-300">Rent Collected</span><span className="text-white font-mono">KES {fmtNum(incomeData?.revenue?.total)}</span></div>
              <div className="flex justify-between text-xs py-1"><span className="text-slate-300">Operating Expenses Paid</span><span className="text-red-400 font-mono">- KES {fmtNum(incomeData?.expenses?.total)}</span></div>
              <div className="flex justify-between text-xs py-1"><span className="text-slate-300">Tax Payments (MRI + WHT)</span><span className="text-red-400 font-mono">- KES {fmtNum((incomeData?.taxLiability?.mri || 0) + (incomeData?.taxLiability?.wht || 0))}</span></div>
              <div className="flex justify-between text-xs font-black pt-2 border-t border-emerald-500/20 mt-1">
                <span className="text-emerald-400">Net Cash from Operations</span>
                <span className="text-emerald-400 font-mono">KES {fmtNum((incomeData?.revenue?.total || 0) - (incomeData?.expenses?.total || 0) - (incomeData?.taxLiability?.mri || 0) - (incomeData?.taxLiability?.wht || 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-800/50" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-800/50" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ACCOUNTANT DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AccountantDashboardPage({ dbUser }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 pt-4 space-y-4">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Calculator size={20} className="text-indigo-400" />
              Accountant Financial Portal
            </h1>
            <p className="text-xs text-muted mt-1">
              Enterprise financial management • GL • Tax • Reports • Reconciliation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg font-bold border border-indigo-500/20">
              {dbUser?.full_name || 'Accountant'}
            </span>
            <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg font-bold border border-emerald-500/20 uppercase">
              {dbUser?.role || 'accountant'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl self-start overflow-x-auto max-w-full scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex-shrink-0 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground hover:bg-surface-bright'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'gl' && <GLTrialBalanceTab />}
        {activeTab === 'payments' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2 mb-1">
                <CreditCard size={18} className="text-indigo-400" /> Payment Management
              </h2>
              <p className="text-xs text-slate-400">View, verify, and export payment records</p>
            </div>
            <UnmatchedPaymentsTab />
          </div>
        )}
        {activeTab === 'tax' && <TaxReportsTab />}
        {activeTab === 'reports' && <FinancialReportsTab />}
        {activeTab === 'utilities' && <AdminUtilitiesTab />}
        {activeTab === 'reconciliation' && <UnmatchedPaymentsTab />}
        {activeTab === 'paperwork' && <PaperworkSuiteTab />}
      </div>
    </div>
  );
}
