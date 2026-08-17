import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, MapPin, BedDouble, Bath, CheckCircle2,
  Phone, Mail, User, X, Filter, ArrowRight, Home, Sparkles,
  ChevronRight, Compass, Shield, Tag, Calendar, Eye, Send
} from 'lucide-react';
import { fetchPublicListings, submitPropertyInquiry } from '../lib/api';
import MapWidget from '../components/MapWidget';
import { toast } from 'react-toastify';

export default function PropertyListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [inquiryModal, setInquiryModal] = useState({ open: false, property: null, unit: null });
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    message: ''
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('all');

  useEffect(() => {
    loadListings();
  }, [propertyType, bedrooms]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (propertyType !== 'all') params.property_type = propertyType;
      if (bedrooms !== 'all') params.bedrooms = bedrooms;
      if (maxPrice) params.maxRent = maxPrice;
      if (searchQuery) params.search = searchQuery;

      const res = await fetchPublicListings(params);
      if (res?.data?.success) {
        setListings(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load available property listings');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadListings();
  };

  const handleInquireClick = (property, unit = null) => {
    setInquiryModal({
      open: true,
      property,
      unit
    });
    setInquiryForm({
      name: '',
      phone: '',
      email: '',
      message: `Hi, I am interested in viewing ${property.name}${unit ? ` (Unit ${unit.unit_number})` : ''}. Please contact me.`
    });
  };

  const handleSendInquiry = async (e) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.phone) {
      toast.error('Please provide your name and phone number');
      return;
    }
    setSubmittingInquiry(true);
    try {
      const payload = {
        name: inquiryForm.name,
        phone: inquiryForm.phone,
        email: inquiryForm.email,
        message: inquiryForm.message,
        unit_id: inquiryModal.unit?.unit_id || null,
        unit_number: inquiryModal.unit?.unit_number || 'General Property Inquiry'
      };

      const res = await submitPropertyInquiry(inquiryModal.property.property_id, payload);
      if (res?.data?.success) {
        toast.success('Inquiry sent! Managing agent notified ✓');
        setInquiryModal({ open: false, property: null, unit: null });
      } else {
        toast.error('Failed to submit inquiry');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Error submitting inquiry');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
              <Building2 size={20} />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block leading-none">MutuneRent</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Public Listings</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative py-12 px-6 overflow-hidden bg-gradient-to-b from-emerald-950/20 via-slate-950 to-slate-950 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
            <Sparkles size={13} /> Verified Vacant Properties in Kenya
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Find Your Next Coastal Home or Office
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto">
            Browse verified vacant apartments, studios, and commercial spaces across Mombasa and Nairobi with instant viewing scheduling.
          </p>

          {/* Search & Filter Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="max-w-4xl mx-auto mt-8 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row gap-3 items-center"
          >
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl w-full">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search area, street, or property name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none w-full md:w-36"
              >
                <option value="all">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="apartment">Apartments</option>
                <option value="bedsitter">Bedsitters / Studios</option>
              </select>

              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none w-full md:w-32"
              >
                <option value="all">Bedrooms</option>
                <option value="1">1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3+ Bedrooms</option>
              </select>

              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 whitespace-nowrap"
              >
                <Search size={14} /> Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              Available Listings ({listings.length})
            </h2>
            <p className="text-xs text-slate-400">Directly managed by authorized Mutune Estate Agency representatives.</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${viewMode === 'grid' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${viewMode === 'map' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Map View
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading verified vacancies...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800 p-8 space-y-3">
            <Home size={40} className="text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Vacant Properties Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No vacant units match your current search filters. Try clearing your price or bedroom filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setPropertyType('all'); setBedrooms('all'); loadListings(); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition mt-2"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[600px] rounded-3xl overflow-hidden border border-slate-800 relative">
            <MapWidget
              properties={listings.map(l => ({
                _id: l.property_id,
                name: l.name,
                address: l.address,
                location: l.location,
                units: l.units
              }))}
              onPropertySelect={(p) => setSelectedProperty(p)}
            />
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {listings.map((prop) => (
              <div
                key={prop.property_id}
                className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden hover:border-slate-700 transition-all flex flex-col group shadow-xl"
              >
                {/* Photo Header */}
                <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden">
                  {prop.photos && prop.photos.length > 0 ? (
                    <img
                      src={prop.photos[0]}
                      alt={prop.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950/30 to-slate-900 text-slate-600">
                      <Building2 size={40} />
                    </div>
                  )}

                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {prop.vacant_units_count} {prop.vacant_units_count === 1 ? 'Unit Vacant' : 'Units Vacant'}
                  </div>

                  <div className="absolute bottom-3 right-3 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-right">
                    <span className="text-[10px] text-slate-400 block leading-none">Starting from</span>
                    <span className="text-sm font-black text-white font-mono">KES {prop.price_range_kes.min.toLocaleString('en-KE')}</span>
                    <span className="text-[10px] text-slate-400">/mo</span>
                  </div>
                </div>

                {/* Property Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                      {prop.name}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-emerald-400 flex-shrink-0" />
                      {prop.address?.area || 'Mombasa'}, {prop.address?.city || 'Kenya'}
                    </p>

                    {/* Amenities Badges */}
                    {prop.amenities && prop.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {prop.amenities.slice(0, 3).map((am, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-300"
                          >
                            {am}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vacant Units Breakdown */}
                  <div className="border-t border-slate-800/60 pt-3 space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Available Units:</span>
                    <div className="space-y-1.5">
                      {prop.units.slice(0, 2).map((unit) => (
                        <div
                          key={unit.unit_id}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/80"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">Unit {unit.unit_number}</span>
                            <span className="text-[10px] text-slate-400">({unit.bedrooms ? `${unit.bedrooms} Bed` : unit.unit_type || 'Studio'})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-400 font-mono">KES {unit.rent_kes.toLocaleString('en-KE')}</span>
                            <button
                              onClick={() => handleInquireClick(prop, unit)}
                              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Inquire
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Property Action */}
                  <button
                    onClick={() => handleInquireClick(prop)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700 hover:border-emerald-500 cursor-pointer"
                  >
                    <Calendar size={13} /> Schedule Viewing / Inquire
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Inquiry Modal */}
      <AnimatePresence>
        {inquiryModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Inquire / Book Viewing</h3>
                  <p className="text-xs text-slate-400">
                    {inquiryModal.property?.name} {inquiryModal.unit ? `• Unit ${inquiryModal.unit.unit_number}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setInquiryModal({ open: false, property: null, unit: null })}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSendInquiry} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mary Wanjiku"
                    value={inquiryForm.name}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Phone Number (M-Pesa / WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0712345678"
                    value={inquiryForm.phone}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. mary@example.com"
                    value={inquiryForm.email}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Message / Preferred Viewing Date</label>
                  <textarea
                    rows={3}
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400 flex items-center gap-2">
                  <Shield size={14} className="flex-shrink-0" />
                  Your contact info is dispatched securely to the authorized managing agent.
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInquiryModal({ open: false, property: null, unit: null })}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInquiry}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
                  >
                    <Send size={13} /> {submittingInquiry ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
