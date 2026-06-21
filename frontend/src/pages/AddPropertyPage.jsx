import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { createProperty, addUnit } from '../lib/api';
import ImageUpload from '../components/ImageUpload';
import {
  Building2, Home, ChevronRight, ChevronLeft, Check,
  Trash2, Plus, MapPin, Layers
} from 'lucide-react';

const STEPS = ['Property Details', 'Units', 'Photos', 'Review & Submit'];

const PROPERTY_TYPES = [
  { value: 'apartment',     label: 'Apartment Block' },
  { value: 'single_family', label: 'Single Family' },
  { value: 'commercial',    label: 'Commercial' },
  { value: 'mixed_use',     label: 'Mixed Use' },
  { value: 'bedsitter',     label: 'Bedsitter' },
  { value: 'studio',        label: 'Studio' },
];

const UNIT_TYPES = ['bedsitter', 'studio', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'commercial'];

const MOMBASA_AREAS = [
  'Nyali', 'Bamburi', 'Mtwapa', 'Tudor', 'Likoni', 'Changamwe',
  'Kisauni', 'Mvita', 'Mkomani', 'Shanzu', 'Kongowea', 'Mikindani', 'Port Reitz'
];

// ── Shared Styles ────────────────────────────────────────────────────────────
// Replaced inline styles with Tailwind class equivalents for reactivity.

// ── Wizard Step Indicator ─────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
            <div style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14,
              background: i < step ? 'linear-gradient(135deg,#10b981,#059669)' : i === step ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : 'rgba(156,163,175,0.15)',
              color: i <= step ? '#fff' : 'inherit',
              border: i === step ? '2px solid rgba(37,99,235,0.5)' : '2px solid transparent',
              transition: 'all 0.3s ease',
              boxShadow: i === step ? '0 0 20px rgba(37,99,235,0.4)' : 'none',
            }}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <span className={`text-xs font-bold text-center whitespace-nowrap ${i === step ? 'text-blue-600 dark:text-blue-400' : i < step ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`}>
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 max-w-[60px] mb-5 transition-all duration-300 ${i < step ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Step 0: Property Details ─────────────────────────────────────────────────
function StepDetails({ form, setField }) {
  const inputClass = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-500 transition-colors";
  const selectClass = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-500 transition-colors appearance-none bg-[right_12px_center] bg-[length:16px] pr-10";
  const labelClass = "block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5";
  const selectBgArrow = {
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(156,163,175,0.7)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className={labelClass}>Property Name *</label>
        <input
          className={inputClass} type="text" value={form.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="e.g. Nyali Heights Block A"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Property Type</label>
          <select className={selectClass} style={selectBgArrow} value={form.type} onChange={e => setField('type', e.target.value)}>
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Area *</label>
          <select className={selectClass} style={selectBgArrow} value={form.address.area} onChange={e => setField('address.area', e.target.value)}>
            <option value="">Select area…</option>
            {MOMBASA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Street / Road</label>
          <input
            className={inputClass} type="text" value={form.address.street}
            onChange={e => setField('address.street', e.target.value)}
            placeholder="e.g. Links Road"
          />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={`${inputClass} opacity-60`} type="text" value="Mombasa" disabled />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description (Optional)</label>
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={form.description}
          onChange={e => setField('description', e.target.value)}
          placeholder="Brief description of the property…"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Number of Floors</label>
          <input
            className={inputClass} type="number" min={1} max={50}
            value={form.num_floors} onChange={e => setField('num_floors', Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass}>Year Built</label>
          <input
            className={inputClass} type="number" min={1950} max={new Date().getFullYear()}
            value={form.year_built} onChange={e => setField('year_built', e.target.value)}
            placeholder="e.g. 2018"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Units ─────────────────────────────────────────────────────────────
function StepUnits({ form, addUnitFn, removeUnitFn, updateUnitFn }) {
  const inputClass = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-500 transition-colors";
  const selectClass = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-500 transition-colors appearance-none bg-[right_12px_center] bg-[length:16px] pr-10";
  const labelClass = "block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5";
  const selectBgArrow = {
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(156,163,175,0.7)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-550 dark:text-slate-400 text-xs">
          Add individual units for this property. At least 1 unit is required.
        </p>
        <button
          type="button" onClick={addUnitFn}
          className="bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg py-1.5 px-3.5 text-xs font-bold cursor-pointer transition flex items-center gap-1"
        >
          <Plus size={14} /> Add Unit
        </button>
      </div>
      {form.units.map((unit, i) => (
        <div key={i} className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 position-relative">
          <div className="flex justify-between mb-3.5 items-center">
            <span className="text-blue-600 dark:text-blue-400 font-extrabold text-xs">Unit #{i + 1}</span>
            {form.units.length > 1 && (
              <button
                type="button" onClick={() => removeUnitFn(i)}
                className="bg-red-100 dark:bg-red-950/40 hover:bg-red-200 border-none text-red-650 rounded-lg py-1 px-2.5 text-xs cursor-pointer transition"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Unit Number</label>
              <input className={inputClass} value={unit.unit_number} onChange={e => updateUnitFn(i, 'unit_number', e.target.value)} placeholder="e.g. 1A" />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select className={selectClass} style={selectBgArrow} value={unit.type} onChange={e => updateUnitFn(i, 'type', e.target.value)}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Floor</label>
              <input className={inputClass} type="number" min={0} value={unit.floor} onChange={e => updateUnitFn(i, 'floor', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Bedrooms</label>
              <input className={inputClass} type="number" min={0} value={unit.bedrooms} onChange={updateUnitFn ? e => updateUnitFn(i, 'bedrooms', Number(e.target.value)) : undefined} />
            </div>
            <div>
              <label className={labelClass}>Bathrooms</label>
              <input className={inputClass} type="number" min={1} value={unit.bathrooms} onChange={updateUnitFn ? e => updateUnitFn(i, 'bathrooms', Number(e.target.value)) : undefined} />
            </div>
            <div>
              <label className={labelClass}>Rent (KES)</label>
              <input className={inputClass} type="number" min={0} value={unit.rent_kes} onChange={e => updateUnitFn(i, 'rent_kes', e.target.value)} placeholder="e.g. 15000" />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelClass}>Size (sqft)</label>
            <input className={`${inputClass} max-w-[200px]`} type="number" min={0} value={unit.size_sqft} onChange={e => updateUnitFn(i, 'size_sqft', e.target.value)} placeholder="Optional" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 2: Photos ────────────────────────────────────────────────────────────
function StepPhotos({ form, setField }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-slate-500 dark:text-slate-400 text-xs">
        Upload photos for the property. At least 1 photo is required before submission.
      </p>
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <ImageUpload
          value={form.photos || []}
          onChange={urls => setField('photos', urls)}
          multiple={true}
          label="Property Photos (min. 1 required)"
        />
      </div>
    </div>
  );
}

// ── Step 3: Review & Submit ───────────────────────────────────────────────────
function StepReview({ form }) {
  const totalRent = form.units.reduce((s, u) => s + (Number(u.rent_kes) || 0), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-5">
        <h3 className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm mb-3">📋 Property Summary</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            ['Name', form.name],
            ['Type', form.type.replace(/_/g, ' ')],
            ['Area', form.address.area],
            ['Street', form.address.street || '—'],
            ['Floors', form.num_floors],
            ['Year Built', form.year_built || '—'],
            ['Units', form.units.length],
            ['Monthly Revenue', `KES ${totalRent.toLocaleString('en-KE')}`],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">{label}</span>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-xs mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/25 rounded-2xl p-5">
        <h3 className="text-blue-600 dark:text-blue-400 font-extrabold text-sm mb-3">🏠 Units ({form.units.length})</h3>
        <div className="flex flex-col gap-2">
          {form.units.map((u, i) => (
            <div key={i} className="flex gap-3 items-center py-2 px-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
              <span className="text-blue-600 dark:text-blue-400 font-extrabold text-xs min-w-[32px]">#{u.unit_number}</span>
              <span className="text-slate-550 dark:text-slate-400 text-xs">{u.type.replace(/_/g, ' ')} · Floor {u.floor}</span>
              <span className="ml-auto text-emerald-600 dark:text-emerald-450 font-bold text-xs">
                KES {Number(u.rent_kes || 0).toLocaleString('en-KE')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {form.photos?.length > 0 && (
        <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 rounded-2xl p-5">
          <h3 className="text-amber-600 dark:text-amber-400 font-extrabold text-sm mb-3">📸 Photos ({form.photos.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {form.photos.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden aspect-[4/3] border border-slate-200 dark:border-slate-800">
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl">
        <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold">
          ⚠️ After submission, this property will be reviewed by an administrator before it goes live.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  name: '',
  type: 'apartment',
  description: '',
  num_floors: 1,
  year_built: '',
  address: { street: '', area: 'Nyali', city: 'Mombasa' },
  units: [{ unit_number: '1A', type: 'bedsitter', bedrooms: 1, bathrooms: 1, rent_kes: '', floor: 0, size_sqft: '' }],
  photos: [],
};

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const setField = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...cur[parts[i]] };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const addUnitFn = () => {
    const n = form.units.length + 1;
    setForm(prev => ({
      ...prev,
      units: [...prev.units, { unit_number: `${n}`, type: 'bedsitter', bedrooms: 1, bathrooms: 1, rent_kes: '', floor: 0, size_sqft: '' }]
    }));
  };

  const removeUnitFn = (i) => {
    if (form.units.length <= 1) return;
    setForm(prev => ({ ...prev, units: prev.units.filter((_, idx) => idx !== i) }));
  };

  const updateUnitFn = (i, key, value) => {
    setForm(prev => {
      const units = [...prev.units];
      units[i] = { ...units[i], [key]: value };
      return { ...prev, units };
    });
  };

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) { toast.error('Property name is required'); return false; }
      if (!form.address.area) { toast.error('Please select an area'); return false; }
    }
    if (step === 1) {
      const empty = form.units.find(u => !u.unit_number?.trim());
      if (empty) { toast.error('Every unit must have a unit number'); return false; }
    }
    if (step === 2) {
      if (!form.photos || form.photos.length === 0) {
        toast.error('At least 1 property photo is required');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      // 1. Create the property
      const res = await createProperty({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        num_floors: form.num_floors,
        year_built: form.year_built ? Number(form.year_built) : undefined,
        address: form.address,
        photos: form.photos,
      });

      const propertyId = res.data?._id;
      if (!propertyId) throw new Error('Property ID missing from response');

      // 2. Add units sequentially
      for (const unit of form.units) {
        await addUnit(propertyId, {
          unit_number: unit.unit_number.trim(),
          type: unit.type,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          rent_kes: Number(unit.rent_kes) || 0,
          floor: unit.floor,
          size_sqft: unit.size_sqft ? Number(unit.size_sqft) : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`✅ Property "${form.name}" registered — awaiting admin approval`);
      navigate('/properties');
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Failed to create property';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 p-7 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[40px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#fff" />
            </div>
            <div>
              <h1 className="text-slate-900 dark:text-slate-100 text-xl sm:text-2xl font-black margin-0">Register Property</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs margin-0">Admin / Agent · Multi-step wizard</p>
            </div>
          </div>
        </div>

        {/* Step Bar */}
        <StepBar step={step} />

        {/* Card */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-7 sm:p-8">
          <h2 className="text-slate-900 dark:text-slate-100 font-extrabold text-base mb-6">
            {STEPS[step]}
          </h2>

          {step === 0 && <StepDetails form={form} setField={setField} />}
          {step === 1 && <StepUnits form={form} addUnitFn={addUnitFn} removeUnitFn={removeUnitFn} updateUnitFn={updateUnitFn} />}
          {step === 2 && <StepPhotos form={form} setField={setField} />}
          {step === 3 && <StepReview form={form} />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 gap-3">
          <button
            onClick={step === 0 ? () => navigate('/properties') : back}
            className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-355 font-bold text-xs cursor-pointer transition"
          >
            <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 24px rgba(37,99,235,0.35)', fontFamily: 'inherit' }}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: submitting ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 8px 24px rgba(16,185,129,0.35)', fontFamily: 'inherit' }}
            >
              {submitting ? '⏳ Submitting…' : '✅ Submit Property'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
