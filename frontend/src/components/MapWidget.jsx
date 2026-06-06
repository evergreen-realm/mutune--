import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [-4.0435, 39.6682]; // Mombasa Center

export default function MapWidget({ properties = [], agentLocation }) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMapReady(true);
  }, []);

  if (!mapReady) {
    return <div className="h-[400px] bg-gray-100 rounded-lg animate-pulse" />;
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden h-[450px] relative">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-gray-800">Property Portfolio Map</h3>
        <span className="text-xs text-gray-500">{properties?.length || 0} properties</span>
      </div>
      <div className="h-[370px] rounded-lg overflow-hidden border border-gray-100">
        <MapContainer 
          center={DEFAULT_CENTER} 
          zoom={13} 
          scrollWheelZoom={false} 
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {properties?.map((p) => (
            <Marker 
              key={p._id} 
              position={[p.location?.coordinates?.[1] || -4.04, p.location?.coordinates?.[0] || 39.71]}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-gray-800 text-sm">{p.name}</h4>
                  <p className="text-xs text-gray-500 font-mono mb-1">{p.property_code}</p>
                  <div className="flex justify-between items-center text-xs border-t pt-1 mt-1">
                    <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {p.type || 'property'}
                    </span>
                    <span className="font-bold text-gray-700">
                      {p.units?.length || 0} Units
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {agentLocation && (
            <Circle
              center={[agentLocation.lat, agentLocation.lng]}
              radius={agentLocation.accuracy || 50}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
