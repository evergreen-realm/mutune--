import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { createPropertyWithGPS } from '../lib/api';

const PROPERTY_TYPES = ['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio'];
const MOMBASA_AREAS = [
  'Nyali', 'Bamburi', 'Mtwapa', 'Tudor', 'Likoni', 'Changamwe', 'Kisauni',
  'Mvita', 'Mkomani', 'Shanzu', 'Kongowea', 'Mikindani', 'Port Reitz'
];

// Default Mombasa Central coordinates — used automatically for all new properties
const DEFAULT_COORDS = { lng: 39.6682, lat: -4.0435, accuracy: 10 };

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        location: { coordinates: [DEFAULT_COORDS.lng, DEFAULT_COORDS.lat], accuracy: DEFAULT_COORDS.accuracy }
      });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Property ${res.data?.property_code} created successfully ✓`);
      navigate('/properties');
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Failed to create property';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Building2 className="text-green-600" size={22} /> Add New Property
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Fill in the property details below to register a new listing.
        </p>
      </div>

      {/* Property Details Panel */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Property Details</h2>

        {/* Location badge */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm">
          <MapPin size={15} className="text-green-600 flex-shrink-0" />
          <span className="text-green-800 font-medium">Location auto-set to Mombasa Central</span>
          <span className="text-green-500 font-mono text-xs ml-auto">{DEFAULT_COORDS.lat.toFixed(4)}, {DEFAULT_COORDS.lng.toFixed(4)}</span>
        </div>

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
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
            {loading ? 'Creating…' : 'Create Property'}
          </button>
        </form>
      </div>
    </div>
  );
}
