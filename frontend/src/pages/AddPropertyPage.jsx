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
const glassCard = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 24,
  padding: '28px 32px',
};

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle = {
  color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '16px',
  paddingRight: 40,
};

// ── Wizard Step Indicator ─────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14,
              background: i < step ? 'linear-gradient(135deg,#10b981,#059669)' : i === step ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.08)',
              color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)',
              border: i === step ? '2px solid rgba(139,92,246,0.5)' : '2px solid transparent',
              transition: 'all 0.3s ease',
              boxShadow: i === step ? '0 0 20px rgba(139,92,246,0.4)' : 'none',
            }}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: i === step ? '#a78bfa' : i < step ? '#34d399' : 'rgba(255,255,255,0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < step ? 'linear-gradient(90deg,#10b981,#059669)' : 'rgba(255,255,255,0.08)', maxWidth: 60, marginBottom: 20, transition: 'background 0.3s ease' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Step 0: Property Details ─────────────────────────────────────────────────
function StepDetails({ form, setField }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>Property Name *</label>
        <input
          style={inputStyle} type="text" value={form.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="e.g. Nyali Heights Block A"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>Property Type</label>
          <select style={selectStyle} value={form.type} onChange={e => setField('type', e.target.value)}>
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Area *</label>
          <select style={selectStyle} value={form.address.area} onChange={e => setField('address.area', e.target.value)}>
            <option value="">Select area…</option>
            {MOMBASA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>Street / Road</label>
          <input
            style={inputStyle} type="text" value={form.address.street}
            onChange={e => setField('address.street', e.target.value)}
            placeholder="e.g. Links Road"
          />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input style={{ ...inputStyle, opacity: 0.6 }} type="text" value="Mombasa" disabled />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Description (Optional)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={form.description}
          onChange={e => setField('description', e.target.value)}
          placeholder="Brief description of the property…"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>Number of Floors</label>
          <input
            style={inputStyle} type="number" min={1} max={50}
            value={form.num_floors} onChange={e => setField('num_floors', Number(e.target.value))}
          />
        </div>
        <div>
          <label style={labelStyle}>Year Built</label>
          <input
            style={inputStyle} type="number" min={1950} max={new Date().getFullYear()}
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          Add individual units for this property. At least 1 unit is required.
        </p>
        <button
          type="button" onClick={addUnitFn}
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a78bfa', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Add Unit
        </button>
      </div>
      {form.units.map((unit, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: 13 }}>Unit #{i + 1}</span>
            {form.units.length > 1 && (
              <button
                type="button" onClick={() => removeUnitFn(i)}
                style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Unit Number</label>
              <input style={inputStyle} value={unit.unit_number} onChange={e => updateUnitFn(i, 'unit_number', e.target.value)} placeholder="e.g. A1" />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={selectStyle} value={unit.type} onChange={e => updateUnitFn(i, 'type', e.target.value)}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Floor</label>
              <input style={inputStyle} type="number" min={0} value={unit.floor} onChange={e => updateUnitFn(i, 'floor', Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Bedrooms</label>
              <input style={inputStyle} type="number" min={0} value={unit.bedrooms} onChange={e => updateUnitFn(i, 'bedrooms', Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Bathrooms</label>
              <input style={inputStyle} type="number" min={1} value={unit.bathrooms} onChange={e => updateUnitFn(i, 'bathrooms', Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Rent (KES)</label>
              <input style={inputStyle} type="number" min={0} value={unit.rent_kes} onChange={e => updateUnitFn(i, 'rent_kes', e.target.value)} placeholder="e.g. 15000" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Size (sqft)</label>
            <input style={{ ...inputStyle, maxWidth: 200 }} type="number" min={0} value={unit.size_sqft} onChange={e => updateUnitFn(i, 'size_sqft', e.target.value)} placeholder="Optional" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 2: Photos ────────────────────────────────────────────────────────────
function StepPhotos({ form, setField }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
        Upload photos for the property. At least 1 photo is required before submission.
      </p>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 20 }}>
        <h3 style={{ color: '#34d399', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>📋 Property Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginTop: 2 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 16, padding: 20 }}>
        <h3 style={{ color: '#a78bfa', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>🏠 Units ({form.units.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.units.map((u, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: 12, minWidth: 32 }}>#{u.unit_number}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{u.type.replace(/_/g, ' ')} · Floor {u.floor}</span>
              <span style={{ marginLeft: 'auto', color: '#34d399', fontWeight: 700, fontSize: 12 }}>
                KES {Number(u.rent_kes || 0).toLocaleString('en-KE')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {form.photos?.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>📸 Photos ({form.photos.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
            {form.photos.map((url, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3' }}>
                <img src={url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 16, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12 }}>
        <p style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #0d1b2a 100%)', padding: '32px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0 }}>Register Property</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Admin / Agent · Multi-step wizard</p>
            </div>
          </div>
        </div>

        {/* Step Bar */}
        <StepBar step={step} />

        {/* Card */}
        <div style={glassCard}>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 24 }}>
            {STEPS[step]}
          </h2>

          {step === 0 && <StepDetails form={form} setField={setField} />}
          {step === 1 && <StepUnits form={form} addUnitFn={addUnitFn} removeUnitFn={removeUnitFn} updateUnitFn={updateUnitFn} />}
          {step === 2 && <StepPhotos form={form} setField={setField} />}
          {step === 3 && <StepReview form={form} />}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
          <button
            onClick={step === 0 ? () => navigate('/properties') : back}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 24px rgba(99,102,241,0.35)', fontFamily: 'inherit' }}
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
