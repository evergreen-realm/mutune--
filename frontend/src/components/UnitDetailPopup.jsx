import { useState } from 'react';
import { Wifi, Car, Shield, Droplets, Trees, Dumbbell, Wind, Zap, Home } from 'lucide-react';

// Map amenity strings to icons — shows whatever actually exists in property.amenities
const AMENITY_ICONS = {
  wifi: Wifi,
  parking: Car,
  security: Shield,
  water: Droplets,
  garden: Trees,
  gym: Dumbbell,
  'air conditioning': Wind,
  electricity: Zap,
  balcony: Home,
};

function getAmenityIcon(amenity) {
  const key = amenity.toLowerCase().trim();
  for (const [match, Icon] of Object.entries(AMENITY_ICONS)) {
    if (key.includes(match)) return Icon;
  }
  return Home; // fallback icon
}

export default function UnitDetailPopup({ unit, property, theme = 'dark' }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const isLight = theme === 'light';

  // Use property-level photos (unit.images doesn't exist in the schema)
  const photos = property?.photos || [];
  const amenities = property?.amenities || [];
  const hasPhotos = photos.length > 0;

  return (
    <div className={`relative w-full h-full min-h-[250px] overflow-hidden flex flex-col ${
      isLight ? 'bg-slate-100' : 'bg-slate-950'
    }`}>
      {hasPhotos ? (
        <>
          {/* Main photo display */}
          <div className="relative flex-1 min-h-[160px]">
            <img
              src={photos[photoIndex]}
              alt={`${property?.name || 'Property'} photo ${photoIndex + 1}`}
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${
              isLight ? 'from-slate-100/60' : 'from-slate-950/60'
            } via-transparent to-transparent pointer-events-none`} />

            {/* Photo counter badge */}
            <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-md ${
              isLight
                ? 'bg-white/80 text-slate-700 border border-slate-200'
                : 'bg-black/60 text-white border border-white/10'
            }`}>
              {photoIndex + 1} / {photos.length}
            </span>

            {/* Nav arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full border border-white/10 transition cursor-pointer text-xs"
                >
                  ←
                </button>
                <button
                  onClick={() => setPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full border border-white/10 transition cursor-pointer text-xs"
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className={`flex gap-1.5 px-2 py-1.5 overflow-x-auto ${
              isLight ? 'bg-slate-50' : 'bg-slate-900/80'
            }`}>
              {photos.map((ph, idx) => (
                <button
                  key={idx}
                  onClick={() => setPhotoIndex(idx)}
                  className={`w-10 h-7 rounded overflow-hidden border-2 flex-shrink-0 transition cursor-pointer ${
                    idx === photoIndex
                      ? 'border-blue-500 scale-95 shadow'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={ph} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Amenities row */}
          {amenities.length > 0 && (
            <div className={`flex gap-3 px-3 py-2 border-t overflow-x-auto ${
              isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-900/50 border-slate-800'
            }`}>
              {amenities.map((amenity, idx) => {
                const Icon = getAmenityIcon(amenity);
                return (
                  <span
                    key={idx}
                    className={`flex flex-col items-center gap-0.5 flex-shrink-0 ${
                      isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="text-[8px] font-medium capitalize whitespace-nowrap">
                      {amenity}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Building photos label */}
          <div className={`px-3 py-1 text-[8px] font-medium uppercase tracking-wider ${
            isLight ? 'text-slate-400 bg-slate-50' : 'text-slate-600 bg-slate-900/30'
          }`}>
            Building Photos · {property?.name || 'Property'}
          </div>
        </>
      ) : (
        /* Empty state — kept as-is per directive */
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-20 h-14 rounded-lg border-2 border-dashed flex items-center justify-center mb-3 ${
            isLight
              ? 'border-slate-300 bg-slate-50'
              : 'border-blue-500/40 bg-blue-950/20'
          }`}>
            <Home size={20} className={isLight ? 'text-slate-400' : 'text-blue-400/60'} />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border ${
            isLight
              ? 'bg-slate-200/50 border-slate-300 text-slate-500'
              : 'bg-blue-600/30 border-blue-500/60 text-blue-400'
          }`}>
            No Photos Available
          </span>
          <span className={`text-[9px] font-mono mt-1.5 uppercase tracking-wider ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Unit {unit?.unit_number || ''}
          </span>
        </div>
      )}
    </div>
  );
}
