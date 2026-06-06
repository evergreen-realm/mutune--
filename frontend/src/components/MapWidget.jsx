import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const DEFAULT_CENTER = [-4.0435, 39.6682]; // Mombasa Center

export default function MapWidget({ properties }) {
  const mapProperties = properties?.filter(p => p.location?.coordinates?.length === 2) || [];

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden h-[400px] relative">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Property Portfolio Map (Mombasa)</h3>
      <div className="h-[330px] rounded-lg overflow-hidden border border-gray-100">
        <MapContainer 
          center={DEFAULT_CENTER} 
          zoom={12} 
          scrollWheelZoom={false} 
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
          />
          {mapProperties.map((p) => (
            <Marker 
              key={p._id} 
              position={[p.location.coordinates[1], p.location.coordinates[0]]} // Mongoose coordinates order: [longitude, latitude]
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-gray-800 text-sm">{p.name}</h4>
                  <p className="text-xs text-gray-500 font-mono mb-1">{p.property_code}</p>
                  <div className="flex justify-between items-center text-xs border-t pt-1 mt-1">
                    <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {p.type}
                    </span>
                    <span className="font-bold text-gray-700">
                      {p.units?.length || 0} Units
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
