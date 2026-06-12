import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Home, Building2, Download, RefreshCw,
  ArrowUpRight, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchAdminStats, downloadKRAReport } from '../lib/api';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const MONTH_LABELS = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

function formatMonth(yyyyMM) {
  const [year, mon] = yyyyMM.split('-');
  return `${MONTH_LABELS[mon] || mon} ${year.slice(2)}`;
}

function StatCard({ icon, label, value, sub, color }) {
  const palette = {
    blue:   'from-blue-50 to-blue-50/0 border-blue-100 text-blue-700',
    green:  'from-green-50 to-green-50/0 border-green-100 text-green-700',
    yellow: 'from-yellow-50 to-yellow-50/0 border-yellow-100 text-yellow-700',
    slate:  'from-slate-50 to-slate-50/0 border-slate-100 text-slate-700'
  };
  return (
    <div className={`bg-gradient-to-tr ${palette[color] || palette.slate} border rounded-2xl p-5`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60 mb-2">
        {icon} {label}
      </div>
      <div className="text-2xl font-black">{value ?? '—'}</div>
      {sub && <div className="text-[11px] mt-1 opacity-60">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="text-green-700 font-semibold">KES {payload[0]?.value?.toLocaleString()}</p>
      {payload[0]?.payload?.transactions && (
        <p className="text-gray-400">{payload[0].payload.transactions} payments</p>
      )}
    </div>
  );
};

export default function AdminDashboardPage() {
  const [kraMonth, setKraMonth] = useState(new Date().toISOString().slice(0, 7));
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats
  });

  const stats = data?.data;

  const handleDownloadKRA = async () => {
    if (!kraMonth) { toast.error('Select a month'); return; }
    setDownloading(true);
    try {
      await downloadKRAReport(kraMonth);
      toast.success(`KRA reconciliation for ${kraMonth} downloaded ✓`);
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-red-200 rounded-2xl bg-red-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-400 mb-2" size={28} />
          <p className="text-red-600 font-semibold text-sm">Failed to load admin stats</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-red-500 underline">
            Retry
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Revenue analytics · Mombasa Estate Agency</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-stats"
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-100 transition"
            title="Refresh stats"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Home size={14} />}
          label="Properties"
          value={stats?.summary?.totalProperties}
          color="blue"
        />
        <StatCard
          icon={<Users size={14} />}
          label="Active Tenants"
          value={stats?.summary?.totalTenants}
          color="green"
        />
        <StatCard
          icon={<Building2 size={14} />}
          label="Field Agents"
          value={stats?.summary?.totalAgents}
          color="yellow"
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="Occupancy"
          value={`${stats?.summary?.occupancyRate ?? 0}%`}
          sub={`${stats?.summary?.occupiedUnits ?? 0} / ${stats?.summary?.totalUnits ?? 0} units`}
          color="slate"
        />
      </div>

      {/* Revenue Chart + Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Monthly Revenue (Last 6 Months)</h3>
            <ArrowUpRight size={16} className="text-green-500" />
          </div>
          {revenueData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdf4' }} />
                <Bar dataKey="amount" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              No confirmed payments in the last 6 months
            </div>
          )}
        </div>

        {/* Payment Breakdown Pie */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Payment Status</h3>
          {paymentPieData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {paymentPieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-600 capitalize">{value}</span>}
                />
                <Tooltip formatter={(v) => [`${v} payments`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No payments yet</div>
          )}
        </div>
      </div>

      {/* Top Agents + KRA Download */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-900">Top Performing Agents (6 months)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats?.topAgents?.length ? (
              stats.topAgents.map((agent, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-black">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{agent.name}</p>
                      {agent.email && <p className="text-[10px] text-gray-400">{agent.email}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-900">KES {agent.total?.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">{agent.count} transactions</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No agent performance data yet
              </div>
            )}
          </div>
        </div>

        {/* KRA Download */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-1">KRA Reconciliation Report</h3>
          <p className="text-xs text-gray-400 mb-5">
            CSV export with 5% withholding tax for commercial properties. UTF-8 BOM for Excel.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5" htmlFor="kra-month">
                Select Month
              </label>
              <input
                id="kra-month"
                type="month"
                value={kraMonth}
                onChange={(e) => setKraMonth(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
            </div>
            <button
              id="btn-download-kra"
              onClick={handleDownloadKRA}
              disabled={downloading || !kraMonth}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {downloading
                ? <RefreshCw size={15} className="animate-spin" />
                : <Download size={15} />
              }
              {downloading ? 'Generating…' : 'Download KRA Report'}
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              Available to Admin, Super Admin, and Accountant roles
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
