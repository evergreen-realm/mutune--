import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Home, Building2, Download, RefreshCw,
  ArrowUpRight, AlertCircle, ShieldCheck, CheckCircle2, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  fetchAdminStats, downloadKRAReport, 
  fetchPendingAgents, fetchPendingLandlords, fetchPendingProperties 
} from '../lib/api';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const MONTH_LABELS = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

function formatMonth(yyyyMM) {
  if (!yyyyMM) return '';
  const [year, mon] = yyyyMM.split('-');
  return `${MONTH_LABELS[mon] || mon} ${year.slice(2)}`;
}

function StatCard({ icon, label, value, sub, color, index }) {
  const palette = {
    blue:   'from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-blue-500/5',
    green:  'from-green-500/10 to-emerald-500/5 dark:from-green-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-green-500/20 shadow-emerald-500/5',
    yellow: 'from-amber-500/10 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/5',
    slate:  'from-slate-500/10 to-slate-600/5 dark:from-slate-500/20 dark:to-slate-600/10 text-muted border-border shadow-slate-500/5'
  };

  const iconBg = {
    blue:   'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    green:  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    slate:  'bg-slate-500/20 text-muted'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}
      className={`bg-gradient-to-tr ${palette[color] || palette.slate} border rounded-2xl p-5 shadow-sm flex justify-between items-start`}
    >
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-60 mb-2">
          {label}
        </div>
        <div className="text-2xl font-black text-foreground">{value ?? '—'}</div>
        {sub && <div className="text-xs mt-1.5 opacity-70 font-semibold">{sub}</div>}
      </div>
      <div className={`p-2.5 rounded-xl ${iconBg[color] || iconBg.slate} shadow-inner`}>
        {icon}
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-2xl shadow-xl p-3.5 text-xs">
      <p className="font-extrabold text-foreground mb-1">{label}</p>
      <p className="text-emerald-700 font-black">KES {payload[0]?.value?.toLocaleString()}</p>
      {payload[0]?.payload?.transactions && (
        <p className="text-muted text-xs font-bold uppercase mt-1">{payload[0].payload.transactions} payments settled</p>
      )}
    </div>
  );
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const [kraMonth, setKraMonth] = useState(new Date().toISOString().slice(0, 7));
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats
  });

  const { data: pendingAgentsData } = useQuery({
    queryKey: ['pendingAgents'],
    queryFn: fetchPendingAgents
  });

  const { data: pendingLandlordsData } = useQuery({
    queryKey: ['pendingLandlords'],
    queryFn: fetchPendingLandlords
  });

  const { data: pendingPropertiesData } = useQuery({
    queryKey: ['pendingProperties'],
    queryFn: fetchPendingProperties
  });

  const stats = data?.data;

  const pendingAgentsCount = pendingAgentsData?.data?.length || 0;
  const pendingLandlordsCount = pendingLandlordsData?.data?.length || 0;
  const pendingPropertiesCount = pendingPropertiesData?.data?.length || 0;
  const totalPending = pendingAgentsCount + pendingLandlordsCount + pendingPropertiesCount;

  const handleDownloadKRA = async () => {
    if (!kraMonth) { toast.error('Select a month'); return; }
    setDownloading(true);
    try {
      await downloadKRAReport(kraMonth);
      toast.success(`KRA withholding statement for ${kraMonth} downloaded successfully ✓`);
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to download KRA statement');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-red-200 rounded-2xl bg-red-50/50 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={28} />
          <p className="text-red-600 font-bold text-sm">Failed to retrieve administrative analytics</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-red-550 underline cursor-pointer">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const revenueData = (stats?.revenue || []).map((r) => ({
    ...r,
    label: formatMonth(r.month)
  }));

  const paymentPieData = (stats?.paymentBreakdown || []).map((s) => ({
    name: s.status,
    value: s.count
  }));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Revenue analytics · Mombasa Estate Agency</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 text-muted hover:text-foreground hover:bg-background rounded-xl border border-border transition cursor-pointer"
          title="Refresh stats"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Home size={18} />}
          label="Managed Properties"
          value={stats?.summary?.totalProperties}
          color="blue"
          index={0}
        />
        <StatCard
          icon={<Users size={18} />}
          label="Active Leases"
          value={stats?.summary?.totalTenants}
          color="green"
          index={1}
        />
        <StatCard
          icon={<Building2 size={18} />}
          label="Registered Agents"
          value={stats?.summary?.totalAgents}
          color="yellow"
          index={2}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Occupancy Rate"
          value={`${stats?.summary?.occupancyRate ?? 0}%`}
          sub={`${stats?.summary?.occupiedUnits ?? 0} / ${stats?.summary?.totalUnits ?? 0} units occupied`}
          color="slate"
          index={3}
        />
      </div>

      {/* Monthly Revenue Banner */}
      {(() => {
        const lastMonth = stats?.revenue?.slice(-1)?.[0];
        if (!lastMonth) return null;
        const [yr, mon] = lastMonth.month.split('-');
        const label = `${MONTH_LABELS[mon] || mon} ${yr}`;
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 opacity-80 mb-1">Monthly Billing Revenue — {label}</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">KES {lastMonth.amount?.toLocaleString('en-KE')}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">{lastMonth.transactions} payments settled this month</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
          </motion.div>
        );
      })()}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-foreground text-sm">Monthly Revenue Trend</h3>
              <p className="text-xs text-muted mt-0.5">Settle statement over the last 6 months</p>
            </div>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          
          <div className="h-60 w-full">
            {revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} barSize={26}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdf4/40', radius: 4 }} />
                  <Bar dataKey="amount" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                No verified payments in the ledger database.
              </div>
            )}
          </div>
        </div>

        {/* Payment Breakdown Pie */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-foreground text-sm">Settlement Status</h3>
            <p className="text-xs text-muted mt-0.5">Summary of transaction counts</p>
          </div>
          
          <div className="h-48 w-full mt-4">
            {paymentPieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentPieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => <span className="text-xs text-muted capitalize font-bold">{value}</span>}
                    iconSize={8}
                    wrapperStyle={{ paddingTop: '8px' }}
                  />
                  <Tooltip formatter={(v) => [`${v} payments`, '']} contentStyle={{ borderRadius: 12, border: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">No payments logged</div>
            )}
          </div>
        </div>
      </div>

      {/* Performance, KRA & Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Performing Agents */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-border bg-background/50">
              <h3 className="font-extrabold text-foreground text-xs uppercase tracking-wider">Top Field Agents</h3>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {stats?.topAgents?.length ? (
                stats.topAgents.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-background/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs font-black">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-foreground">{agent.name}</p>
                        {agent.email && <p className="text-xs text-muted font-medium truncate w-32 sm:w-auto">{agent.email}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-foreground">KES {agent.total?.toLocaleString()}</p>
                      <p className="text-xs text-muted font-semibold">{agent.count} collections</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-xs text-slate-400 font-semibold">
                  No performance history recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KRA Download */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-foreground text-sm">KRA Withholding Tax</h3>
            <p className="text-xs text-muted leading-relaxed mt-1">
              Monthly CSV reconciliation with 5% withholding tax calculated for commercial properties.
            </p>
            <div className="space-y-4.5 mt-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5" htmlFor="kra-month">
                  Select Billing Month
                </label>
                <input
                  id="kra-month"
                  type="month"
                  value={kraMonth}
                  onChange={(e) => setKraMonth(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition text-foreground font-bold"
                />
              </div>
              <button
                id="btn-download-kra"
                onClick={handleDownloadKRA}
                disabled={downloading || !kraMonth}
                className="w-full py-3 bg-primary hover:opacity-90 active:scale-[0.99] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer uppercase tracking-wider shadow-sm"
              >
                {downloading ? (
                  <><Loader2 size={13} className="animate-spin" /> Generating…</>
                ) : (
                  <><Download size={13} /> Download Report</>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted text-center mt-3 font-semibold">
            Authorized for Admin, Super Admin & Accountant roles
          </p>
        </div>

        {/* Verification Queue Widget */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1 border-b border-border pb-2">
              <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                <ShieldCheck className="text-indigo-600 animate-pulse" size={18} /> Approvals Queue
              </h3>
              {totalPending > 0 && (
                <span className="bg-red-500/10 text-red-500 text-xs font-black px-2 py-0.5 rounded-full border border-red-500/20">
                  {totalPending} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1">
              Verify credentials and approve listed properties.
            </p>

            <div className="space-y-2 mt-4">
              <div 
                onClick={() => navigate('/admin/users', { state: { defaultTab: 'agents' } })}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-background border border-border cursor-pointer transition"
              >
                <span className="text-xs font-bold text-foreground">Pending Agents</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${pendingAgentsCount > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse' : 'bg-background text-muted border border-border'}`}>
                  {pendingAgentsCount}
                </span>
              </div>

              <div 
                onClick={() => navigate('/admin/users', { state: { defaultTab: 'landlords' } })}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-background border border-border cursor-pointer transition"
              >
                <span className="text-xs font-bold text-foreground">Pending Landlords</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${pendingLandlordsCount > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse' : 'bg-background text-muted border border-border'}`}>
                  {pendingLandlordsCount}
                </span>
              </div>

              <div 
                onClick={() => navigate('/admin/users', { state: { defaultTab: 'properties' } })}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-background border border-border cursor-pointer transition"
              >
                <span className="text-xs font-bold text-foreground">Pending Listings</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${pendingPropertiesCount > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse' : 'bg-background text-muted border border-border'}`}>
                  {pendingPropertiesCount}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/admin/users')}
            className="w-full py-3 mt-4 border border-border hover:bg-background text-foreground rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider"
          >
            Manage Approvals <ChevronRight size={13} />
          </button>
        </div>

      </div>
    </motion.div>
  );
}
