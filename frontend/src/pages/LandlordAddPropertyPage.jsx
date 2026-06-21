import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { submitLandlordProperty } from '../lib/api';
import ImageUpload from '../components/ImageUpload';
import { Building2, Home, ChevronRight, ChevronLeft, Check, Trash2, Plus } from 'lucide-react';

const STEPS = ['Property Details', 'Units', 'Photos', 'Contract & Sign'];

const glassCard = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 24,
  padding: 32
};

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit'
};

const labelStyle = {
  color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em'
};

export default function LandlordAddPropertyPage() {
  const { user: clerkUser } = useUser();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const [form, setForm] = useState({
    name: '', type: 'apartment', description: '', num_floors: 1, year_built: '',
    address: { street: '', area: '', city: 'Mombasa', county: 'Mombasa County' },
    units: [{ unit_number: '1A', type: 'bedsitter', bedrooms: 1, bathrooms: 1, rent_kes: '', floor: 0, size_sqft: '', amenities: [] }],
    contract_terms: 'Standard 12-month management agreement. Mutune Estate Agency will manage the property and collect rent on behalf of the landlord. Agency fee: 10% of monthly rent. Agreement renewable annually.',
    signature_data_url: '',
    photos: []
  });

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

  const addUnit = () => {
    const n = form.units.length + 1;
    setForm(prev => ({ ...prev, units: [...prev.units, { unit_number: `${n}`, type: 'bedsitter', bedrooms: 1, bathrooms: 1, rent_kes: '', floor: 0, size_sqft: '', amenities: [] }] }));
  };

  const removeUnit = (i) => {
    if (form.units.length <= 1) return;
    setForm(prev => ({ ...prev, units: prev.units.filter((_, idx) => idx !== i) }));
  };

  const updateUnit = (i, key, value) => {
    setForm(prev => {
      const units = [...prev.units];
      units[i] = { ...units[i], [key]: value };
      return { ...prev, units };
    });
  };

  // Canvas signature
  useEffect(() => {
    if (step === 3 && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(24, canvas.height - 32);
      ctx.lineTo(canvas.width - 24, canvas.height - 32);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [step]);

  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    e.preventDefault();
    setIsDrawing(false);
    if (canvasRef.current) {
      setField('signature_data_url', canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(24, canvas.height - 32);
    ctx.lineTo(canvas.width - 24, canvas.height - 32);
    ctx.stroke();
    ctx.setLineDash([]);
    setHasSigned(false);
    setField('signature_data_url', '');
  };

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) { toast.error('Property name is required'); return false; }
      if (!form.address.area.trim()) { toast.error('Area is required'); return false; }
    }
    if (step === 1) {
      for (const u of form.units) {
        if (!u.unit_number.trim()) { toast.error('All units need a unit number'); return false; }
        if (!u.rent_kes || Number(u.rent_kes) <= 0) { toast.error('All units need a valid rent amount'); return false; }
      }
    }
    if (step === 3 && !hasSigned) {
      toast.error('Please sign the management agreement before submitting');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        units: form.units.map(u => ({ ...u, rent_kes: Number(u.rent_kes) || 0 })),
        location: {
          type: 'Point',
          coordinates: [39.6682, -4.0435] // Mombasa Central default
        }
      };
      const res = await submitLandlordProperty(payload);
      toast.success(res.message || 'Property submitted for approval!');
      navigate('/properties');
    } catch (err) {
      toast.error(err?.error?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '24px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Add Your Property
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Submit a property for management by Mutune Estate Agency</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, transition: 'all 0.3s',
                  background: i < step ? '#10b981' : i === step ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                  color: i <= step ? '#fff' : 'rgba(255,255,255,0.35)',
                  boxShadow: i === step ? '0 4px 16px rgba(99,102,241,0.5)' : 'none'
                }}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span style={{ color: i === step ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: i === step ? 700 : 400 }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? '#10b981' : 'rgba(255,255,255,0.1)', margin: '0 8px', transition: 'all 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={glassCard}>

          {/* STEP 0: Property Details */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Property Details</h2>
              <div>
                <label style={labelStyle}>Property Name *</label>
                <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Westgate Apartments" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Type *</label>
                  <select value={form.type} onChange={e => setField('type', e.target.value)} style={inputStyle}>
                    {['apartment', 'house', 'commercial', 'bedsitter', 'single', 'studio'].map(t => (
                      <option key={t} value={t} style={{ background: '#1a1a3e' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Floors</label>
                  <input type="number" min="1" value={form.num_floors} onChange={e => setField('num_floors', Number(e.target.value))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={3} placeholder="Brief description of the property..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Area / Estate *</label>
                  <input value={form.address.area} onChange={e => setField('address.area', e.target.value)} placeholder="e.g. Nyali, Bamburi" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Street Address</label>
                  <input value={form.address.street} onChange={e => setField('address.street', e.target.value)} placeholder="e.g. Mombasa-Malindi Road" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Units */}
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Define Units ({form.units.length})</h2>
                <button onClick={addUnit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, padding: '8px 14px', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <Plus size={14} /> Add Unit
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 480, overflowY: 'auto' }}>
                {form.units.map((unit, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 14 }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700 }}>Unit {i + 1}</span>
                      {form.units.length > 1 && (
                        <button onClick={() => removeUnit(i)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Unit No. *</label>
                        <input value={unit.unit_number} onChange={e => updateUnit(i, 'unit_number', e.target.value)} placeholder="1A" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Type</label>
                        <select value={unit.type} onChange={e => updateUnit(i, 'type', e.target.value)} style={inputStyle}>
                          {['bedsitter', 'single', 'studio', '1-bedroom', '2-bedroom', '3-bedroom', 'commercial'].map(t => (
                            <option key={t} value={t} style={{ background: '#1a1a3e' }}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Rent (KES) *</label>
                        <input type="number" value={unit.rent_kes} onChange={e => updateUnit(i, 'rent_kes', e.target.value)} placeholder="15000" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Floor</label>
                        <input type="number" min="0" value={unit.floor} onChange={e => updateUnit(i, 'floor', Number(e.target.value))} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Photos */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Property Photos</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>
                Upload high-quality images of the property. Drag and drop local images or capture directly via your webcam.
              </p>
              
              <ImageUpload
                value={form.photos || []}
                onChange={urls => setField('photos', urls)}
                multiple={true}
                label="Property Photos"
              />
            </div>
          )}

          {/* STEP 3: Contract & Sign */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Management Agreement</h2>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, maxHeight: 200, overflowY: 'auto' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{form.contract_terms}</p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 10 }}>
                  <label style={labelStyle}>Your Signature *</label>
                  {hasSigned && (
                    <button onClick={clearSignature} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, overflow: 'hidden', cursor: 'crosshair', userSelect: 'none' }}>
                  <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 160, touchAction: 'none' }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  {hasSigned ? '✓ Signed' : 'Draw your signature above'}
                </p>
              </div>

              {/* Summary */}
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 20 }}>
                <h4 style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Submission Summary</h4>
                <div style={{ display: 'grid', gap: 6 }}>
                  {[
                    ['Property', form.name || '—'],
                    ['Type', form.type],
                    ['Area', form.address.area || '—'],
                    ['Units', form.units.length],
                    ['Photos', `${form.photos?.length || 0} uploaded`]
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifycontent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>{k}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifycontent: 'space-between', marginTop: 32, gap: 12 }}>
            <button onClick={back} disabled={step === 0} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 24px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: step === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
              borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: step === 0 ? 'not-allowed' : 'pointer'
            }}>
              <ChevronLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={next} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '12px 28px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(99,102,241,0.4)'
              }}>
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '12px 28px',
                background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(16,185,129,0.4)'
              }}>
                {submitting ? '⏳ Submitting…' : '✓ Submit Property'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #1a1a3e; }
      `}</style>
    </div>
  );
}
