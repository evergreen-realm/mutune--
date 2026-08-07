import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { createProperty, addUnit, geocodeAddress } from '../lib/api';
import ImageUpload from '../components/ImageUpload';
import GuidedPhotoCaptureModal from '../components/GuidedPhotoCaptureModal';
import {
  Building2, Home, ChevronRight, ChevronLeft, Check,
  Trash2, Plus, MapPin, Layers, Camera, Sparkles
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

const AREA_COORDINATES = {
  'Nyali': [39.6978, -4.0287],
  'Bamburi': [39.7139, -3.9858],
  'Mtwapa': [39.7423, -3.9458],
  'Tudor': [39.6669, -4.0401],
  'Likoni': [39.6586, -4.0847],
  'Changamwe': [39.6200, -4.0305],
  'Kisauni': [39.6736, -4.0152],
  'Mvita': [39.6639, -4.0536],
  'Mkomani': [39.6914, -4.0396],
  'Shanzu': [39.7291, -3.9681],
  'Kongowea': [39.6766, -4.0385],
  'Mikindani': [39.6000, -4.0100],
  'Port Reitz': [39.5850, -4.0350]
};

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

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
        <label className={labelClass}>Location Setup Method</label>
        <div className="flex gap-6 mb-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="locationMethod"
              checked={form.locationMethod === 'estimate'}
              onChange={() => setField('locationMethod', 'estimate')}
              className="accent-blue-600"
            />
            Area Estimate
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="locationMethod"
              checked={form.locationMethod === 'gps'}
              onChange={() => setField('locationMethod', 'gps')}
              className="accent-blue-600"
            />
            Real GPS Coordinates
          </label>
        </div>

        {form.locationMethod === 'gps' ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={form.location?.coordinates?.[1] || ''}
                  onChange={e => {
                    const lat = parseFloat(e.target.value) || 0;
                    const lng = form.location?.coordinates?.[0] || 39.6682;
                    setField('location', { type: 'Point', coordinates: [lng, lat] });
                  }}
                  placeholder="e.g. -4.0435"
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={form.location?.coordinates?.[0] || ''}
                  onChange={e => {
                    const lng = parseFloat(e.target.value) || 0;
                    const lat = form.location?.coordinates?.[1] || -4.0435;
                    setField('location', { type: 'Point', coordinates: [lng, lat] });
                  }}
                  placeholder="e.g. 39.6682"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const lat = position.coords.latitude;
                      const lng = position.coords.longitude;
                      setField('location', { type: 'Point', coordinates: [lng, lat] });
                      toast.success(`📍 Real GPS Coordinates detected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    },
                    (error) => {
                      toast.error(`Failed to get location: ${error.message}`);
                    }
                  );
                } else {
                  toast.error('Geolocation is not supported by your browser');
                }
              }}
              className="self-start text-xs font-semibold py-1.5 px-3 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-450 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer transition"
            >
              📍 Detect My Current Location
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Will automatically estimate location from Nyali area standard coordinates when saved.
          </p>
        )}
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

// ── Step 2: Photos & Floor Plan ────────────────────────────────────────────────────────────
function StepPhotos({ form, setField, onLaunchCapture }) {
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

      <p className="text-slate-500 dark:text-slate-400 text-xs mt-4">
        Upload a floor plan image (Optional). Used for generating 3D models.
      </p>
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <ImageUpload
          value={form.floor_plan_url ? [form.floor_plan_url] : []}
          onChange={urls => setField('floor_plan_url', urls[0] || '')}
          multiple={false}
          label="Floor Plan Layout (Optional)"
        />
      </div>

      {/* 360° 3D Gaussian Scan Card */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-950/20 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-400" size={18} />
            <h3 className="text-slate-900 dark:text-white font-bold text-sm">360° 3D Gaussian Scan (Splat)</h3>
          </div>
          {form.splatUrl && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✓ Scan Attached
            </span>
          )}
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-4">
          Capture 16 overlapping photos to generate an interactive 3D Gaussian Splat model for potential tenants to tour on the map.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onLaunchCapture}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/20"
          >
            <Camera size={15} />
            Launch 360° Room Capture HUD
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            Direct .splat / 3D Asset URL (Optional)
          </label>
          <input
            type="text"
            value={form.splatUrl || ''}
            onChange={e => setField('splatUrl', e.target.value)}
            placeholder="https://example.com/scans/room.splat"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Review & Submit ───────────────────────────────────────────────────
function StepReview({ form }) {
  const totalRent = form.units.reduce((s, u) => s + (Number(u.rent_kes) || 0), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/25 rounded-2xl p-5">
        <h3 className="text-blue-600 dark:text-blue-400 font-extrabold text-sm mb-3">📋 Property Summary</h3>
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
  floor_plan_url: '',
  splatUrl: '',
  assets: [],
  locationMethod: 'estimate',
  location: { type: 'Point', coordinates: [39.6978, -4.0287] }
};

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const handleCaptureComplete = (capturedPhotos) => {
    const demoSplatUrl = capturedPhotos[0] || 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';
    setForm(prev => ({
      ...prev,
      splatUrl: demoSplatUrl,
      assets: [
        ...(prev.assets || []),
        {
          id: 'splat-' + Date.now(),
          title: '360° Gaussian Room Scan',
          type: 'splat',
          splatUrl: demoSplatUrl,
          status: 'ready',
          createdAt: new Date().toISOString()
        }
      ]
    }));
    toast.success('✨ 360° Scan captured! 3D Gaussian Splat model attached.');
  };

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
      const invalidRent = form.units.find(u => !u.rent_kes || Number(u.rent_kes) <= 0);
      if (invalidRent) { toast.error('Every unit must have a valid rent amount greater than 0'); return false; }
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
      let coords = [39.6682, -4.0435];
      if (form.locationMethod === 'gps' && form.location?.coordinates?.length === 2) {
        coords = form.location.coordinates;
      } else {
        const geo = await geocodeAddress(form.address.street, form.address.area, 'Mombasa');
        coords = [geo.lng, geo.lat];
      }

      // 1. Create the property
      const res = await createProperty({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        num_floors: form.num_floors,
        year_built: form.year_built ? Number(form.year_built) : undefined,
        address: form.address,
        photos: form.photos,
        floor_plan_url: form.floor_plan_url,
        splatUrl: form.splatUrl,
        assets: form.assets,
        location: { type: 'Point', coordinates: coords }
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
    <div className="relative text-slate-900 dark:text-slate-100">
      <GuidedPhotoCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onComplete={handleCaptureComplete}
      />
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
          {step === 2 && <StepPhotos form={form} setField={setField} onLaunchCapture={() => setIsCaptureOpen(true)} />}
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
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: submitting ? 'rgba(37,99,235,0.3)' : 'linear-gradient(135deg,#2563EB,#1D4ED8)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 8px 24px rgba(37,99,235,0.35)', fontFamily: 'inherit' }}
            >
              {submitting ? '⏳ Submitting…' : '✅ Submit Property'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
