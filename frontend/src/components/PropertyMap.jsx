import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, MapPin } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function PropertyMap({ properties, onSelectProperty }) {
  const center = [-4.0435, 39.6682]; // Mombasa default center

  return (
    <div className="h-96 w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 relative z-0">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map((p) => {
          const lat = p.location?.coordinates?.[1] || -4.0435;
          const lng = p.location?.coordinates?.[0] || 39.6682;

          return (
            <Marker key={p._id} position={[lat, lng]}>
              <Popup>
                <div className="p-1 space-y-1 font-sans text-xs">
                  <span className="font-bold block text-slate-900">{p.name}</span>
                  <span className="text-[11px] text-slate-600 block">{p.address?.area || 'Mombasa'}</span>
                  {onSelectProperty && (
                    <button
                      onClick={() => onSelectProperty(p._id)}
                      className="mt-1 px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
