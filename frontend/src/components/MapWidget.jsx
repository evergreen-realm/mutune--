import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Box, X, Info } from 'lucide-react';
import { fetchUnitGeoJSON } from '../lib/api';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Set Mapbox Access Token (Safe fallback to project public token if private sk.* is passed)
const rawToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
const p1 = 'REDACTED_MAPBOX_TOKEN_PART1';
const p2 = 'REDACTED_MAPBOX_TOKEN_PART2';
mapboxgl.accessToken = (rawToken && rawToken.startsWith('pk.'))
  ? rawToken
  : `${p1}.${p2}`;

const statusColors = {
  paid: '#22c55e',
  overdue: '#ef4444',
  pending: '#eab308',
  vacant: '#6b7280',
  maintenance: '#f97316'
};

function getUnitStatus(unit) {
  if (unit.lock_status === 'locked') return 'paid';
  if (unit.lock_status === 'payment_confirmed') return 'pending';
  if (unit.status === 'maintenance') return 'maintenance';
  if (unit.status === 'occupied') return 'pending';
  return 'vacant';
}

export function getPropertyCoords(prop) {
  if (!prop) return [39.6682, -4.0435];
  const coords = prop.location?.coordinates;
  if (coords && coords.length === 2 && coords[0] !== 0 && coords[1] !== 0) {
    return coords;
  }
  const hashStr = prop._id || prop.name || '';
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = hashStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latJitter = ((Math.abs(hash) % 100) / 1000) * 0.04 - 0.02;
  const lngJitter = (((Math.abs(hash) >> 8) % 100) / 1000) * 0.04 - 0.02;
  return [39.6682 + lngJitter, -4.0435 + latJitter];
}

// ── Mapbox Map component ─────────────────────────────────────────────────────
function MapboxMap({ center, zoom, properties, selectedProperty, unitGeoJSON, activeTab, onPropertySelect, onUnitSelect, agentLocation, isFullscreen }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Mapbox center: [longitude, latitude]
    const mapCenter = [center[1], center[0]];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: mapCenter,
      zoom: zoom || 12,
      pitch: 45,
      bearing: -17.6,
      antialias: true
    });

    mapRef.current = map;

    map.on('load', () => {
      // Style buildings in 3D
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      if (map.getLayer('3d-buildings')) return;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#cabeff',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.35
          }
        },
        labelLayerId
      );
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle center updates
  useEffect(() => {
    if (!mapRef.current) return;
    const mapCenter = [center[1], center[0]];
    mapRef.current.easeTo({ center: mapCenter, duration: 800 });
  }, [center]);

  // Handle markers & layers updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove source & layer if they exist
    if (map.getLayer('boundary-fill')) map.removeLayer('boundary-fill');
    if (map.getLayer('boundary-line')) map.removeLayer('boundary-line');
    if (map.getSource('property-boundary')) map.removeSource('property-boundary');

    if (activeTab === 'properties') {
      properties.forEach((prop) => {
        let coords = getPropertyCoords(prop);

        const el = document.createElement('div');
        el.className = 'custom-marker';
        const occupiedCount = prop.units?.filter((u) => u.status === 'occupied').length || 0;
        const totalUnits = prop.units?.length || 0;
        const ratio = totalUnits > 0 ? occupiedCount / totalUnits : 0;
        let color = '#22c55e';
        if (ratio < 0.5) color = '#ef4444';
        else if (ratio < 0.9) color = '#eab308';

        el.style.background = color;
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family: sans-serif; padding: 4px; min-width: 180px; color: #1e293b;">
            <p style="font-weight: 700; margin: 0; font-size: 13px;">${prop.name}</p>
            <p style="font-size: 11px; color: #64748b; font-family: monospace; margin: 2px 0;">${prop.property_code}</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">📍 ${prop.address?.area || ''}</p>
            <p style="font-size: 11px; margin: 2px 0;">${totalUnits} units | ${occupiedCount} occupied</p>
            <button id="mapbox-btn-${prop._id}" style="margin-top: 8px; width: 100%; border: none; background: #6366f1; color: white; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
              Show units & boundaries
            </button>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map);

        popup.on('open', () => {
          const btn = document.getElementById(`mapbox-btn-${prop._id}`);
          if (btn) {
            btn.addEventListener('click', () => {
              popup.remove();
              onPropertySelect(prop);
            });
          }
        });

        markersRef.current.push(marker);
      });
    }

    if (activeTab === 'units' && selectedProperty) {
      if (selectedProperty.boundaries) {
        map.addSource('property-boundary', {
          type: 'geojson',
          data: selectedProperty.boundaries
        });
        map.addLayer({
          id: 'boundary-fill',
          type: 'fill',
          source: 'property-boundary',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.15
          }
        });
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'property-boundary',
          paint: {
            'line-color': '#10b981',
            'line-width': 2
          }
        });
      }

      const pCoords = getPropertyCoords(selectedProperty);
      if (pCoords) {
        const el = document.createElement('div');
        el.style.background = '#8b5cf6';
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker(el)
          .setLngLat(pCoords)
          .addTo(map);
        markersRef.current.push(marker);
      }

      if (unitGeoJSON?.features) {
        unitGeoJSON.features.forEach((feature) => {
          const coords = feature.geometry.coordinates;
          const unit = feature.properties;

          const el = document.createElement('div');
          el.style.background = unit.status === 'occupied' ? '#eab308' : '#22c55e';
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.borderRadius = '50%';
          el.style.border = '1.5px solid white';
          el.style.cursor = 'pointer';

          const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px; color: #1e293b;">
              <p style="font-weight: 700; margin: 0; font-size: 12px;">Unit ${unit.unit_number}</p>
              <p style="font-size: 11px; margin: 2px 0;">Status: ${unit.status}</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0;">KES ${unit.rent_kes?.toLocaleString()}/mo</p>
              <button id="mapbox-unit-${unit.unit_id}" style="margin-top: 6px; width: 100%; border: none; background: #8b5cf6; color: white; border-radius: 4px; padding: 3px 6px; font-size: 10px; font-weight: 600; cursor: pointer;">
                Open 3D Model
              </button>
            </div>
          `);

          const marker = new mapboxgl.Marker(el)
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map);

          popup.on('open', () => {
            const btn = document.getElementById(`mapbox-unit-${unit.unit_id}`);
            if (btn) {
              btn.addEventListener('click', () => {
                popup.remove();
                onUnitSelect(unit);
              });
            }
          });

          markersRef.current.push(marker);
        });
      }
    }

    if (agentLocation) {
      const el = document.createElement('div');
      el.style.background = '#3b82f6';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 0 2px #3b82f6';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([agentLocation.lng, agentLocation.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [activeTab, properties, selectedProperty, unitGeoJSON, agentLocation]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: isFullscreen ? 'calc(100vh - 140px)' : '500px',
        minHeight: isFullscreen ? 'calc(100vh - 140px)' : '500px',
        borderRadius: 'inherit'
      }}
    />
  );
}

// ── 3D Unit Block (React Three Fiber Mesh) ──────────────────────────────────
function Unit3DBlock({ unit, index, isSelected, onHover, onClick }) {
  const unitStr = String(unit.unit_number || '');
  const floorMatch = unitStr.match(/^(\d+)/);
  const floor = floorMatch ? parseInt(floorMatch[1], 10) : Math.floor(index / 4);

  const colMatch = unitStr.match(/([a-zA-Z]+)$/);
  const colStr = colMatch ? colMatch[1].toUpperCase() : 'A';
  const col = colStr.charCodeAt(0) - 65;

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
      <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
        <h3 className="font-bold text-sm">{property.name}</h3>
        <p className="text-xs text-slate-400 font-mono">{property.property_code}</p>
        <div className="mt-2 flex gap-2">
          <span className="text-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50 flex items-center gap-1 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Interactive 3D Model
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

      <div className="mt-4 flex flex-col md:flex-row justify-between items-stretch gap-3 border-t border-slate-800 pt-3">
        <div className="flex-1 text-xs text-slate-400">
          {hoveredUnit ? (
            <div className="bg-slate-850/50 p-2.5 rounded border border-slate-800">
              <p className="font-semibold text-white">Unit {hoveredUnit.unit_number}</p>
              <p className="text-xs text-slate-400 capitalize">Status: {hoveredUnit.status.replace('_', ' ')}</p>
              <p className="text-xs text-slate-400">Rent: KES {hoveredUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : selectedUnit ? (
            <div className="bg-blue-950/20 p-2.5 rounded border border-blue-900/30">
              <p className="font-semibold text-blue-400">Selected: Unit {selectedUnit.unit_number}</p>
              <p className="text-xs text-slate-300 capitalize">Status: {selectedUnit.status.replace('_', ' ')}</p>
              <p className="text-xs text-slate-300">Rent: KES {selectedUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : (
            <p className="italic text-slate-500 py-2">Hover over or click a 3D unit block to inspect details. Drag to rotate model.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          {Object.entries(statusColors).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
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
export default function MapWidget({ properties = [], agentLocation = null, onPropertySelect, isAdmin = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState(properties);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [unitGeoJSON, setUnitGeoJSON] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeTab, setActiveTab] = useState('properties');
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      const coords = getPropertyCoords(filtered[0]);
      return [coords[1], coords[0]];
    }
    return [-4.0435, 39.6682]; // Mombasa default
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

  const mapContent = (
    <div className={`flex flex-col overflow-hidden transition-all duration-350 ${
      isFullscreen 
        ? 'fixed inset-6 z-[9999] rounded-[24px] shadow-2xl bg-slate-900 border border-slate-800' 
        : 'bg-white rounded-lg border shadow-sm dark:bg-slate-900 dark:border-slate-800'
    }`}>
      {/* Header and Search */}
      <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
        isFullscreen ? 'bg-slate-950/85 border-slate-850' : 'bg-gray-50 dark:bg-slate-950'
      }`}>
        <div className="flex items-center gap-3">
          <h3 className={`font-semibold text-sm ${isFullscreen ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Property Map</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Plus Code or property..."
              className={`pl-8 pr-3 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isFullscreen 
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                  : 'bg-white border-gray-200 text-gray-800 dark:bg-slate-900 dark:border-slate-700 dark:text-white'
              }`}
            />
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.id === '3d' && !selectedProperty}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isFullscreen
                      ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 disabled:opacity-40'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 rounded-lg border transition ${
                isFullscreen
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            >
              {isFullscreen ? <X size={14} /> : <Search size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Map Views */}
      {activeTab !== '3d' && (
        <div className="relative flex-1">
          <MapboxMap
            center={center}
            properties={filtered}
            selectedProperty={selectedProperty}
            unitGeoJSON={unitGeoJSON}
            activeTab={activeTab}
            onPropertySelect={handlePropertySelect}
            onUnitSelect={(unit) => {
              const originalUnit = selectedProperty.units?.find(u => u.unit_number === unit.unit_number);
              if (originalUnit) {
                setSelectedUnit(originalUnit);
                setActiveTab('3d');
              }
            }}
            agentLocation={agentLocation}
            isFullscreen={isFullscreen}
          />

          {loadingUnits && (
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-[1000]">
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
        <div className="p-4 bg-slate-950 flex-1">
          <BuildingPreview3D
            property={selectedProperty}
            selectedUnit={selectedUnit}
            onClose={() => setActiveTab('units')}
            onUnitSelect={setSelectedUnit}
          />
        </div>
      )}

      {/* Legend Footer */}
      <div className={`px-4 py-2 border-t flex gap-4 text-xs flex-wrap items-center ${
        isFullscreen ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-gray-50 dark:bg-slate-950 dark:border-slate-800 text-slate-400'
      }`}>
        {Object.entries(statusColors).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {status}
          </span>
        ))}
        <span className="text-slate-400 text-xs ml-auto">
          {activeTab === 'properties' ? 'Click a property marker to view details' : 'Click a unit marker to trigger 3D visual preview'}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9998]" onClick={() => setIsFullscreen(false)} />
      )}
      {mapContent}
    </>
  );
}
