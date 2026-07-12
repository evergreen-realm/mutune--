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
  Plus, Trash2, Edit2, DollarSign, Save, X, Phone, Mail, Receipt, Box, BarChart3, UserCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchAdminStats, downloadKRAReport,
  fetchPendingAgents, fetchPendingLandlords, fetchPendingProperties,
  fetchLateFeeRules, createLateFeeRule, updateLateFeeRule, deleteLateFeeRule,
  fetchProperties, updateProperty, addUnit
} from '../lib/api';
import MapWidget, { getPropertyCoords } from '../components/MapWidget';
import AgentPerformancePage from './AgentPerformancePage';
import UnitDetailPopup from '../components/UnitDetailPopup';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const EMPTY_RULE = { grace_period_days: 5, fee_type: 'flat', amount_kes: 500, cap_kes: '' };

const MOMBASA_AREAS = [
  'Nyali', 'Bamburi', 'Mtwapa', 'Tudor', 'Likoni', 'Changamwe',
  'Kisauni', 'Mvita', 'Mkomani', 'Shanzu', 'Kongowea', 'Mikindani', 'Port Reitz'
];

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
export default function AdminDashboardPage({ dbUser }) {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const [adminTab, setAdminTab] = useState('overview');
  const [downloading, setDownloading] = useState(false);
  const [kraMonth, setKraMonth]     = useState(new Date().toISOString().slice(0, 7));

  // Interactive Popup Modal states
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propPhotoIndex, setPropPhotoIndex] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Controlled MapWidget Tab/Focus states
  const [mapActiveTab, setMapActiveTab] = useState('properties');
  const [mapSelectedProperty, setMapSelectedProperty] = useState(null);

  // Edit Property Form states
  const [editingProperty, setEditingProperty] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'apartment',
    address: { street: '', area: '', city: 'Mombasa' },
    photos: []
  });

  // Add Unit Form states
  const [addingUnitToProperty, setAddingUnitToProperty] = useState(null);
  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    unit_type: 'one_bedroom',
    rent_kes: '',
    bedrooms: 1,
    bathrooms: 1
  });

  const queryClient = useQueryClient();

  // Populate Edit Form when editingProperty changes
  React.useEffect(() => {
    if (editingProperty) {
      setEditForm({
        name: editingProperty.name || '',
        type: editingProperty.type || 'apartment',
        address: {
          street: editingProperty.address?.street || '',
          area: editingProperty.address?.area || '',
          city: editingProperty.address?.city || 'Mombasa'
        },
        photos: editingProperty.photos || []
      });
    }
  }, [editingProperty]);

  const handleEditPropertySubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Property Name is required');
      return;
    }
    try {
      const res = await updateProperty(editingProperty._id, editForm);
      if (res?.success && res.data) {
        toast.success('Property updated successfully ✓');
        setSelectedProperty(res.data);
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        queryClient.invalidateQueries({ queryKey: ['adminStats'] });
        setEditingProperty(null);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.error?.message || 'Failed to update property');
    }
  };

  const handleAddUnitSubmit = async (e) => {
    e.preventDefault();
    if (!unitForm.unit_number.trim() || !unitForm.rent_kes) {
      toast.error('Unit number and rent are required');
      return;
    }
    try {
      const res = await addUnit(addingUnitToProperty._id, {
        unit_number: unitForm.unit_number.trim(),
        unit_type: unitForm.unit_type,
        rent_kes: Number(unitForm.rent_kes),
        bedrooms: Number(unitForm.bedrooms),
        bathrooms: Number(unitForm.bathrooms),
        status: 'vacant'
      });
      if (res?.success && res.data) {
        toast.success('Unit added successfully ✓');
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        queryClient.invalidateQueries({ queryKey: ['adminStats'] });
        // Update selectedProperty in state with the new unit
        setSelectedProperty(prev => ({
          ...prev,
          units: [...(prev.units || []), res.data]
        }));
        setAddingUnitToProperty(null);
        setUnitForm({
          unit_number: '',
          unit_type: 'one_bedroom',
          rent_kes: '',
          bedrooms: 1,
          bathrooms: 1
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.error?.message || 'Failed to add unit');
    }
  };

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

      {/* Admin Tab Navigation */}
      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl self-start">
        <button
          onClick={() => setAdminTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'overview'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface-bright'
          }`}
        >
          <BarChart3 size={13} />
          Overview
        </button>
        <button
          onClick={() => { setAdminTab('units'); setMapActiveTab('units'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'units'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface-bright'
          }`}
        >
          <Box size={13} />
          3D Building Viewer
        </button>
        <button
          onClick={() => setAdminTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'agents'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-foreground hover:bg-surface-bright'
          }`}
        >
          <UserCheck size={13} />
          Agent Performance
        </button>
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {adminTab === 'overview' && (
        <>
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
              onPropertySelect={(p) => { setSelectedProperty(p); setMapSelectedProperty(p); }}
              activeTab={mapActiveTab}
              onActiveTabChange={setMapActiveTab}
              selectedProperty={mapSelectedProperty}
              onSelectedPropertyChange={setMapSelectedProperty}
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
        </>
      )}

      {/* ── 3D BUILDING VIEWER TAB ────────────────────────────────────────────── */}
      {adminTab === 'units' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block">Interactive 3D Voxel Directory</span>
            <h2 className="text-lg font-black text-foreground">3D Building & Units Previewer</h2>
            <p className="text-xs text-muted mt-0.5">Select a Mombasa property marker on the map, then explore its stacked unit blocks in the "Units" tab inside the widget.</p>
          </div>
          <div className="bg-surface border border-border rounded-[24px] overflow-hidden shadow-sm p-4 relative z-10">
            <MapWidget 
              properties={properties} 
              isAdmin={true} 
              theme={theme} 
              onPropertySelect={(p) => { setSelectedProperty(p); setMapSelectedProperty(p); }}
              activeTab={mapActiveTab}
              onActiveTabChange={setMapActiveTab}
              selectedProperty={mapSelectedProperty}
              onSelectedPropertyChange={setMapSelectedProperty}
            />
          </div>
        </div>
      )}

      {/* ── AGENT PERFORMANCE TAB ────────────────────────────────────────────── */}
      {adminTab === 'agents' && (
        <AgentPerformancePage dbUser={dbUser} />
      )}

      {/* ── Property Detail Popup (selectedProperty modal) ──────────────────── */}
      {selectedProperty && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden relative text-foreground grid grid-cols-1 md:grid-cols-2 gap-0">
            <button
              onClick={() => { setSelectedProperty(null); setSelectedUnit(null); }}
              className="absolute top-4 right-4 z-20 p-1.5 bg-background/80 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            {/* Left Panel: Photo Showcase & Gallery */}
            <div className="flex flex-col border-r border-border/40 bg-background/25">
              <div className="relative h-64 bg-slate-950 overflow-hidden">
                {selectedProperty.photos?.[propPhotoIndex] ? (
                  <img src={selectedProperty.photos[propPhotoIndex]} alt={selectedProperty.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]" />
                ) : (
                  <img src="/assets/voxel_estate.png" alt="Realistic 3D Voxel Model" className="w-full h-full object-contain p-4" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent pointer-events-none" />
                
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/10 shadow-md">
                    {selectedProperty.type?.replace('_', ' ') || 'Apartment'}
                  </span>
                  <h3 className="text-lg font-black text-white mt-2 tracking-tight drop-shadow">{selectedProperty.name}</h3>
                  <p className="text-xs text-slate-300 font-medium drop-shadow mt-0.5">📍 {selectedProperty.address?.street}, {selectedProperty.address?.area}</p>
                </div>

                {selectedProperty.photos?.length > 1 && (
                  <>
                    <button 
                      onClick={() => setPropPhotoIndex(prev => (prev > 0 ? prev - 1 : selectedProperty.photos.length - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white p-1.5 rounded-full border border-white/10 transition cursor-pointer"
                    >
                      &larr;
                    </button>
                    <button 
                      onClick={() => setPropPhotoIndex(prev => (prev < selectedProperty.photos.length - 1 ? prev + 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white p-1.5 rounded-full border border-white/10 transition cursor-pointer"
                    >
                      &rarr;
                    </button>
                  </>
                )}
              </div>

              {/* Photo Thumbnails Carousel */}
              {selectedProperty.photos?.length > 0 && (
                <div className="flex gap-2 p-3 overflow-x-auto border-b border-border/40 bg-surface-bright">
                  {selectedProperty.photos.map((ph, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setPropPhotoIndex(idx)}
                      className={`w-14 h-10 rounded-lg overflow-hidden border-2 flex-shrink-0 transition ${
                        idx === propPhotoIndex ? 'border-brand-500 scale-95 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={ph} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Action Buttons Panel */}
              <div className="p-4 flex gap-2 justify-stretch bg-surface-bright/50 mt-auto">
                <button
                  onClick={() => setEditingProperty(selectedProperty)}
                  className="flex-1 py-2.5 bg-background border border-border hover:bg-surface text-foreground font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer active:scale-[0.98]"
                >
                  Edit Property
                </button>
                <button
                  onClick={() => {
                    setMapActiveTab('3d');
                    setMapSelectedProperty(selectedProperty);
                    setSelectedProperty(null);
                    toast.success(`Zoomed into 3D view for ${selectedProperty.name}`);
                  }}
                  className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer active:scale-[0.98]"
                >
                  View 3D Model
                </button>
                <button
                  onClick={() => setAddingUnitToProperty(selectedProperty)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer active:scale-[0.98]"
                >
                  Add Unit
                </button>
              </div>
            </div>

            {/* Right Panel: Map & Unit Grid */}
            <div className="p-6 flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted border-b border-border/40 pb-2">
                Property Overview
              </h3>

              {/* 3D Mini Map showing Mombasa island location */}
              <div className="rounded-2xl border border-border/40 overflow-hidden relative shadow-md bg-slate-950 h-32 w-full z-0">
                <MapContainer 
                  center={getPropertyCoords(selectedProperty)} 
                  zoom={14} 
                  zoomControl={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  />
                  <Marker position={getPropertyCoords(selectedProperty)} />
                </MapContainer>
                <div className="absolute top-2 left-2 z-[1000] bg-black/70 backdrop-blur-md border border-white/20 rounded px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider pointer-events-none">
                  🛰 Satellite View
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2.5 text-center bg-surface-bright/50 border border-border/40 p-3 rounded-2xl">
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Total Units</span>
                  <p className="text-sm font-black text-foreground">{selectedProperty.units?.length || 0}</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Occupied</span>
                  <p className="text-sm font-black text-emerald-500">
                    {selectedProperty.units?.filter(u => u.status === 'occupied').length || 0}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Base Rent</span>
                  <p className="text-sm font-black font-mono text-foreground font-mono">
                    {FMT_KES(selectedProperty.tier_id?.base_rent_kes || 25000)}
                  </p>
                </div>
              </div>

              {/* Colored Unit Status Grid */}
              <div>
                <h4 className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2.5 flex justify-between items-center">
                  <span>Unit Status Directory</span>
                  <span className="text-[9px] lowercase font-normal">click to open portfolio</span>
                </h4>
                {(!selectedProperty.units || selectedProperty.units.length === 0) ? (
                  <p className="text-xs text-muted py-6 text-center">No units registered for this property</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {selectedProperty.units.map(unit => {
                      const isOccupied = unit.status === 'occupied';
                      let borderStyle = 'border-border/60 hover:bg-slate-100 dark:hover:bg-slate-900';
                      let statusPillColor = 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400';
                      let statusText = 'vacant';

                      if (isOccupied) {
                        statusPillColor = 'bg-emerald-500/10 text-emerald-500';
                        borderStyle = 'border-emerald-500/20 hover:bg-emerald-500/5';
                        statusText = 'occupied';
                      } else if (unit.status === 'maintenance') {
                        statusPillColor = 'bg-orange-500/10 text-orange-500';
                        borderStyle = 'border-orange-500/20 hover:bg-orange-500/5';
                        statusText = 'maintenance';
                      }

                      return (
                        <button
                          key={unit._id}
                          onClick={() => setSelectedUnit(unit)}
                          className={`p-2.5 rounded-xl border text-left transition duration-200 cursor-pointer ${borderStyle}`}
                        >
                          <p className="text-xs font-black text-foreground">Unit {unit.unit_number}</p>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded inline-block mt-2 ${statusPillColor}`}>
                            {statusText}
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
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden relative text-foreground grid grid-cols-1 md:grid-cols-2 gap-0">
            <button
              onClick={() => setSelectedUnit(null)}
              className="absolute top-4 right-4 z-20 p-1.5 bg-background/80 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            {/* Left Panel: Floor Plan Gallery & Spec */}
            <div className="flex flex-col border-r border-border/40 bg-background/25">
              <div className="relative h-64 bg-slate-950 overflow-hidden flex items-center justify-center">
                <div className="w-full h-full">
                  <UnitDetailPopup unit={selectedUnit} property={selectedProperty} theme={theme} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4">
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                    selectedUnit.status === 'occupied' ? 'bg-emerald-500/90 text-white border-emerald-400/20' : 'bg-amber-600/90 text-white border-amber-400/20'
                  }`}>
                    {selectedUnit.status}
                  </span>
                  <h3 className="text-base font-black text-white mt-2.5 drop-shadow">Unit {selectedUnit.unit_number} Specifications</h3>
                </div>
              </div>

              {/* Specifications grid */}
              <div className="p-4 grid grid-cols-2 gap-3.5 text-xs bg-surface-bright/50">
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Monthly Rent</span>
                  <p className="font-black text-foreground font-mono">{FMT_KES(selectedUnit.rent_kes)}</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Beds / Baths</span>
                  <p className="font-black text-foreground">{selectedUnit.bedrooms || 1} Bed · {selectedUnit.bathrooms || 1} Bath</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Dimension</span>
                  <p className="font-black text-foreground font-mono">{selectedUnit.size_sqft || 720} Sq Ft</p>
                </div>
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Floor Level</span>
                  <p className="font-black text-foreground">Floor {selectedUnit.unit_number?.match(/^(\d+)/)?.[1] || 1}</p>
                </div>
              </div>
            </div>

            {/* Right Panel: Tenant & Location Map */}
            <div className="p-6 flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted border-b border-border/40 pb-2">
                Unit Portfolio
              </h3>

              {/* Mini Map showing Unit location coordinate */}
              <div className="rounded-2xl border border-border/40 overflow-hidden relative shadow-md bg-slate-950 h-32 w-full z-0">
                <MapContainer 
                  center={getPropertyCoords(selectedProperty)} 
                  zoom={15} 
                  zoomControl={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  />
                  <Marker position={getPropertyCoords(selectedProperty)} />
                </MapContainer>
                <div className="absolute top-2 left-2 z-[1000] bg-black/70 backdrop-blur-md border border-white/20 rounded px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider pointer-events-none">
                  🛰 Satellite View
                </div>
              </div>

              {/* Assigned Tenant Details */}
              <div className="border border-border/40 rounded-2xl p-4 bg-surface-bright/50 flex-1 flex flex-col justify-between min-h-[140px]">
                <div>
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-2 border-b border-border/20 pb-1">
                    Assigned Occupant
                  </span>
                  {selectedUnit.tenant_id ? (
                    <div className="space-y-2">
                      <p className="text-sm font-black text-foreground">{selectedUnit.tenant_id.full_name}</p>
                      <div className="space-y-1 text-xs text-muted">
                        <p className="flex items-center gap-1.5">📞 {selectedUnit.tenant_id.phone}</p>
                        <p className="flex items-center gap-1.5">✉️ {selectedUnit.tenant_id.email || 'No email registered'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-muted italic">This unit is currently vacant</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/20 mt-auto">
                  {selectedUnit.tenant_id ? (
                    <button
                      onClick={() => toast.info('Tenant profile options initiated')}
                      className="w-full py-2 bg-background hover:bg-surface border border-border text-foreground rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98]"
                    >
                      View Tenant Details
                    </button>
                  ) : (
                    <button
                      onClick={() => toast.info('Link Tenant flow initiated')}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer active:scale-[0.98]"
                    >
                      Assign New Tenant
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Property Modal ────────────────────────────────────────────── */}
      {editingProperty && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl p-6 relative text-foreground">
            <button
              onClick={() => setEditingProperty(null)}
              className="absolute top-4 right-4 p-1.5 bg-background/80 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-lg font-black mb-4">Edit Property Details</h3>
            <form onSubmit={handleEditPropertySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Property Name *</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                  className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Property Type *</label>
                <select 
                  value={editForm.type} 
                  onChange={e => setEditForm({ ...editForm, type: e.target.value })} 
                  className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="apartment">Apartment Block</option>
                  <option value="single_family">Single Family</option>
                  <option value="commercial">Commercial</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="bedsitter">Bedsitter</option>
                  <option value="studio">Studio</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Street Address *</label>
                  <input 
                    type="text" 
                    value={editForm.address.street} 
                    onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, street: e.target.value } })} 
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Area *</label>
                  <select 
                    value={editForm.address.area} 
                    onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, area: e.target.value } })} 
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">Select Area</option>
                    {MOMBASA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Photos (Image URLs)</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      id="new-photo-url-input"
                      placeholder="Paste image URL here..." 
                      className="flex-1 bg-surface-bright border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('new-photo-url-input');
                        if (input && input.value.trim()) {
                          setEditForm({ ...editForm, photos: [...editForm.photos, input.value.trim()] });
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold uppercase"
                    >
                      Add Url
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1.5 bg-background/40 border border-border rounded-xl">
                    {editForm.photos.map((ph, idx) => (
                      <div key={idx} className="relative w-12 h-9 rounded overflow-hidden border border-border flex-shrink-0 group">
                        <img src={ph} alt="preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setEditForm({ ...editForm, photos: editForm.photos.filter((_, i) => i !== idx) })}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 text-[10px] font-bold transition"
                        >
                          Del
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-border/40">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-550 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                >
                  Save changes
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingProperty(null)}
                  className="flex-1 py-3 bg-background border border-border hover:bg-surface text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Unit Modal ─────────────────────────────────────────────────── */}
      {addingUnitToProperty && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 relative text-foreground">
            <button
              onClick={() => setAddingUnitToProperty(null)}
              className="absolute top-4 right-4 p-1.5 bg-background/80 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-lg font-black mb-4">Add Unit to {addingUnitToProperty.name}</h3>
            <form onSubmit={handleAddUnitSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Unit Number *</label>
                <input 
                  type="text" 
                  value={unitForm.unit_number} 
                  onChange={e => setUnitForm({ ...unitForm, unit_number: e.target.value })} 
                  placeholder="e.g. Unit 2B, Apt 14"
                  className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Unit Type *</label>
                  <select 
                    value={unitForm.unit_type} 
                    onChange={e => setUnitForm({ ...unitForm, unit_type: e.target.value })} 
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="one_bedroom">1 Bedroom</option>
                    <option value="two_bedroom">2 Bedroom</option>
                    <option value="three_bedroom">3 Bedroom</option>
                    <option value="bedsitter">Bedsitter</option>
                    <option value="studio">Studio</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Monthly Rent (KES) *</label>
                  <input 
                    type="number" 
                    value={unitForm.rent_kes} 
                    onChange={e => setUnitForm({ ...unitForm, rent_kes: e.target.value })} 
                    placeholder="e.g. 25000"
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Bedrooms</label>
                  <input 
                    type="number" 
                    value={unitForm.bedrooms} 
                    onChange={e => setUnitForm({ ...unitForm, bedrooms: e.target.value })} 
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Bathrooms</label>
                  <input 
                    type="number" 
                    value={unitForm.bathrooms} 
                    onChange={e => setUnitForm({ ...unitForm, bathrooms: e.target.value })} 
                    className="w-full bg-surface-bright border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    min={0}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-border/40">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-550 hover:to-teal-550 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md"
                >
                  Create Unit
                </button>
                <button 
                  type="button" 
                  onClick={() => setAddingUnitToProperty(null)}
                  className="flex-1 py-3 bg-background border border-border hover:bg-surface text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
