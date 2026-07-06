import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Home, Building2, Download, RefreshCw,
  ArrowUpRight, AlertCircle, ShieldCheck, CheckCircle2, ChevronRight, Loader2,
  Plus, Trash2, Edit2, DollarSign, Save, X, Phone, Mail, Receipt, Box
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchAdminStats, downloadKRAReport,
  fetchPendingAgents, fetchPendingLandlords, fetchPendingProperties,
  fetchLateFeeRules, createLateFeeRule, updateLateFeeRule, deleteLateFeeRule,
  fetchProperties
} from '../lib/api';
import MapWidget from '../components/MapWidget';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const EMPTY_RULE = { grace_period_days: 5, fee_type: 'flat', amount_kes: 500, cap_kes: '' };

const FMT_KES = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Late Fee Rules Panel ──────────────────────────────────────────────────────
function LateFeePanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm]     = useState(false);
  const [editId,   setEditId]       = useState(null);
  const [form,     setForm]         = useState(EMPTY_RULE);

  const { data, isLoading } = useQuery({
    queryKey: ['lateFeeRules'],
    queryFn: fetchLateFeeRules
  });
  const rules = data?.data || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lateFeeRules'] });

  const createMut = useMutation({
    mutationFn: createLateFeeRule,
    onSuccess: () => { toast.success('Late fee rule created'); invalidate(); setShowForm(false); setForm(EMPTY_RULE); },
    onError: (e) => toast.error(e?.error?.message || 'Failed to create rule')
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateLateFeeRule(id, data),
    onSuccess: () => { toast.success('Rule updated'); invalidate(); setEditId(null); },
    onError: (e) => toast.error(e?.error?.message || 'Failed to update rule')
  });

  const deleteMut = useMutation({
    mutationFn: deleteLateFeeRule,
    onSuccess: () => { toast.success('Rule deleted'); invalidate(); },
    onError: (e) => toast.error(e?.error?.message || 'Failed to delete rule')
  });

  const handleSubmit = () => {
    const payload = {
      grace_period_days: Number(form.grace_period_days),
      fee_type: form.fee_type,
      amount_kes: Number(form.amount_kes),
      ...(form.cap_kes !== '' ? { cap_kes: Number(form.cap_kes) } : {})
    };
    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const startEdit = (rule) => {
    setEditId(rule._id);
    setForm({ grace_period_days: rule.grace_period_days, fee_type: rule.fee_type, amount_kes: rule.amount_kes, cap_kes: rule.cap_kes ?? '' });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_RULE); };

  const inputCls = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-green-500/50 transition';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-muted mb-1';

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
            <DollarSign size={16} className="text-amber-500" /> Late Fee Rules
          </h3>
          <p className="text-xs text-muted mt-0.5">Automatic penalties for late rent payments</p>
        </div>
        <button
          onClick={() => { setEditId(null); setForm(EMPTY_RULE); setShowForm(s => !s); }}
          className="flex items-center gap-1 text-xs font-bold bg-green-500/10 hover:bg-green-500/20 text-green-600 border border-green-500/20 px-3 py-1.5 rounded-xl transition"
        >
          <Plus size={13} /> Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-background/40 border border-border rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {editId ? 'Edit Penalty Rule' : 'New Penalty Rule'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Grace Period (Days)</label>
              <input
                type="number"
                value={form.grace_period_days}
                onChange={e => setForm(f => ({ ...f, grace_period_days: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fee Type</label>
              <select
                value={form.fee_type}
                onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))}
                className={inputCls}
              >
                <option value="flat">Flat Fee</option>
                <option value="percent">Percentage</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{form.fee_type === 'percent' ? 'Percentage (%)' : 'Amount (KES)'}</label>
              <input
                type="number"
                value={form.amount_kes}
                onChange={e => setForm(f => ({ ...f, amount_kes: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cap Amount (KES, Optional)</label>
              <input
                type="number"
                value={form.cap_kes}
                onChange={e => setForm(f => ({ ...f, cap_kes: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancelForm} className="px-4 py-2 bg-surface hover:bg-background border border-border text-muted rounded-xl text-xs font-bold transition">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-lg">Save Rule</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-xs text-muted">Retrieving rule configurations…</div>
      ) : rules.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">No late fee rules created yet</p>
      ) : (
        <div className="divide-y divide-border/40">
          {rules.map(r => (
            <div key={r._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-xs font-bold text-foreground">
                  Grace Period: {r.grace_period_days} Days · {r.fee_type === 'percent' ? `${r.amount_kes}%` : FMT_KES(r.amount_kes)} {r.fee_type}
                </p>
                {r.cap_kes && <p className="text-[10px] text-muted mt-0.5">Maximum Cap: {FMT_KES(r.cap_kes)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(r)} className="p-1.5 bg-background/50 hover:bg-surface border border-border rounded-lg text-muted hover:text-foreground transition"><Edit2 size={12} /></button>
                <button onClick={() => deleteMut.mutate(r._id)} className="p-1.5 bg-background/50 hover:bg-red-500/10 border border-border hover:border-red-500/30 text-muted hover:text-red-400 rounded-lg transition"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const [downloading, setDownloading] = useState(false);
  const [kraMonth, setKraMonth]     = useState(new Date().toISOString().slice(0, 7));

  // Interactive Popup Modal states
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);

  const formatMonth = (m) => {
    const [y, mon] = m.split('-');
    const date = new Date(Number(y), Number(mon) - 1, 1);
    return date.toLocaleString('en-KE', { month: 'short' });
  };

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

  const { data: propData } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties
  });

  const properties = propData?.data || [];
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
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-red-500/30 rounded-2xl bg-red-500/5 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={28} />
          <p className="text-red-600 font-bold text-sm">Failed to retrieve administrative analytics</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-red-500 underline cursor-pointer">
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
      className="space-y-6 pb-12 text-foreground"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block mb-1">Administrative Center</span>
          <h1 className="text-2xl font-black text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Revenue analytics · Mombasa Estate Agency</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 text-muted hover:text-foreground hover:bg-background rounded-xl border border-border transition cursor-pointer self-start"
          title="Refresh stats"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">Properties</p>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black">{properties.length}</span>
            <span className="text-[10px] text-muted font-medium">Registered units</span>
          </div>
        </div>
        
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">Active Tenants</p>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black">{stats?.totalTenants || 0}</span>
            <span className="text-[10px] text-muted font-medium">Active leases</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">Collection Rate</p>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-emerald-400">{stats?.collectionRatePct || 0}%</span>
            <span className="text-[10px] text-muted font-medium">Monthly efficiency</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">This Month Revenue</p>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-primary font-mono">{FMT_KES(stats?.currentMonthCollected || 0)}</span>
          </div>
        </div>
      </div>

      {/* Property Map Section for Admins */}
      <div className="bg-surface border border-border rounded-[24px] overflow-hidden shadow-sm p-4 relative z-10">
        <MapWidget 
          properties={properties} 
          isAdmin={true} 
          theme={theme} 
          onPropertySelect={(p) => setSelectedProperty(p)}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-foreground text-xs uppercase tracking-wider">Monthly Revenue Trend</h3>
              <p className="text-[10px] text-muted mt-0.5">Settle statement over the last 6 months</p>
            </div>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          
          <div className="h-60 w-full">
            {revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} fontStyle="bold" />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `KES ${val / 1000}K`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#cbd5e1' }}
                    labelClassName="text-slate-500 font-bold"
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted text-center pt-20">No revenue data available</p>
            )}
          </div>
        </div>

        {/* Portfolio Distribution Pie Chart */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-foreground text-xs uppercase tracking-wider mb-1">Portfolio Distribution</h3>
            <p className="text-[10px] text-muted mb-4">Rent reconciliation by transaction status</p>
          </div>

          <div className="h-48 w-full relative">
            {paymentPieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted text-center pt-16">No transactions found</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid widgets: KRA + Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KRA Tax withholding Statement Widget */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
              <Download className="text-primary" size={18} /> Tax Statement
            </h3>
            <p className="text-xs text-muted mt-1">
              Download KRA Withholding Tax Certificate.
            </p>
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Statement Month</label>
              <input
                id="kra-month-input"
                type="month"
                value={kraMonth}
                onChange={(e) => setKraMonth(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-green-500/50 transition font-bold"
              />
            </div>
          </div>

          <button
            onClick={handleDownloadKRA}
            disabled={downloading}
            className="w-full py-3 mt-4 bg-primary hover:bg-primary/95 text-background rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 uppercase tracking-wider shadow-md active:scale-95"
          >
            {downloading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Fetching statement…
              </>
            ) : (
              <>
                <Download size={13} /> Fetch withholding certificate
              </>
            )}
          </button>
        </div>

        {/* Pending approvals widget */}
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

        {/* Late Fee Rules Box */}
        <LateFeePanel />
      </div>

      {/* ── Property Detail Popup (selectedProperty modal) ──────────────────── */}
      {selectedProperty && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden relative text-foreground">
            <button
              onClick={() => { setSelectedProperty(null); setSelectedUnit(null); }}
              className="absolute top-4 right-4 z-10 p-1.5 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            {/* Hero Property Photo */}
            <div className="relative h-48 bg-slate-950">
              {selectedProperty.photos?.[0] ? (
                <img src={selectedProperty.photos[0]} alt={selectedProperty.name} className="w-full h-full object-cover opacity-85" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 to-slate-900/40 flex items-center justify-center text-muted">
                  <Building2 size={36} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="bg-primary/95 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                  {selectedProperty.type?.replace('_', ' ')}
                </span>
                <h3 className="text-base font-black text-white mt-1.5">{selectedProperty.name}</h3>
                <p className="text-[10px] text-slate-300">{selectedProperty.address?.area} · {selectedProperty.address?.city}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center border-b border-border/40 pb-4">
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Total Units</span>
                  <p className="text-sm font-black">{selectedProperty.units?.length || 0}</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Occupied</span>
                  <p className="text-sm font-black text-emerald-400">
                    {selectedProperty.units?.filter(u => u.status === 'occupied').length || 0}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Base Rent</span>
                  <p className="text-sm font-black font-mono">KES {selectedProperty.tier_id?.base_rent_kes?.toLocaleString() || '—'}</p>
                </div>
              </div>

              {/* Units Grid */}
              <div>
                <h4 className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">Unit Status Directory</h4>
                {(!selectedProperty.units || selectedProperty.units.length === 0) ? (
                  <p className="text-xs text-muted py-4 text-center">No units registered for this property</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto pr-1">
                    {selectedProperty.units.map(unit => {
                      const isOccupied = unit.status === 'occupied';
                      return (
                        <button
                          key={unit._id}
                          onClick={() => setSelectedUnit(unit)}
                          className={`p-2.5 rounded-xl border text-left transition duration-300 ${
                            isOccupied
                              ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
                              : 'bg-background/40 border-border/60 hover:bg-background/70'
                          }`}
                        >
                          <p className="text-xs font-bold text-foreground">Unit {unit.unit_number}</p>
                          <span className={`text-[9px] font-bold block mt-1 uppercase ${isOccupied ? 'text-emerald-400' : 'text-muted'}`}>
                            {unit.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unit Portfolio Popup (selectedUnit modal) ──────────────────────── */}
      {selectedUnit && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 relative text-foreground space-y-4">
            <button
              onClick={() => setSelectedUnit(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            <h3 className="text-xs font-black uppercase tracking-wider border-b border-border pb-3">
              Unit {selectedUnit.unit_number} Portfolio
            </h3>

            {/* Photo Gallery Mock */}
            <div className="rounded-xl overflow-hidden aspect-[16/10] bg-slate-950 border border-border">
              {selectedUnit.photos?.[0] ? (
                <img src={selectedUnit.photos[0]} alt="Unit interior" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-950/30 to-slate-900/30 flex flex-col items-center justify-center text-muted gap-2">
                  <Home size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">No interior photos uploaded</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Rent Rate</span>
                <p className="font-bold text-foreground font-mono">{FMT_KES(selectedUnit.rent_kes)}</p>
              </div>
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Occupancy State</span>
                <span className={`inline-block mt-0.5 font-bold uppercase ${selectedUnit.status === 'occupied' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedUnit.status}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Beds / Baths</span>
                <p className="font-bold text-foreground">{selectedUnit.bedrooms || 1} Bed · {selectedUnit.bathrooms || 1} Bath</p>
              </div>
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Size</span>
                <p className="font-bold text-foreground">{selectedUnit.size_sqft || 650} Sq Ft</p>
              </div>
            </div>

            {selectedUnit.tenant_id && (
              <div className="bg-background/40 border border-border rounded-xl p-3">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-1">Assigned Tenant</span>
                <p className="text-xs font-bold text-foreground">{selectedUnit.tenant_id.full_name || 'Tenant Name'}</p>
                <p className="text-[10px] text-muted mt-0.5">{selectedUnit.tenant_id.phone}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
