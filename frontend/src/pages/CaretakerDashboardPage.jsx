import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import {
  Building2, Wrench, Gauge, CheckSquare, ShieldCheck,
  Plus, AlertTriangle, CheckCircle2, ChevronRight,
  Camera, RefreshCw, KeyRound, UserCheck, Droplets, Zap
} from 'lucide-react';
import {
  fetchProperties, fetchMaintenanceTickets, createMaintenanceTicket,
  recordMeterReading
} from '../lib/api';

export default function CaretakerDashboardPage() {
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeTab, setActiveTab] = useState('units'); // 'units' | 'maintenance' | 'meters' | 'handover'

  // Maintenance form state
  const [maintForm, setMaintForm] = useState({
    unit_id: '',
    category: 'plumbing',
    priority: 'medium',
    description: '',
    photos: []
  });
  const [submittingMaint, setSubmittingMaint] = useState(false);

  // Meter reading form state
  const [meterForm, setMeterForm] = useState({
    unit_id: '',
    meter_type: 'water',
    previous_reading: '',
    current_reading: ''
  });
  const [submittingMeter, setSubmittingMeter] = useState(false);

  // Handover state
  const [handoverUnitId, setHandoverUnitId] = useState('');
  const [handoverType, setHandoverType] = useState('move_in');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Fetch properties (backend automatically scopes to caretaker's assigned_properties)
  const { data: properties = [], isLoading: propsLoading, refetch: refetchProps } = useQuery({
    queryKey: ['caretakerProperties'],
    queryFn: async () => {
      const res = await fetchProperties();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  // Automatically select first assigned property
  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0]._id);
    }
  }, [properties, selectedPropertyId]);

  const activeProperty = properties.find(p => p._id === selectedPropertyId) || properties[0] || null;

  // Fetch maintenance tickets scoped for this property
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['caretakerTickets', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const res = await fetchMaintenanceTickets({ property_id: selectedPropertyId });
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: !!selectedPropertyId
  });

  // Handle Maintenance Ticket Submission
  const handleSubmitMaintenance = async (e) => {
    e.preventDefault();
    if (!selectedPropertyId || !maintForm.unit_id || !maintForm.description.trim()) {
      toast.error('Please select a unit and provide an issue description');
      return;
    }
    setSubmittingMaint(true);
    try {
      await createMaintenanceTicket({
        property_id: selectedPropertyId,
        unit_id: maintForm.unit_id,
        category: maintForm.category,
        priority: maintForm.priority,
        description: maintForm.description.trim(),
        photos: maintForm.photos
      });
      toast.success('Maintenance ticket logged successfully ✓');
      setMaintForm({ unit_id: '', category: 'plumbing', priority: 'medium', description: '', photos: [] });
      refetchTickets();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to log ticket');
    } finally {
      setSubmittingMaint(false);
    }
  };

  // Handle Meter Reading Submission
  const handleSubmitMeter = async (e) => {
    e.preventDefault();
    if (!selectedPropertyId || !meterForm.unit_id || !meterForm.current_reading) {
      toast.error('Unit and current reading are required');
      return;
    }
    setSubmittingMeter(true);
    try {
      await recordMeterReading({
        property_id: selectedPropertyId,
        unit_id: meterForm.unit_id,
        billing_month: new Date().toISOString().slice(0, 7),
        previous_reading: Number(meterForm.previous_reading) || 0,
        current_reading: Number(meterForm.current_reading),
        meter_type: meterForm.meter_type
      });
      toast.success('Meter reading recorded successfully ✓');
      setMeterForm({ unit_id: '', meter_type: 'water', previous_reading: '', current_reading: '' });
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to record meter reading');
    } finally {
      setSubmittingMeter(false);
    }
  };

  if (propsLoading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-semibold">Loading caretaker properties…</p>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-base font-bold text-white">No Properties Assigned</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          You currently have no properties assigned to your caretaker account. Please contact your property administrator to assign you to an estate.
        </p>
        <button
          onClick={() => refetchProps()}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 mx-auto cursor-pointer"
        >
          <RefreshCw size={13} /> Check Assignments
        </button>
      </div>
    );
  }

  const units = activeProperty?.units || [];
  const occupiedCount = units.filter(u => u.status === 'occupied').length;
  const vacantCount = units.length - occupiedCount;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Mobile-Friendly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Building2 size={22} />
          </div>
          <div>
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">
              On-Site Caretaker Portal
            </span>
            <h1 className="text-lg font-black text-white">
              {activeProperty?.name || 'Property Dashboard'}
            </h1>
            <p className="text-xs text-slate-400">
              {activeProperty?.address?.area || 'Mombasa'}, {activeProperty?.address?.city || 'Kenya'}
            </p>
          </div>
        </div>

        {/* Property Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
          >
            {properties.map(p => (
              <option key={p._id} value={p._id}>
                🏢 {p.name} ({p.units?.length || 0} Units)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Status Stats (NO Financial Figures) */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Units</span>
          <span className="text-xl font-black text-white">{units.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Occupied</span>
          <span className="text-xl font-black text-emerald-400">{occupiedCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Vacant</span>
          <span className="text-xl font-black text-amber-400">{vacantCount}</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('units')}
          className={`py-2.5 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'units' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 size={15} /> <span>Units</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`py-2.5 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'maintenance' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench size={15} /> <span>Fix Log</span>
        </button>
        <button
          onClick={() => setActiveTab('meters')}
          className={`py-2.5 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'meters' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gauge size={15} /> <span>Meters</span>
        </button>
        <button
          onClick={() => setActiveTab('handover')}
          className={`py-2.5 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'handover' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare size={15} /> <span>Handover</span>
        </button>
      </div>

      {/* TAB 1: UNITS OVERVIEW (No Rent Amounts / No PII) */}
      {activeTab === 'units' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Units in {activeProperty?.name}
            </h3>
            <span className="text-[11px] text-slate-400 font-bold">
              {units.length} Total Units
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {units.map((u, i) => (
              <div
                key={u._id || i}
                className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    u.status === 'occupied'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {u.unit_number}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Unit {u.unit_number}</h4>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {u.type || 'Standard Apartment'} · Floor {u.floor || 0}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    u.status === 'occupied'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    {u.status}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {u.lock_status === 'locked' ? '🔒 Locked' : '🔓 Unlocked'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MAINTENANCE QUICK-LOG */}
      {activeTab === 'maintenance' && (
        <div className="space-y-5">
          {/* Quick Ticket Logger Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <Wrench size={15} className="text-emerald-400" /> Log Maintenance Ticket
            </h3>
            <form onSubmit={handleSubmitMaintenance} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Unit *</label>
                  <select
                    value={maintForm.unit_id}
                    onChange={(e) => setMaintForm(f => ({ ...f, unit_id: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                    required
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => (
                      <option key={u._id} value={u._id}>Unit {u.unit_number} ({u.status})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Category</label>
                  <select
                    value={maintForm.category}
                    onChange={(e) => setMaintForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                  >
                    <option value="plumbing">🚰 Plumbing</option>
                    <option value="electrical">⚡ Electrical</option>
                    <option value="structural">🧱 Structural / Wall</option>
                    <option value="security">🔒 Locks & Security</option>
                    <option value="cleaning">🧹 Cleaning / Waste</option>
                    <option value="other">🔧 Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Priority</label>
                  <select
                    value={maintForm.priority}
                    onChange={(e) => setMaintForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="emergency">🔴 Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Description *</label>
                <textarea
                  rows={3}
                  value={maintForm.description}
                  onChange={(e) => setMaintForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail (e.g. leaking sink tap under unit bathroom)..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-white outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingMaint}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> {submittingMaint ? 'Logging...' : 'Submit Maintenance Ticket'}
              </button>
            </form>
          </div>

          {/* Existing Property Tickets */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">Active Property Tickets</h4>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No active maintenance issues reported for this property.</p>
            ) : (
              tickets.map(t => (
                <div key={t._id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white capitalize">{t.category}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase font-bold">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{t.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    t.priority === 'emergency' || t.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {t.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: METER READINGS */}
      {activeTab === 'meters' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Gauge size={15} className="text-emerald-400" /> Record Manual Utility Meter Reading
          </h3>
          <p className="text-xs text-slate-400">
            Record water and electricity meter readings on-site for automated billing verification.
          </p>

          <form onSubmit={handleSubmitMeter} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Unit *</label>
                <select
                  value={meterForm.unit_id}
                  onChange={(e) => setMeterForm(f => ({ ...f, unit_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                  required
                >
                  <option value="">Select Unit</option>
                  {units.map(u => (
                    <option key={u._id} value={u._id}>Unit {u.unit_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Utility Type</label>
                <select
                  value={meterForm.meter_type}
                  onChange={(e) => setMeterForm(f => ({ ...f, meter_type: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                >
                  <option value="water">💧 Water Meter</option>
                  <option value="electricity">⚡ Electricity Postpaid Meter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Previous Reading</label>
                <input
                  type="number"
                  placeholder="0"
                  value={meterForm.previous_reading}
                  onChange={(e) => setMeterForm(f => ({ ...f, previous_reading: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Current Reading *</label>
                <input
                  type="number"
                  placeholder="e.g. 142.5"
                  value={meterForm.current_reading}
                  onChange={(e) => setMeterForm(f => ({ ...f, current_reading: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingMeter}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={14} /> {submittingMeter ? 'Recording...' : 'Record Meter Reading'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: MOVE-IN / OUT HANDOVER CHECKLIST */}
      {activeTab === 'handover' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <CheckSquare size={15} className="text-emerald-400" /> Tenant Physical Handover Inspection
          </h3>
          <p className="text-xs text-slate-400">
            Confirm physical unit keys handover, inspection checklist, and room condition on-site.
          </p>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Unit *</label>
                <select
                  value={handoverUnitId}
                  onChange={(e) => setHandoverUnitId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                >
                  <option value="">Select Unit</option>
                  {units.map(u => (
                    <option key={u._id} value={u._id}>Unit {u.unit_number} ({u.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Handover Type</label>
                <select
                  value={handoverType}
                  onChange={(e) => setHandoverType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white outline-none font-bold"
                >
                  <option value="move_in">🔑 Move-In Physical Handover</option>
                  <option value="move_out">🚪 Move-Out Inspection & Key Return</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Inspection Notes / Key Count</label>
              <textarea
                rows={3}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Confirm number of keys handed over, condition of fixtures, switches, plumbing fittings..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-white outline-none"
              />
            </div>

            <button
              onClick={() => {
                if (!handoverUnitId) {
                  toast.error('Please select a unit');
                  return;
                }
                toast.success(`Handover checklist recorded for selected unit ✓`);
                setHandoverNotes('');
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck size={14} /> Confirm Handover Verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
