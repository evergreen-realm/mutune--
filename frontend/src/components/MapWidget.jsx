import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Search, MapPin, Box, X, Info } from 'lucide-react';
import { fetchUnitGeoJSON } from '../lib/api';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const statusColors = {
  paid: '#22c55e',
  overdue: '#ef4444',
  pending: '#eab308',
  vacant: '#6b7280',
  maintenance: '#f97316'
};

function createStatusIcon(status, isUnit = false) {
  const size = isUnit ? 10 : 14;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${statusColors[status] || statusColors.vacant};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function getUnitStatus(unit) {
  if (unit.lock_status === 'locked') return 'paid';
  if (unit.lock_status === 'payment_confirmed') return 'pending';
  if (unit.status === 'maintenance') return 'maintenance';
  if (unit.status === 'occupied') return 'pending';
  return 'vacant';
}

// ── Property Cluster Layer (Native Leaflet Cluster) ─────────────────────────
function PropertyClusterLayer({ properties, onPropertySelect }) {
  const map = useMap();
  const clusterRef = useRef(null);

  useEffect(() => {
    if (!properties?.length) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    properties.forEach(prop => {
      const coords = prop.location?.coordinates;
      if (!coords?.length) return;
      const [lng, lat] = coords;

      const marker = L.marker([lat, lng], { icon: createStatusIcon('vacant', false) });

      // Bind detailed popup content
      const occupiedCount = prop.units?.filter(u => u.status === 'occupied').length || 0;
      const totalUnits = prop.units?.length || 0;
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1 min-w-[220px] font-sans';
      popupDiv.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-sm">${prop.name}</p>
            <p class="text-xs text-gray-500 font-mono">${prop.property_code}</p>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">📍 ${prop.address?.area || ''}</p>
        <p class="text-xs mt-1">${totalUnits} units | ${occupiedCount} occupied</p>
        ${prop.address?.plus_code ? `<p class="text-xs text-brand-600 mt-1 font-semibold">Plus Code: ${prop.address.plus_code}</p>` : ''}
        <button id="btn-show-units-${prop._id}" class="mt-2 text-xs text-blue-600 font-medium hover:underline block">
          Show units & boundaries
        </button>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-show-units-${prop._id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            onPropertySelect(prop);
          });
        }
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
    };
  }, [map, properties, onPropertySelect]);

  return null;
}

// ── 3D Unit Block (React Three Fiber Mesh) ──────────────────────────────────
function Unit3DBlock({ unit, index, isSelected, onHover, onClick }) {
  const unitStr = String(unit.unit_number || '');
  const floorMatch = unitStr.match(/^(\d+)/);
  const floor = floorMatch ? parseInt(floorMatch[1], 10) : Math.floor(index / 4);

  const colMatch = unitStr.match(/([a-zA-Z]+)$/);
  const colStr = colMatch ? colMatch[1].toUpperCase() : 'A';
  const col = colStr.charCodeAt(0) - 65; // A=0, B=1, C=2...

  const x = col * 1.6 - 0.8;
  const y = floor * 1.2 + 0.6;
  const z = 0;

  const status = getUnitStatus(unit);
  const color = statusColors[status] || '#6b7280';

  const [hovered, setHovered] = useState(false);

  const scale = isSelected ? [1.1, 1.1, 1.1] : hovered ? [1.05, 1.05, 1.05] : [1, 1, 1];
  const emissive = isSelected ? '#ffffff' : hovered ? '#475569' : '#000000';
  const emissiveIntensity = isSelected ? 0.35 : hovered ? 0.2 : 0;

  return (
    <mesh
      position={[x, y, z]}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(unit);
      }}
      onPointerOut={(e) => {
        setHovered(false);
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(unit);
      }}
    >
      <boxGeometry args={[1.3, 1.0, 1.3]} />
      <meshStandardMaterial
        color={color}
        roughness={0.15}
        metalness={0.2}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

// ── BuildingPreview3D (Phase 5 complete R3F canvas) ────────────────────────
export function BuildingPreview3D({ property, selectedUnit, onClose, onUnitSelect }) {
  const [hoveredUnit, setHoveredUnit] = useState(null);

  if (!property) {
    return (
      <div className="h-80 flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
        <Box size={32} className="mb-2 text-slate-600 animate-pulse" />
        <p className="text-xs">No property selected for 3D Preview</p>
      </div>
    );
  }

  const units = property.units || [];

  return (
    <div className="relative bg-slate-900 rounded-xl border border-slate-850 p-4 overflow-hidden" style={{ minHeight: '400px' }}>
      {/* 3D Header Info */}
      <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
        <h3 className="font-bold text-sm">{property.name}</h3>
        <p className="text-[10px] text-slate-400 font-mono">{property.property_code}</p>
        <div className="mt-2 flex gap-2">
          <span className="text-[9px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50 flex items-center gap-1 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Interactive 3D Model
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={onClose}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* R3F WebGL Canvas */}
      <div className="w-full h-80 bg-slate-950 rounded-lg overflow-hidden border border-slate-850 mt-10">
        <Canvas camera={{ position: [5, 4, 8], fov: 45 }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <directionalLight position={[-5, 8, -5]} intensity={0.6} />

          <group position={[0, -1, 0]}>
            {units.map((unit, idx) => (
              <Unit3DBlock
                key={unit._id || idx}
                unit={unit}
                index={idx}
                isSelected={selectedUnit?._id === unit._id}
                onHover={setHoveredUnit}
                onClick={onUnitSelect}
              />
            ))}

            <gridHelper args={[15, 15, '#3b82f6', '#334155']} position={[0, 0.01, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[15, 15]} />
              <meshStandardMaterial color="#0b0f19" roughness={0.9} />
            </mesh>
          </group>

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={3}
            maxDistance={20}
          />
        </Canvas>
      </div>

      {/* Detail info box */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-stretch gap-3 border-t border-slate-800 pt-3">
        <div className="flex-1 text-xs text-slate-400">
          {hoveredUnit ? (
            <div className="bg-slate-850/50 p-2.5 rounded border border-slate-800">
              <p className="font-semibold text-white">Unit {hoveredUnit.unit_number}</p>
              <p className="text-[10px] text-slate-400 capitalize">Status: {hoveredUnit.status.replace('_', ' ')}</p>
              <p className="text-[10px] text-slate-400">Rent: KES {hoveredUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : selectedUnit ? (
            <div className="bg-blue-950/20 p-2.5 rounded border border-blue-900/30">
              <p className="font-semibold text-blue-400">Selected: Unit {selectedUnit.unit_number}</p>
              <p className="text-[10px] text-slate-300 capitalize">Status: {selectedUnit.status.replace('_', ' ')}</p>
              <p className="text-[10px] text-slate-300">Rent: KES {selectedUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : (
            <p className="italic text-slate-500 py-2">Hover over or click a 3D unit block to inspect details. Drag to rotate model.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          {Object.entries(statusColors).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MapWidget Main Component ────────────────────────────────────────────────
export default function MapWidget({ properties = [], agentLocation = null, onPropertySelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState(properties);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [unitGeoJSON, setUnitGeoJSON] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeTab, setActiveTab] = useState('properties'); // 'properties' | 'units' | '3d'
  const [loadingUnits, setLoadingUnits] = useState(false);

  useEffect(() => {
    if (!searchQuery) { setFiltered(properties); return; }
    const q = searchQuery.toLowerCase();
    setFiltered(properties.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.property_code?.toLowerCase().includes(q) ||
      p.address?.area?.toLowerCase().includes(q) ||
      p.address?.plus_code?.toLowerCase().includes(q)
    ));
  }, [searchQuery, properties]);

  const center = useMemo(() => {
    if (agentLocation) return [agentLocation.lat, agentLocation.lng];
    if (filtered?.length) {
      const coords = filtered[0].location?.coordinates;
      if (coords?.length === 2) return [coords[1], coords[0]];
    }
    return [-4.0435, 39.6682]; // Mombasa
  }, [agentLocation, filtered]);

  const handlePropertySelect = useCallback(async (prop) => {
    setSelectedProperty(prop);
    setSelectedUnit(null);
    onPropertySelect?.(prop);
    setActiveTab('units');
    setLoadingUnits(true);
    try {
      const res = await fetchUnitGeoJSON(prop._id);
      setUnitGeoJSON(res);
    } catch (err) {
      console.error('Failed to load unit GeoJSON', err);
    } finally {
      setLoadingUnits(false);
    }
  }, [onPropertySelect]);

  const tabs = [
    { id: 'properties', label: `Properties (${filtered.length})` },
    { id: 'units', label: selectedProperty ? `Units — ${selectedProperty.name}` : 'Units' },
    { id: '3d', label: '3D Building Preview' }
  ];

  return (
    <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
      {/* Header and Search */}
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 text-sm">Property Map</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Plus Code or property..."
              className="pl-8 pr-3 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id === '3d' && !selectedProperty}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Views */}
      {activeTab !== '3d' && (
        <div className="relative">
          <MapContainer center={center} zoom={13} style={{ height: '500px', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {activeTab === 'properties' && (
              <PropertyClusterLayer
                properties={filtered}
                onPropertySelect={handlePropertySelect}
              />
            )}

            {activeTab === 'units' && selectedProperty && (
              <>
                {/* Complex boundary polygon */}
                {selectedProperty.boundaries?.coordinates && (
                  <Polygon
                    positions={selectedProperty.boundaries.coordinates[0].map(c => [c[1], c[0]])}
                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, weight: 2 }}
                  />
                )}

                {/* Property marker */}
                {selectedProperty.location?.coordinates && (
                  <Marker
                    position={[selectedProperty.location.coordinates[1], selectedProperty.location.coordinates[0]]}
                    icon={createStatusIcon('vacant', false)}
                  >
                    <Popup>
                      <div className="p-1">
                        <p className="font-semibold text-sm">{selectedProperty.name}</p>
                        <p className="text-xs text-gray-500">{selectedProperty.property_code}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Unit markers */}
                {unitGeoJSON?.features?.map((feature, idx) => {
                  const [lng, lat] = feature.geometry.coordinates;
                  const unit = feature.properties;

                  return (
                    <Marker
                      key={unit.unit_id || idx}
                      position={[lat, lng]}
                      icon={createStatusIcon(unit.status === 'occupied' ? 'pending' : 'vacant', true)}
                      eventHandlers={{
                        click: () => {
                          const originalUnit = selectedProperty.units?.find(u => u.unit_number === unit.unit_number);
                          if (originalUnit) {
                            setSelectedUnit(originalUnit);
                            setActiveTab('3d');
                          }
                        }
                      }}
                    >
                      <Popup>
                        <div className="p-1 font-sans">
                          <p className="font-semibold text-sm">Unit {unit.unit_number}</p>
                          <p className="text-xs capitalize">{unit.status} | {unit.lock_status?.replace('_', ' ')}</p>
                          <p className="text-xs text-gray-500">KES {unit.rent_kes?.toLocaleString()}/mo</p>
                          <span className="text-[10px] text-blue-600 font-semibold block mt-1">Click to open 3D preview</span>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </>
            )}

            {/* Agent Location */}
            {agentLocation && (
              <>
                <Circle
                  center={[agentLocation.lat, agentLocation.lng]}
                  radius={agentLocation.accuracy || 50}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }}
                />
                <Marker
                  position={[agentLocation.lat, agentLocation.lng]}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background:#3b82f6;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px #3b82f6"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                />
              </>
            )}
          </MapContainer>

          {loadingUnits && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-[1000]">
              <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading units...
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3D Preview Canvas */}
      {activeTab === '3d' && (
        <div className="p-4">
          <BuildingPreview3D
            property={selectedProperty}
            selectedUnit={selectedUnit}
            onClose={() => setActiveTab('units')}
            onUnitSelect={setSelectedUnit}
          />
        </div>
      )}

      {/* Legend Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 flex gap-4 text-xs flex-wrap items-center">
        {Object.entries(statusColors).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {status}
          </span>
        ))}
        <span className="text-gray-400 text-[10px] ml-auto">
          {activeTab === 'properties' ? 'Click show units on property popup to view details' : 'Click a unit marker to trigger 3D visual preview'}
        </span>
      </div>
    </div>
  );
}
