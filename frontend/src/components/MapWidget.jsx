import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchUnitGeoJSON } from '../lib/api';

// ── Fix Leaflet default icon paths broken by Vite bundler ──────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// ── Status palette ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  paid:        '#22c55e',
  overdue:     '#ef4444',
  pending:     '#eab308',
  vacant:      '#6b7280',
  maintenance: '#f97316',
  occupied:    '#3b82f6'
};

const UNIT_STATUS_COLORS = {
  occupied:      '#3b82f6',
  vacant:        '#6b7280',
  maintenance:   '#f97316',
  notice_issued: '#ef4444'
};

// ── Icon factories ──────────────────────────────────────────────────────────
function createStatusIcon(status, size = 14) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.vacant;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function createUnitIcon(status, hasExactLocation) {
  const color = UNIT_STATUS_COLORS[status] || UNIT_STATUS_COLORS.vacant;
  const border = hasExactLocation ? '2px solid white' : '2px dashed rgba(255,255,255,0.7)';
  return L.divIcon({
    className: 'custom-unit-marker',
    html: `<div style="background:${color};width:10px;height:10px;border-radius:3px;border:${border};box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:rotate(45deg)"></div>`,
    iconSize:   [10, 10],
    iconAnchor: [5, 5]
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getPropertyStatus(property) {
  const units = property.units || [];
  if (!units.length) return 'vacant';
  if (units.some(u => u.status === 'maintenance')) return 'maintenance';
  const occupied = units.filter(u => u.status === 'occupied');
  if (!occupied.length) return 'vacant';
  if (occupied.some(u => ['payment_confirmed', 'locked'].includes(u.lock_status))) return 'paid';
  if (occupied.some(u => u.status === 'notice_issued')) return 'overdue';
  return 'pending';
}

function buildPropertyPopup(prop) {
  const occupiedCount = prop.units?.filter(u => u.status === 'occupied').length || 0;
  const totalUnits    = prop.units?.length || 0;
  const plusCode      = prop.address?.plus_code
    ? `<p style="font-size:11px;color:#16a34a;margin-top:4px">📍 ${prop.address.plus_code}</p>` : '';
  return `
    <div style="min-width:210px;font-family:Inter,sans-serif">
      <p style="font-weight:700;font-size:14px;margin:0 0 2px">${prop.name}</p>
      <p style="font-size:11px;color:#6b7280;font-family:monospace;margin:0">${prop.property_code}</p>
      <p style="font-size:12px;color:#374151;margin:6px 0 2px">📍 ${prop.address?.area || ''}, ${prop.address?.city || 'Mombasa'}</p>
      <p style="font-size:12px;margin:2px 0">Units: <strong>${occupiedCount}/${totalUnits}</strong> occupied</p>
      ${plusCode}
    </div>`;
}

function buildUnitPopup(feature) {
  const p = feature.properties;
  const exact = p.has_exact_location ? '✅ Exact GPS' : '⚠️ Estimated location';
  return `
    <div style="min-width:190px;font-family:Inter,sans-serif">
      <p style="font-weight:700;font-size:13px;margin:0 0 4px">Unit ${p.unit_number}</p>
      <p style="font-size:11px;color:#6b7280;margin:0 0 6px">${p.unit_type || 'Standard unit'}</p>
      <p style="font-size:12px;margin:2px 0">Status: <strong style="text-transform:capitalize">${p.status}</strong></p>
      <p style="font-size:12px;margin:2px 0">Rent: <strong>KES ${(p.rent_kes || 0).toLocaleString()}</strong></p>
      ${p.bedrooms != null ? `<p style="font-size:12px;margin:2px 0">Bedrooms: ${p.bedrooms}</p>` : ''}
      <p style="font-size:10px;color:#6b7280;margin-top:6px">${exact}</p>
    </div>`;
}

// ── Property cluster layer ──────────────────────────────────────────────────
function PropertyClusterLayer({ properties, onPropertySelect }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!properties?.length) return;

    let layer;
    try {
      layer = L.markerClusterGroup({
        maxClusterRadius:    60,
        spiderfyOnMaxZoom:   true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            className: '',
            html: `<div style="background:rgba(59,130,246,0.85);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${count}</div>`,
            iconSize:   [36, 36],
            iconAnchor: [18, 18]
          });
        }
      });
    } catch (_e) {
      layer = L.layerGroup();
    }

    properties.forEach(prop => {
      const coords = prop.location?.coordinates;
      if (!coords?.length) return;
      const [lng, lat] = coords;
      const status     = getPropertyStatus(prop);
      const marker     = L.marker([lat, lng], { icon: createStatusIcon(status) });
      marker.bindPopup(buildPropertyPopup(prop), { maxWidth: 270 });
      marker.on('click', () => onPropertySelect?.(prop));
      layer.addLayer(marker);
    });

    map.addLayer(layer);
    layerRef.current = layer;
    return () => { map.removeLayer(layer); layerRef.current = null; };
  }, [map, properties, onPropertySelect]);

  return null;
}

// ── Unit GeoJSON layer ──────────────────────────────────────────────────────
function UnitGeoJSONLayer({ geojson, onUnitSelect }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!geojson?.features?.length) return;

    const layer = L.layerGroup();

    geojson.features.forEach(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      const status     = feature.properties.status;
      const exact      = feature.properties.has_exact_location;
      const marker     = L.marker([lat, lng], { icon: createUnitIcon(status, exact) });
      marker.bindPopup(buildUnitPopup(feature), { maxWidth: 240 });
      marker.on('click', () => onUnitSelect?.(feature.properties));
      layer.addLayer(marker);
    });

    map.addLayer(layer);
    layerRef.current = layer;
    return () => { map.removeLayer(layer); layerRef.current = null; };
  }, [map, geojson, onUnitSelect]);

  return null;
}

// ── BuildingPreview3D — Phase 5 photogrammetry mount point ──────────────────
/**
 * Hardware-accelerated 3D container.
 * Phase 5 will inject a WebGL / point-cloud renderer into the `#building-3d-canvas` slot.
 * The component exposes `propertyId` and `selectedUnit` on the DOM element's dataset
 * so external scripts can bootstrap without prop-drilling.
 */
export function BuildingPreview3D({ propertyId, selectedUnit, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.dataset.propertyId   = propertyId  || '';
    el.dataset.selectedUnit = selectedUnit ? JSON.stringify(selectedUnit) : '';
    // Phase 5 hook: dispatch a custom event that photogrammetry scripts listen for
    el.dispatchEvent(new CustomEvent('building3d:mount', {
      bubbles: true,
      detail:  { propertyId, selectedUnit }
    }));
    return () => {
      el.dispatchEvent(new CustomEvent('building3d:unmount', { bubbles: true }));
    };
  }, [propertyId, selectedUnit]);

  return (
    <div
      ref={containerRef}
      id="building-3d-canvas"
      className={className}
      style={{
        perspective:     '1200px',
        transformStyle:  'preserve-3d',
        background:      'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        borderRadius:    '12px',
        overflow:        'hidden',
        position:        'relative',
        minHeight:       '220px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center'
      }}
    >
      {/* Placeholder grid — replaced by Phase 5 WebGL canvas */}
      <svg
        viewBox="0 0 200 140"
        style={{ width: '140px', opacity: 0.18, filter: 'drop-shadow(0 0 8px #3b82f6)' }}
        aria-hidden="true"
      >
        <rect x="30" y="60" width="50" height="70" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <rect x="90" y="40" width="80" height="90" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <line x1="30" y1="60" x2="10" y2="40" stroke="#3b82f6" strokeWidth="1" />
        <line x1="80" y1="60" x2="60" y2="40" stroke="#3b82f6" strokeWidth="1" />
        <line x1="10" y1="40" x2="60" y2="40" stroke="#3b82f6" strokeWidth="1" />
        <line x1="90" y1="40" x2="70" y2="20" stroke="#3b82f6" strokeWidth="1" />
        <line x1="170" y1="40" x2="150" y2="20" stroke="#3b82f6" strokeWidth="1" />
        <line x1="70" y1="20" x2="150" y2="20" stroke="#3b82f6" strokeWidth="1" />
      </svg>

      <div style={{
        position:   'absolute',
        bottom:     '12px',
        left:       '50%',
        transform:  'translateX(-50%)',
        color:      'rgba(148,163,184,0.7)',
        fontSize:   '10px',
        fontFamily: 'monospace',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap'
      }}>
        3D PREVIEW — PHASE 5 HOOK
      </div>

      {selectedUnit && (
        <div style={{
          position:   'absolute',
          top:        '10px',
          right:      '10px',
          background: 'rgba(59,130,246,0.2)',
          border:     '1px solid rgba(59,130,246,0.4)',
          borderRadius: '6px',
          padding:    '4px 8px',
          color:      '#93c5fd',
          fontSize:   '11px',
          fontFamily: 'monospace'
        }}>
          Unit {selectedUnit.unit_number}
        </div>
      )}
    </div>
  );
}

// ── MapWidget (default export) ──────────────────────────────────────────────
/**
 * Props:
 *   properties      — array of property objects from the API
 *   agentLocation   — { lat, lng, accuracy } | null
 *   onPropertySelect — callback(property) when a property marker is clicked
 */
export default function MapWidget({ properties = [], agentLocation = null, onPropertySelect }) {
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeTab,      setActiveTab]      = useState('properties'); // 'properties' | 'units'
  const [selectedProp,   setSelectedProp]   = useState(null);
  const [selectedUnit,   setSelectedUnit]   = useState(null);
  const [unitGeoJSON,    setUnitGeoJSON]    = useState(null);
  const [loadingUnits,   setLoadingUnits]   = useState(false);
  const [unitError,      setUnitError]      = useState(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase();
    return properties.filter(p =>
      p.name?.toLowerCase().includes(q)        ||
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
    return [-4.0435, 39.6682]; // Mombasa CBD
  }, [agentLocation, filtered]);

  const handlePropertySelect = useCallback(async (prop) => {
    setSelectedProp(prop);
    onPropertySelect?.(prop);
    setActiveTab('units');
    setUnitGeoJSON(null);
    setUnitError(null);
    setSelectedUnit(null);
    setLoadingUnits(true);
    try {
      const res = await fetchUnitGeoJSON(prop._id);
      setUnitGeoJSON(res.data);
    } catch (err) {
      setUnitError(err?.error?.message || 'Failed to load unit locations');
    } finally {
      setLoadingUnits(false);
    }
  }, [onPropertySelect]);

  const tabs = [
    { id: 'properties', label: `Properties (${filtered.length})` },
    { id: 'units',      label: selectedProp ? `Units — ${selectedProp.name}` : 'Units' },
    { id: '3d',         label: '3D Preview' }
  ];

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
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, area, Plus Code…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 ml-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Preview Tab */}
      {activeTab === '3d' && (
        <div className="p-4">
          <BuildingPreview3D
            propertyId={selectedProp?._id}
            selectedUnit={selectedUnit}
            className="w-full"
          />
          {selectedUnit && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 grid grid-cols-2 gap-2">
              <span><strong>Unit:</strong> {selectedUnit.unit_number}</span>
              <span><strong>Status:</strong> {selectedUnit.status}</span>
              <span><strong>Rent:</strong> KES {(selectedUnit.rent_kes || 0).toLocaleString()}</span>
              {selectedUnit.bedrooms != null && <span><strong>Beds:</strong> {selectedUnit.bedrooms}</span>}
            </div>
          )}
        </div>
      )}

      {/* Map Tab — Properties or Units */}
      {activeTab !== '3d' && (
        <>
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom={false}
            key={center.join(',')}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Property cluster layer (visible in properties tab) */}
            {activeTab === 'properties' && (
              <PropertyClusterLayer
                properties={filtered}
                onPropertySelect={handlePropertySelect}
              />
            )}

            {/* Unit GeoJSON layer (visible in units tab) */}
            {activeTab === 'units' && unitGeoJSON && (
              <UnitGeoJSONLayer
                geojson={unitGeoJSON}
                onUnitSelect={unit => { setSelectedUnit(unit); setActiveTab('3d'); }}
              />
            )}

            {/* Agent location ring */}
            {agentLocation && (
              <>
                <Circle
                  center={[agentLocation.lat, agentLocation.lng]}
                  radius={agentLocation.accuracy || 30}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1.5 }}
                />
                <Marker
                  position={[agentLocation.lat, agentLocation.lng]}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background:#3b82f6;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px #3b82f6"></div>',
                    iconSize:   [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup><strong>Your Location</strong><br />Accuracy: {agentLocation.accuracy?.toFixed(0)}m</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {/* Units loading / error overlay */}
          {activeTab === 'units' && (loadingUnits || unitError || (!unitGeoJSON && !selectedProp)) && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center pointer-events-none" style={{ top: '96px' }}>
              {loadingUnits && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="60" strokeDashoffset="15" />
                  </svg>
                  Loading unit locations…
                </span>
              )}
              {unitError && <span className="text-sm text-red-500">{unitError}</span>}
              {!loadingUnits && !unitError && !selectedProp && (
                <span className="text-sm text-gray-400">Select a property to view unit locations</span>
              )}
            </div>
          )}

          {/* Unit count badge */}
          {activeTab === 'units' && unitGeoJSON && (
            <div className="px-4 py-1.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700 font-medium">
              {unitGeoJSON.features.length} unit{unitGeoJSON.features.length !== 1 ? 's' : ''} —{' '}
              {unitGeoJSON.features.filter(f => f.properties.has_exact_location).length} with exact GPS.
              Click a unit marker to open 3D preview.
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {activeTab === 'properties' && (
        <div className="px-4 py-2.5 border-t bg-gray-50 flex flex-wrap gap-4">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      )}

      {activeTab === 'units' && (
        <div className="px-4 py-2.5 border-t bg-gray-50 flex flex-wrap gap-4">
          {Object.entries(UNIT_STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: color }} />
              {status.replace('_', ' ')}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
            ◆ exact GPS &nbsp;◇ estimated
          </span>
        </div>
      )}
    </div>
  );
}
