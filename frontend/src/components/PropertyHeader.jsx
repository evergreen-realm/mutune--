import React from 'react';
import { ArrowLeft, Building2, MapPin, Sparkles, Navigation } from 'lucide-react';
import CheckInButton from './CheckInButton';

export default function PropertyHeader({
  property,
  onBack,
  isAgent,
  dbUser
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition border border-slate-700"
          title="Back to Properties"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black text-white">{property?.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              {property?.property_code}
            </span>
            {property?.gaussian_splat_url && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Sparkles size={11} /> 3D Splat Enabled
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <MapPin size={13} className="text-slate-400" />
            <span>{property?.address?.area || 'Mombasa'}, {property?.address?.city || 'Mombasa'}</span>
            {property?.plus_code && (
              <>
                <span>•</span>
                <span className="font-mono text-blue-400">{property.plus_code}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GPS Agent Check-In Quick Trigger */}
      {isAgent && property && (
        <div className="flex items-center gap-2">
          <CheckInButton propertyId={property._id} propertyName={property.name} />
        </div>
      )}
    </div>
  );
}
