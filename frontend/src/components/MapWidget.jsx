import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const STATUS_COLORS = {
  paid:        '#22c55e',
  overdue:     '#ef4444',
  pending:     '#eab308',
  vacant:      '#6b7280',
  maintenance: '#f97316'
};

function createStatusIcon(status) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.vacant;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

/**
 * Inner component: creates a Leaflet markerClusterGroup and manages its lifecycle.
 * Falls back gracefully if leaflet.markercluster is not installed.
 */
function ClusterLayer({ properties, onPropertySelect }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!properties?.length) return;

    // Attempt to use markercluster — fail gracefully if absent
    let layer;
    try {
      // Dynamic require so the rest of the map still works without the package
      layer = L.markerClusterGroup({ maxClusterRadius: 60, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
    } catch (_e) {
      layer = L.layerGroup();
    }

    properties.forEach((prop) => {
      const coords = prop.location?.coordinates;
      if (!coords?.length) return;
      const [lng, lat] = coords;
      const status = getPropertyStatus(prop);
      const marker = L.marker([lat, lng], { icon: createStatusIcon(status) });
      marker.bindPopup(buildPopupContent(prop), { maxWidth: 260 });
      marker.on('click', () => onPropertySelect?.(prop));
      layer.addLayer(marker);
    });

    map.addLayer(layer);
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, properties, onPropertySelect]);

  return null;
}

function getPropertyStatus(property) {
  const units = property.units || [];
  if (!units.length) return 'vacant';
  const occupied = units.filter((u) => u.status === 'occupied');
  if (!occupied.length) return 'vacant';
  if (units.some((u) => u.status === 'maintenance')) return 'maintenance';
  if (occupied.some((u) => u.lock_status === 'locked')) return 'paid';
  if (occupied.some((u) => u.lock_status === 'payment_confirmed')) return 'paid';
  return 'pending';
}

function buildPopupContent(prop) {
  const occupiedCount = prop.units?.filter((u) => u.status === 'occupied').length || 0;
  const totalUnits = prop.units?.length || 0;
  const plusCode = prop.address?.plus_code ? `<p style="font-size:11px;color:#16a34a;margin-top:4px">📍 ${prop.address.plus_code}</p>` : '';
  return `
    <div style="min-width:200px;font-family:Inter,sans-serif">
      <p style="font-weight:700;font-size:14px;margin:0 0 2px">${prop.name}</p>
      <p style="font-size:11px;color:#6b7280;font-family:monospace;margin:0">${prop.property_code}</p>
      <p style="font-size:12px;color:#374151;margin:6px 0 2px">📍 ${prop.address?.area || ''}, ${prop.address?.city || 'Mombasa'}</p>
      <p style="font-size:12px;margin:2px 0">Units: <strong>${occupiedCount}/${totalUnits}</strong> occupied</p>
      ${plusCode}
    </div>`;
}

/**
 * MapWidget — shows a clustered property map with search, status legend, and agent location.
 *
 * Props:
 *   properties    — array of property objects from the API
 *   agentLocation — { lat, lng, accuracy } | null
 *   onPropertySelect — callback(property) when user clicks a marker
 */
export default function MapWidget({ properties = [], agentLocation = null, onPropertySelect }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase();
    return properties.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.property_code?.toLowerCase().includes(q) ||
        p.address?.area?.toLowerCase().includes(q) ||
        p.address?.plus_code?.toLowerCase().includes(q)
    );
  }, [searchQuery, properties]);

  const center = useMemo(() => {
    if (agentLocation) return [agentLocation.lat, agentLocation.lng];
    const first = filtered[0];
    if (first?.location?.coordinates?.length) {
      const [lng, lat] = first.location.coordinates;
      return [lat, lng];
    }
    return [-4.0435, 39.6682]; // Mombasa CBD default
  }, [agentLocation, filtered]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
        <h3 className="font-bold text-gray-900 text-sm">Property Map</h3>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="map-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, area, Plus Code…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
          />
        </div>
        <span className="text-xs text-gray-400 font-medium">{filtered.length} shown</span>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '420px', width: '100%' }}
        scrollWheelZoom={false}
        key={center.join(',')}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer properties={filtered} onPropertySelect={onPropertySelect} />
        {agentLocation && (
          <Circle
            center={[agentLocation.lat, agentLocation.lng]}
            radius={agentLocation.accuracy || 30}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1.5 }}
          />
        )}
        {agentLocation && (
          <Marker
            position={[agentLocation.lat, agentLocation.lng]}
            icon={L.divIcon({
              className: 'custom-marker',
              html: '<div style="background:#3b82f6;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px #3b82f6"></div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}
          >
            <Popup><strong>Your Location</strong><br />Accuracy: {agentLocation.accuracy?.toFixed(0)}m</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t bg-gray-50 flex flex-wrap gap-4">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}
