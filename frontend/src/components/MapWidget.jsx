import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Box, X, Maximize2, Minimize2, Globe } from 'lucide-react';
import { fetchUnitGeoJSON } from '../lib/api';
import { Suspense, lazy } from 'react';
import * as THREE from 'three';

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

function getOccupancyColor(property) {
  const occupiedCount = property.units?.filter((u) => u.status === 'occupied').length || 0;
  const totalUnits = property.units?.length || 0;
  const ratio = totalUnits > 0 ? occupiedCount / totalUnits : 0;
  if (ratio > 0.8) return 0x22c55e; // emerald
  if (ratio > 0.5) return 0xeab308; // yellow
  return 0xef4444; // red
}

function createBuildingModel(property) {
  const group = new THREE.Group();
  const floors = property.units?.length || 6;
  const height = floors * 0.5;
  const width = 2.0;
  const depth = 2.0;
  
  // Main body with color based on occupancy
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: getOccupancyColor(property),
    roughness: 0.7,
    metalness: 0.1
  });
  const body = new THREE.Mesh(geometry, material);
  body.position.y = height / 2;
  group.add(body);
  
  // Windows (grid of small boxes on each face)
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    emissive: 0x4488ff,
    emissiveIntensity: 0.3
  });
  
  const windowGeo = new THREE.BoxGeometry(0.15, 0.15, 0.02);

  for (let f = 0; f < floors; f++) {
    const y = (f * 0.5) + 0.25;
    // Front face
    for (let x = -0.6; x <= 0.6; x += 0.6) {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(x, y, (depth / 2) + 0.01);
      group.add(win);
    }
    // Back face
    for (let x = -0.6; x <= 0.6; x += 0.6) {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(x, y, -(depth / 2) - 0.01);
      group.add(win);
    }
    // Right face
    for (let z = -0.6; z <= 0.6; z += 0.6) {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.rotation.y = Math.PI / 2;
      win.position.set((width / 2) + 0.01, y, z);
      group.add(win);
    }
    // Left face
    for (let z = -0.6; z <= 0.6; z += 0.6) {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.rotation.y = Math.PI / 2;
      win.position.set(-(width / 2) - 0.01, y, z);
      group.add(win);
    }
  }
  
  // Roof
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9
  });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.05, 0.05, depth * 1.05),
    roofMat
  );
  roof.position.y = height + 0.025;
  group.add(roof);
  
  return group;
}

function renderMini3DScene(container, property) {
  container.innerHTML = '';
  
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 140;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(6, 4.5, 6);
  camera.lookAt(0, (property.units?.length || 6) * 0.25, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  const building = createBuildingModel(property);
  building.scale.set(0.85, 0.85, 0.85);
  scene.add(building);

  let animationFrameId;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    building.rotation.y += 0.015;
    renderer.render(scene, camera);
  };
  animate();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Mapbox Map component ─────────────────────────────────────────────────────
function MapboxMap({ center, zoom, properties, selectedProperty, unitGeoJSON, activeTab, onPropertySelect, onUnitSelect, agentLocation, isFullscreen, theme, mapStyleMode }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const customLayerRef = useRef(null);

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

  // Fly to selected property in satellite mode when 3D tab is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedProperty || activeTab !== '3d') return;
    const coords = getPropertyCoords(selectedProperty);
    const doFly = () => {
      map.flyTo({
        center: [coords[0], coords[1]],
        zoom: 18.5,
        pitch: 62,
        bearing: 25,
        duration: 2200,
        essential: true
      });
    };
    if (map.isStyleLoaded()) doFly();
    else map.once('load', doFly);
  }, [activeTab, selectedProperty]);

  // Inject CSS styles for transparent markers and custom 3D popups on mount
  useEffect(() => {
    const id = 'mapbox-cube-marker-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = `
        .cube-marker {
          width: 32px;
          height: 64px;
          cursor: pointer;
          background: transparent;
        }
        
        .property-popup-3d .mapboxgl-popup-content {
          padding: 0 !important;
          border-radius: 16px;
          overflow: hidden;
          background: transparent !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.08);
        }
        
        .popup-3d-container {
          background: #0f172a;
          color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          width: 300px;
          font-family: system-ui, sans-serif;
        }

        .popup-3d-container.dark {
          background: #0f172a;
          color: #ffffff;
        }
        
        .popup-3d-container.light {
          background: #ffffff;
          color: #0f172a;
        }

        .popup-3d-preview {
          height: 140px;
          background: #0a0e1a;
          position: relative;
          width: 100%;
        }
        
        .popup-3d-info {
          padding: 14px;
        }

        .popup-3d-info h4 {
          font-weight: 800;
          font-size: 14px;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .popup-3d-info p {
          font-size: 11px;
          color: #94a3b8;
          margin: 0 0 12px 0;
        }

        .popup-3d-info button {
          width: 100%;
          border: 0;
          background: #2563eb;
          color: #ffffff;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: background 0.2s;
        }

        .popup-3d-info button:hover {
          background: #1d4ed8;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Handle markers & layers updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove custom 3D WebGL layer if it exists
    const customLayerId = '3d-custom-buildings-layer';
    if (map.getLayer(customLayerId)) {
      map.removeLayer(customLayerId);
    }
    customLayerRef.current = null;

    // Remove boundary layers if they exist
    if (map.getLayer('boundary-fill')) map.removeLayer('boundary-fill');
    if (map.getLayer('boundary-line')) map.removeLayer('boundary-line');
    if (map.getSource('property-boundary')) map.removeSource('property-boundary');

    let zoomListener = null;

    if (activeTab === 'properties' || activeTab === 'units') {
      // 1. Create the Three.js Custom WebGL Layer
      const customLayer = {
        id: customLayerId,
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (map, gl) {
          this.camera = new THREE.Camera();
          this.scene = new THREE.Scene();

          // Create lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
          this.scene.add(ambientLight);

          const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
          dirLight.position.set(0, -70, 100).normalize();
          this.scene.add(dirLight);

          const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
          dirLight2.position.set(0, 70, 100).normalize();
          this.scene.add(dirLight2);

          // Build building meshes at mercator coordinates
          properties.forEach((prop) => {
            const coords = getPropertyCoords(prop);
            const mercator = mapboxgl.MercatorCoordinate.fromLngLat(coords, 0);
            const meterScale = mercator.meterInMercatorCoordinateUnits();

            const building = createBuildingModel(prop);
            building.position.set(mercator.x, mercator.y, mercator.z);

            const zoom = map.getZoom();
            const zoomScale = Math.max(0.5, Math.min(2.5, (zoom - 10) / 4));
            const finalScale = meterScale * zoomScale;
            building.scale.set(finalScale, -finalScale, finalScale);

            building.userData = {
              propertyId: prop._id || prop.id,
              meterScale: meterScale,
              lng: coords[0],
              lat: coords[1]
            };

            this.scene.add(building);
          });

          this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
          });
          this.renderer.autoClear = false;
          this.map = map;
        },
        render: function (gl, matrix) {
          const m = new THREE.Matrix4().fromArray(matrix);
          this.camera.projectionMatrix = m;
          this.renderer.resetState();
          this.renderer.render(this.scene, this.camera);
          this.map.triggerRepaint();
        }
      };

      map.addLayer(customLayer);
      customLayerRef.current = customLayer;

      // 2. Add Map Zoom Listener for Zoom-Based Scaling
      zoomListener = () => {
        const zoom = map.getZoom();
        const zoomScale = Math.max(0.5, Math.min(2.5, (zoom - 10) / 4));
        if (customLayerRef.current && customLayerRef.current.scene) {
          customLayerRef.current.scene.children.forEach((child) => {
            if (child.userData && child.userData.meterScale) {
              const finalScale = child.userData.meterScale * zoomScale;
              child.scale.set(finalScale, -finalScale, finalScale);
            }
          });
        }
      };
      map.on('zoom', zoomListener);

      // 3. Create Invisible Mapbox Markers with Native 3D Popups
      properties.forEach((prop) => {
        const coords = getPropertyCoords(prop);
        const el = document.createElement('div');
        el.className = 'cube-marker';

        const occupiedCount = prop.units?.filter((u) => u.status === 'occupied').length || 0;
        const totalUnits = prop.units?.length || 0;
        const occupancyPct = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;

        const popup = new mapboxgl.Popup({
          offset: [0, -45],
          maxWidth: '320px',
          closeButton: true,
          closeOnClick: false,
          className: 'property-popup-3d'
        }).setHTML(`
          <div class="popup-3d-container ${theme === 'dark' ? 'dark' : 'light'}">
            <div class="popup-3d-preview" id="popup-3d-${prop._id || prop.id}"></div>
            <div class="popup-3d-info">
              <h4>${prop.name}</h4>
              <p>${totalUnits} units · ${occupancyPct}% occupied</p>
              <button id="popup-btn-${prop._id || prop.id}">
                View 3D Model
              </button>
            </div>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map);

        popup.on('open', () => {
          // Render the rotating 3D building inside the popup
          const container = document.getElementById(`popup-3d-${prop._id || prop.id}`);
          if (container) {
            renderMini3DScene(container, prop);
          }
          
          const btn = document.getElementById(`popup-btn-${prop._id || prop.id}`);
          if (btn) {
            btn.addEventListener('click', () => {
              popup.remove();
              onPropertySelect(prop);
            });
          }
        });

        markersRef.current.push(marker);
      });

      // Fit map bounds
      if (properties.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        properties.forEach((prop) => {
          bounds.extend(getPropertyCoords(prop));
        });
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1200 });
      }
    }

    // Agent location beacon
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

    return () => {
      if (zoomListener) {
        map.off('zoom', zoomListener);
      }
      if (map.getLayer(customLayerId)) {
        map.removeLayer(customLayerId);
      }
    };
  }, [activeTab, properties, agentLocation, theme]);

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
export default function MapWidget({ 
  properties = [], 
  agentLocation = null, 
  onPropertySelect, 
  isAdmin = false, 
  theme = 'dark',
  activeTab: externalActiveTab,
  onActiveTabChange,
  selectedProperty: externalSelectedProperty,
  onSelectedPropertyChange
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState(properties);
  const [selectedPropertyLocal, setSelectedPropertyLocal] = useState(null);
  const selectedProperty = externalSelectedProperty !== undefined ? externalSelectedProperty : selectedPropertyLocal;
  const setSelectedProperty = (val) => {
    if (externalSelectedProperty !== undefined) onSelectedPropertyChange?.(val);
    else setSelectedPropertyLocal(val);
  };

  const [unitGeoJSON, setUnitGeoJSON] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeTabLocal, setActiveTabLocal] = useState('properties');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : activeTabLocal;
  const setActiveTab = (val) => {
    if (externalActiveTab !== undefined) onActiveTabChange?.(val);
    else setActiveTabLocal(val);
  };

  const [loadingUnits, setLoadingUnits] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState('vector');
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
  }, [onPropertySelect, onSelectedPropertyChange, onActiveTabChange, externalSelectedProperty, externalActiveTab]);

  // Auto-sync map style with active tab:
  // Properties & Units = vector, 3D = satellite
  useEffect(() => {
    if (activeTab === '3d') setMapStyleMode('satellite');
    else setMapStyleMode('vector');
  }, [activeTab]);

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

      {/* Map Views — shown for Properties tab, 3D tab, and Units tab with no property selected */}
      {(activeTab === 'properties' || activeTab === '3d' || (activeTab === 'units' && !selectedProperty)) && (
        <div className="relative flex-1">
          <MapboxMap
            center={center}
            properties={filtered}
            selectedProperty={selectedProperty}
            unitGeoJSON={unitGeoJSON}
            activeTab={activeTab}
            onPropertySelect={handlePropertySelect}
            onUnitSelect={(unit) => {
              const originalUnit = selectedProperty?.units?.find(u => u.unit_number === unit.unit_number);
              if (originalUnit) setSelectedUnit(originalUnit);
            }}
            agentLocation={agentLocation}
            isFullscreen={isFullscreen}
            theme={theme}
            mapStyleMode={mapStyleMode}
          />

          {/* Satellite badge when 3D tab is active */}
          {activeTab === '3d' && selectedProperty && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 z-10 flex items-center gap-2">
              <span>🛰️</span>
              <span className="font-medium">Satellite View — {selectedProperty.name}</span>
            </div>
          )}
          {activeTab === '3d' && !selectedProperty && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 z-10">
              🛰️ Select a property first to zoom into satellite view
            </div>
          )}

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

      {/* 3D Unit Grid — shown for Units tab WITH a selected property */}
      {activeTab === 'units' && selectedProperty && (
        <div className="p-4 bg-background flex-1 overflow-auto">
          <button
            onClick={() => { setSelectedProperty(null); setUnitGeoJSON(null); setSelectedUnit(null); }}
            className="mb-3 flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground transition-colors px-3 py-1.5 bg-surface hover:bg-surface-bright border border-border rounded-lg cursor-pointer"
          >
            ← Back to Map
          </button>
          {isLiteView ? (
            <BuildingPreviewLite
              property={selectedProperty}
              selectedUnit={selectedUnit}
              onClose={() => { setSelectedProperty(null); setUnitGeoJSON(null); setSelectedUnit(null); }}
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
                onClose={() => { setSelectedProperty(null); setUnitGeoJSON(null); setSelectedUnit(null); }}
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
