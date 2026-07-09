import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Box, X, Maximize2, Minimize2, Globe } from 'lucide-react';
import { fetchUnitGeoJSON } from '../lib/api';
import { Suspense, lazy } from 'react';

const BuildingPreview3D = lazy(() => import('./BuildingPreview3D'));

function checkDeviceCapabilities() {
  if (typeof window === 'undefined') return false;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    if (['2g', 'slow-2g', '3g'].includes(connection.effectiveType)) return true;
  }
  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (memory !== undefined && memory < 4) return true;
  if (cores !== undefined && cores < 4) return true;
  return false;
}

// Set Mapbox Access Token
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
  // Deterministic GPS fallback using string hash of property ID
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
function MapboxMap({ center, zoom, properties, selectedProperty, unitGeoJSON, activeTab, onPropertySelect, onUnitSelect, agentLocation, isFullscreen, theme, mapStyleMode }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const mapStyle = theme === 'light'
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11';

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapCenter = [center[1], center[0]];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: mapCenter,
      zoom: zoom || 13,
      pitch: 50,
      bearing: -17.6,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      // Add free, high-resolution Esri World Imagery satellite layer
      if (!map.getSource('esri-satellite')) {
        map.addSource('esri-satellite', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        map.addLayer({
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          paint: {
            'raster-opacity': mapStyleMode === 'satellite' ? 1.0 : 0.0
          }
        }, labelLayerId); // insert below labels and street names so they remain visible on top!
      }

      if (!map.getLayer('3d-buildings')) {
        // 3D building extrusions for Mombasa
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': theme === 'light' ? '#6366f1' : '#cabeff',
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14, 0,
                14.5, ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                14, 0,
                14.5, ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 0.5
            }
          },
          labelLayerId
        );
      }

      // Add custom 3D property building extrusions with dynamic heights based on unit count
      if (properties?.length > 0) {
        const propFeatures = properties.map(prop => {
          const coords = getPropertyCoords(prop);
          const unitCount = prop.units?.length || 1;
          const height = Math.max(15, unitCount * 5);
          const occupiedCount = prop.units?.filter(u => u.status === 'occupied').length || 0;
          const ratio = unitCount > 0 ? occupiedCount / unitCount : 0;

          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [coords[0] - 0.00015, coords[1] - 0.00015],
                [coords[0] + 0.00015, coords[1] - 0.00015],
                [coords[0] + 0.00015, coords[1] + 0.00015],
                [coords[0] - 0.00015, coords[1] + 0.00015],
                [coords[0] - 0.00015, coords[1] - 0.00015],
              ]]
            },
            properties: {
              height: height,
              min_height: 0,
              name: prop.name,
              units: unitCount,
              occupancy: ratio,
              color: ratio > 0.8 ? '#22c55e' : ratio > 0.5 ? '#eab308' : '#ef4444'
            }
          };
        });

        if (!map.getSource('property-buildings')) {
          map.addSource('property-buildings', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: propFeatures }
          });

          map.addLayer({
            id: 'property-extrusions',
            type: 'fill-extrusion',
            source: 'property-buildings',
            paint: {
              'fill-extrusion-color': ['get', 'color'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.75
            }
          });
        }
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [theme]);

  // Handle dynamically changing satellite mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('esri-satellite-layer')) {
      map.setPaintProperty(
        'esri-satellite-layer',
        'raster-opacity',
        mapStyleMode === 'satellite' ? 1.0 : 0.0
      );
    }
  }, [mapStyleMode]);

  // Handle center updates
  useEffect(() => {
    if (!mapRef.current) return;
    const mapCenter = [center[1], center[0]];
    mapRef.current.easeTo({ center: mapCenter, duration: 800 });
  }, [center]);

  // Handle markers & layers updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove source & layer if they exist
    if (map.getLayer('boundary-fill')) map.removeLayer('boundary-fill');
    if (map.getLayer('boundary-line')) map.removeLayer('boundary-line');
    if (map.getSource('property-boundary')) map.removeSource('property-boundary');

    if (activeTab === 'properties') {
      properties.forEach((prop) => {
        const coords = getPropertyCoords(prop);

        const el = document.createElement('div');
        el.className = 'custom-marker';
        const occupiedCount = prop.units?.filter((u) => u.status === 'occupied').length || 0;
        const totalUnits = prop.units?.length || 0;
        const ratio = totalUnits > 0 ? occupiedCount / totalUnits : 0;
        let color = '#22c55e';
        if (ratio < 0.5) color = '#ef4444';
        else if (ratio < 0.9) color = '#eab308';

        el.style.cssText = `
          background: ${color};
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 2px ${color}40;
          cursor: pointer;
          transition: transform 0.2s ease;
        `;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.3)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family: 'Inter', sans-serif; padding: 10px; min-width: 210px; color: #1e293b;">
            <p style="font-weight: 700; margin: 0; font-size: 14px;">${prop.name}</p>
            <p style="font-size: 11px; color: #64748b; font-family: 'Fira Code', monospace; margin: 3px 0;">${prop.property_code}</p>
            <p style="font-size: 12px; margin: 4px 0 0 0;">📍 ${prop.address?.area || 'Mombasa'}</p>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <span style="font-size: 11px; background: ${color}15; color: ${color}; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${totalUnits} units</span>
              <span style="font-size: 11px; background: #6366f115; color: #6366f1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${occupiedCount} occupied</span>
            </div>
            <button id="mapbox-btn-${prop._id}" style="margin-top: 10px; width: 100%; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 8px; padding: 7px 10px; font-size: 11px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
              View Units & 3D Model
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

      // Fit map to show all properties
      if (properties.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        properties.forEach(prop => {
          const c = getPropertyCoords(prop);
          bounds.extend(c);
        });
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1200 });
      }
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
          paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 }
        });
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'property-boundary',
          paint: { 'line-color': '#10b981', 'line-width': 2 }
        });
      }

      const pCoords = getPropertyCoords(selectedProperty);
      if (pCoords) {
        const el = document.createElement('div');
        el.style.cssText = `
          background: #8b5cf6; width: 18px; height: 18px;
          border-radius: 50%; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(139,92,246,0.4); cursor: pointer;
        `;
        const marker = new mapboxgl.Marker(el).setLngLat(pCoords).addTo(map);
        markersRef.current.push(marker);
      }

      if (unitGeoJSON?.features) {
        unitGeoJSON.features.forEach((feature) => {
          const coords = feature.geometry.coordinates;
          const unit = feature.properties;

          const el = document.createElement('div');
          const unitColor = unit.status === 'occupied' ? '#eab308' : '#22c55e';
          el.style.cssText = `
            background: ${unitColor}; width: 10px; height: 10px;
            border-radius: 50%; border: 2px solid white;
            cursor: pointer; transition: transform 0.2s;
          `;
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)'; });
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

          const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(`
            <div style="font-family: 'Inter', sans-serif; padding: 8px; color: #1e293b;">
              <p style="font-weight: 700; margin: 0; font-size: 12px;">Unit ${unit.unit_number}</p>
              <p style="font-size: 11px; margin: 2px 0;">Status: ${unit.status}</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0;">KES ${unit.rent_kes?.toLocaleString()}/mo</p>
              <button id="mapbox-unit-${unit.unit_number}" style="margin-top: 6px; width: 100%; border: none; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border-radius: 6px; padding: 5px 8px; font-size: 10px; font-weight: 600; cursor: pointer;">
                Open 3D Model
              </button>
            </div>
          `);

          const marker = new mapboxgl.Marker(el).setLngLat(coords).setPopup(popup).addTo(map);

          popup.on('open', () => {
            const btn = document.getElementById(`mapbox-unit-${unit.unit_number}`);
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
      el.style.cssText = `
        background: #3b82f6; width: 14px; height: 14px;
        border-radius: 50%; border: 3px solid white;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
      `;
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

// ── BuildingPreviewLite (2D units grid fallback) ───────────────────────────
export function BuildingPreviewLite({ property, selectedUnit, onClose, onUnitSelect, theme = 'dark' }) {
  const isLight = theme === 'light';
  const units = property?.units || [];
  return (
    <div className={`relative rounded-xl border p-4 ${
      isLight ? 'bg-surface border-border' : 'bg-surface border-border'
    }`} style={{ minHeight: '400px' }}>
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div>
          <h3 className="font-bold text-sm text-foreground">{property?.name}</h3>
          <p className="text-xs text-muted font-mono">{property?.property_code}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 bg-surface-bright hover:bg-background text-muted hover:text-foreground rounded-lg border border-border transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-xs text-muted mb-4 font-medium flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Lite View (2D Units List)
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
        {units.map((unit) => {
          const status = getUnitStatus(unit);
          const color = statusColors[status] || '#6b7280';
          const isSelected = selectedUnit?._id === unit._id;
          return (
            <button
              key={unit._id}
              onClick={() => onUnitSelect(unit)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-24 cursor-pointer hover:scale-[1.02] ${
                isSelected 
                  ? 'border-blue-500 bg-blue-550/10 dark:bg-blue-900/20' 
                  : 'border-border bg-surface-bright hover:bg-background'
              }`}
            >
              <div>
                <p className="font-bold text-xs text-foreground">Unit {unit.unit_number}</p>
                <p className="text-[10px] text-muted capitalize mt-0.5">{status.replace('_', ' ')}</p>
              </div>
              <p className="text-xs font-semibold text-foreground mt-2 font-mono">KES {unit.rent_kes?.toLocaleString()}</p>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: color }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MapWidget Main Component ────────────────────────────────────────────────
export default function MapWidget({ properties = [], agentLocation = null, onPropertySelect, isAdmin = false, theme = 'dark' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState(properties);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [unitGeoJSON, setUnitGeoJSON] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeTab, setActiveTab] = useState('properties');
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState('satellite');
  const [isLiteView, setIsLiteView] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('mutune_lite_view');
    if (stored !== null) return stored === 'true';
    return checkDeviceCapabilities();
  });

  const toggleLiteView = () => {
    const newVal = !isLiteView;
    setIsLiteView(newVal);
    localStorage.setItem('mutune_lite_view', String(newVal));
  };

  const isLight = theme === 'light';

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
    { id: 'properties', label: `Properties (${filtered.length})`, icon: MapPin },
    { id: 'units', label: selectedProperty ? `Units — ${selectedProperty.name}` : 'Units', icon: Search },
    { id: '3d', label: '3D Building', icon: Box }
  ];

  const mapContent = (
    <div className={`flex flex-col overflow-hidden transition-all duration-300 ${
      isFullscreen
        ? 'fixed inset-6 z-[9999] rounded-2xl shadow-2xl bg-surface border border-border'
        : 'rounded-xl border shadow-sm bg-surface border-border'
    }`}>
      {/* Header and Search */}
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface-bright">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-foreground">Mombasa Property Map</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Plus Code or property..."
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all w-48"
            />
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-0.5 bg-background rounded-lg border border-border">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={tab.id === '3d' && !selectedProperty}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-muted hover:text-foreground hover:bg-surface-bright disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={toggleLiteView}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-bright transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title={isLiteView ? 'Switch to 3D View' : 'Switch to Lite View'}
          >
            <Box size={13} />
            <span>{isLiteView ? '3D View' : 'Lite Mode'}</span>
          </button>

          <button
            onClick={() => setMapStyleMode(prev => prev === 'vector' ? 'satellite' : 'vector')}
            className={`px-2.5 py-1.5 rounded-lg border border-border transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              mapStyleMode === 'satellite' ? 'bg-brand-500 text-white border-transparent' : 'bg-surface text-muted hover:text-foreground hover:bg-surface-bright'
            }`}
            title="Toggle Satellite / Vector style"
          >
            <Globe size={13} />
            <span>{mapStyleMode === 'satellite' ? 'Satellite View' : 'Vector View'}</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-bright transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
            theme={theme}
            mapStyleMode={mapStyleMode}
          />

          {loadingUnits && (
            <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm flex items-center justify-center z-[1000]">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                Loading units...
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3D Preview Canvas / Lite Fallback */}
      {activeTab === '3d' && (
        <div className="p-4 bg-background flex-1">
          {isLiteView ? (
            <BuildingPreviewLite
              property={selectedProperty}
              selectedUnit={selectedUnit}
              onClose={() => setActiveTab('units')}
              onUnitSelect={setSelectedUnit}
              theme={theme}
            />
          ) : (
            <Suspense fallback={
              <div className="h-80 flex flex-col items-center justify-center rounded-xl border bg-surface border-border text-muted animate-pulse">
                <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-2" />
                Loading interactive 3D scene...
              </div>
            }>
              <BuildingPreview3D
                property={selectedProperty}
                selectedUnit={selectedUnit}
                onClose={() => setActiveTab('units')}
                onUnitSelect={setSelectedUnit}
                theme={theme}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Legend Footer */}
      <div className="px-4 py-2 border-t border-border flex gap-4 text-xs flex-wrap items-center bg-surface-bright">
        {Object.entries(statusColors).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {status}
          </span>
        ))}
        <span className="text-muted text-xs ml-auto">
          {activeTab === 'properties' ? 'Click a property marker to view details' : 'Click a unit to open 3D preview'}
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
