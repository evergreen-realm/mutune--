import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Crosshair, Loader2, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { createPropertyWithGPS } from '../lib/api';

const PROPERTY_TYPES = ['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio'];
const MOMBASA_AREAS = [
  'Nyali', 'Bamburi', 'Mtwapa', 'Tudor', 'Likoni', 'Changamwe', 'Kisauni',
  'Mvita', 'Mkomani', 'Shanzu', 'Kongowea', 'Mikindani', 'Port Reitz'
];

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'apartment',
    street: '',
    area: 'Nyali',
    city: 'Mombasa',
    rent_kes: '',
    units: []
  });

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 50) {
          toast.warning(`GPS accuracy ${Math.round(accuracy)}m. Required: <50m. Move closer to the building entrance.`);
        } else {
          toast.success(`GPS captured — accuracy: ${accuracy.toFixed(1)}m ✓`);
        }
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setGpsLoading(false);
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Please allow location in browser settings.',
          2: 'Position unavailable. Try outside or near a window.',
          3: 'GPS timed out. Move outdoors and try again.'
        };
        toast.error(messages[err.code] || `GPS failed: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      toast.error('GPS location required. Tap "Capture GPS" first.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Property name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await createPropertyWithGPS({
        name: form.name.trim(),
        type: form.type,
        address: { street: form.street.trim(), area: form.area, city: form.city },
        rent_kes: form.rent_kes ? Number(form.rent_kes) : 0,
        location: { coordinates: [coords.lng, coords.lat], accuracy: coords.accuracy }
      });
      toast.success(`Property ${res.data?.property_code} created with GPS ✓`);
      navigate('/properties');
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Failed to create property';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const accuracyOk = coords && coords.accuracy <= 50;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Building2 className="text-green-600" size={22} /> Add Property with GPS
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Stand at the building entrance, capture your GPS, then fill in details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GPS Panel */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Step 1 — GPS Capture</h2>

          <button
            type="button"
            id="btn-capture-gps"
            onClick={captureGPS}
            disabled={gpsLoading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-sm shadow-green-200"
          >
            {gpsLoading
              ? <><Loader2 size={16} className="animate-spin" /> Getting location…</>
              : <><Crosshair size={16} /> {coords ? 'Re-capture GPS' : 'Capture GPS Location'}</>
            }
          </button>

          {coords && (
            <div className={`rounded-xl p-4 border text-sm space-y-1 ${accuracyOk ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {accuracyOk
                  ? <CheckCircle2 size={15} className="text-green-600" />
                  : <AlertTriangle size={15} className="text-amber-500" />
                }
                <span className={accuracyOk ? 'text-green-800' : 'text-amber-800'}>
                  Accuracy: {coords.accuracy.toFixed(1)}m {accuracyOk ? '✓ Good' : '⚠ Too high (>50m)'}
                </span>
              </div>
              <p className="text-gray-500 font-mono text-xs">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </p>
              {!accuracyOk && (
                <p className="text-xs text-amber-700">
                  Move closer to the building entrance and re-capture.
                </p>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-gray-50 text-xs text-gray-400 space-y-1">
            <p>• Required accuracy: <strong>&lt;50m</strong></p>
            <p>• A Google Plus Code will be auto-generated for the address</p>
            <p>• GPS accuracy improves outdoors away from buildings</p>
          </div>
        </div>

        {/* Property Details Panel */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Step 2 — Property Details</h2>
          <form id="add-property-form" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="prop-name">Property Name *</label>
              <input
                id="prop-name"
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Nyali Heights Block A"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="prop-type">Type</label>
                <select
                  id="prop-type"
                  value={form.type}
                  onChange={set('type')}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white"
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="prop-area">Area</label>
                <select
                  id="prop-area"
                  value={form.area}
                  onChange={set('area')}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white"
                >
                  {MOMBASA_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="prop-street">Street Address *</label>
              <input
                id="prop-street"
                type="text"
                value={form.street}
                onChange={set('street')}
                placeholder="e.g. Links Road, off Nyali Bridge"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="prop-rent">Default Rent (KES)</label>
              <input
                id="prop-rent"
                type="number"
                min="0"
                value={form.rent_kes}
                onChange={set('rent_kes')}
                placeholder="e.g. 25000"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
            </div>

            <button
              id="btn-create-property"
              type="submit"
              disabled={loading || !coords || !accuracyOk}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
              {loading ? 'Creating…' : 'Create Property'}
            </button>

            {coords && !accuracyOk && (
              <p className="text-xs text-amber-600 text-center">
                GPS accuracy must be ≤50m before creating the property.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
