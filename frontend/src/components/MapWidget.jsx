import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Box, X, Maximize2, Minimize2, Globe } from 'lucide-react';
import { fetchUnitGeoJSON } from '../lib/api';
import { Suspense, lazy } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { useBuildingModel, getBuildingModelPath } from '../hooks/useBuildingModel';

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

// Set Mapbox Access Token — requires VITE_MAPBOX_TOKEN env var
const rawToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (!rawToken || !rawToken.startsWith('pk.')) {
  console.error(
    '[MapWidget] VITE_MAPBOX_TOKEN is missing or invalid. ' +
    'Set it in your .env file or Vercel project environment variables. ' +
    'The map will not load without a valid Mapbox access token.'
  );
}
mapboxgl.accessToken = rawToken;

const statusColors = {
  paid: '#22c55e',
  overdue: '#ef4444',
  pending: '#eab308',
  vacant: '#6b7280',
  maintenance: '#f97316'
};

function getUnitStatus(unit) {
  if (!unit) return 'vacant';
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

function createBuildingModel(property, activeTab = 'properties') {
  const group = new THREE.Group();
  
  if (activeTab === 'units' && property.units && property.units.length > 0) {
    const getUnitFloor = (unit, idx) => {
      if (!unit) return Math.floor(idx / 4);
      const unitStr = String(unit.unit_number || '');
      const match = unitStr.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 100) {
          return Math.floor(num / 100);
        }
        return num;
      }
      return Math.floor(idx / 4);
    };

    const floorsList = property.units.map((u, idx) => getUnitFloor(u, idx));
    const minFloor = floorsList.length > 0 ? Math.min(...floorsList) : 0;

    const floorCounts = {};
    property.units.forEach((unit, idx) => {
      const fl = getUnitFloor(unit, idx);
      floorCounts[fl] = (floorCounts[fl] || 0) + 1;
    });
    const maxUnitsPerFloor = Math.max(...Object.values(floorCounts), 1);
    const W = maxUnitsPerFloor <= 4 ? 2 : maxUnitsPerFloor <= 9 ? 3 : 4;
    const R = Math.ceil(maxUnitsPerFloor / W);

    const floorIndices = {};
    
    // Meter-based layout: fit within a 30m x 30m envelope
    const spacingX = 28.0 / W;
    const spacingZ = 28.0 / R;
    const spacingY = 5.0;
    const unitWidth = 26.0 / W;
    const unitDepth = 26.0 / R;
    const unitHeight = 4.0;

    const colCount = W;
    const rowCount = R;
    
    const xOffset = -(colCount - 1) * spacingX / 2;
    const zOffset = -(rowCount - 1) * spacingZ / 2;

    const unitGeo = new THREE.BoxGeometry(unitWidth - 1.0, unitHeight, unitDepth - 1.0);

    property.units.forEach((unit, idx) => {
      const status = getUnitStatus(unit);
      const colorHex = status === 'paid' ? 0x22c55e :
                       status === 'pending' ? 0xeab308 :
                       status === 'overdue' ? 0xef4444 :
                       status === 'vacant' ? 0x6b7280 : 0xf97316; // maintenance

      const unitMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.4,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
      const unitMesh = new THREE.Mesh(unitGeo, unitMat);

      const fl = getUnitFloor(unit, idx);
      const floorNorm = fl - minFloor;
      const floorIndex = floorIndices[fl] || 0;
      floorIndices[fl] = floorIndex + 1;

      const col = floorIndex % W;
      const row = Math.floor(floorIndex / W);

      const x = col * spacingX + xOffset;
      const y = floorNorm * spacingY + unitHeight / 2;
      const z = row * spacingZ + zOffset;

      unitMesh.position.set(x, y, z);
      group.add(unitMesh);
    });
  } else {
    // Properties Tab: Renders the premium Custom Blue Building with Roofs and warm glowing windows.
    const floors = property.units?.length || 6;
    const height = Math.max(15.0, floors * 5.0);
    const width = 30.0;
    const depth = 30.0;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const body = new THREE.Mesh(geometry, material);
    body.position.y = height / 2;
    group.add(body);
    
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8,
      side: THREE.DoubleSide
    });
    
    const windowGeo = new THREE.BoxGeometry(2.0, 2.0, 0.2);
    const floorHeight = height / floors;

    for (let f = 0; f < floors; f++) {
      const y = (f * floorHeight) + (floorHeight / 2);
      for (let x = -9.0; x <= 9.0; x += 9.0) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(x, y, (depth / 2) + 0.1);
        group.add(win);
      }
      for (let x = -9.0; x <= 9.0; x += 9.0) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(x, y, -(depth / 2) - 0.1);
        group.add(win);
      }
      for (let z = -9.0; z <= 9.0; z += 9.0) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.rotation.y = Math.PI / 2;
        win.position.set((width / 2) + 0.1, y, z);
        group.add(win);
      }
      for (let z = -9.0; z <= 9.0; z += 9.0) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.rotation.y = Math.PI / 2;
        win.position.set(-(width / 2) - 0.1, y, z);
        group.add(win);
      }
    }
    
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.05, 1.0, depth * 1.05),
      roofMat
    );
    roof.position.y = height + 0.5;
    group.add(roof);
  }
  
  return group;
}

function renderMini3DScene(container, property, activeTab = 'properties') {
  container.innerHTML = '';
  
  const width = container.clientWidth || 300;
  const height = container.clientHeight || 140;

  const floors = property.units?.length || 6;
  const buildingHeight = Math.max(15, floors * 5);
  const modelScale = 2.0 / Math.max(30.0, buildingHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(6, 4.5, 6);
  camera.lookAt(0, (buildingHeight * modelScale) / 2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // 1. Create and add the fallback box building first
  let building = createBuildingModel(property, activeTab);
  building.scale.set(modelScale, modelScale, modelScale);
  scene.add(building);

  // 2. Load the optimized GLB model asynchronously
  const loader = new GLTFLoader();
  const totalUnits = property.units?.length || 0;
  let modelUrl = '/models/b_small.glb';
  if (totalUnits > 4 && totalUnits <= 10) modelUrl = '/models/b_medium.glb';
  else if (totalUnits > 10 && totalUnits <= 20) modelUrl = '/models/b_large.glb';
  else if (totalUnits > 20) modelUrl = '/models/b_tower.glb';

  loader.load(modelUrl, (gltf) => {
    // Remove fallback
    scene.remove(building);
    
    // Dispose fallback resources
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    building.traverse((object) => {
      if (object.geometry && !disposedGeometries.has(object.geometry)) {
        object.geometry.dispose();
        disposedGeometries.add(object.geometry);
      }
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => {
          if (mat && !disposedMaterials.has(mat)) {
            mat.dispose();
            disposedMaterials.add(mat);
          }
        });
      }
    });

    const realModel = gltf.scene;
    
    // Color by occupancy
    // Color by occupancy
    const colorHex = getOccupancyColor(property);
    const tint = new THREE.Color(colorHex);
    realModel.traverse((child) => {
      if (child.isMesh) {
        const mat = child.material.clone();
        mat.color.lerp(tint, 0.25); // Subtle 25% color wash
        mat.emissive = tint;
        mat.emissiveIntensity = 0.15; // Subtle emissive glow
        mat.roughness = 0.5;
        mat.metalness = 0.15;
        mat.side = THREE.DoubleSide;
        child.material = mat;
      }
    });

    // Center and scale the GLTF model
    const box = new THREE.Box3().setFromObject(realModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    realModel.position.x = -center.x;
    realModel.position.y = -box.min.y - size.y / 2; // Center vertically
    realModel.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.0 / (maxDim || 1.0);
    
    // Create a wrapper group to rotate and center properly
    const wrapper = new THREE.Group();
    wrapper.add(realModel);
    wrapper.position.y = (buildingHeight * modelScale) / 2;
    
    scene.add(wrapper);
    building = wrapper; // update reference for rotating in animate loop
  }, undefined, (err) => {
    console.error("Failed to load GLTF in renderMini3DScene, keeping fallback", err);
  });

  let animationFrameId;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    if (building) {
      building.rotation.y += 0.015;
    }
    renderer.render(scene, camera);
  };
  animate();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      cancelAnimationFrame(animationFrameId);
      
      const disposedGeometries = new Set();
      const disposedMaterials = new Set();
      scene.traverse((object) => {
        if (object.geometry && !disposedGeometries.has(object.geometry)) {
          object.geometry.dispose();
          disposedGeometries.add(object.geometry);
        }
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((mat) => {
            if (mat && !disposedMaterials.has(mat)) {
              mat.dispose();
              disposedMaterials.add(mat);
            }
          });
        }
      });
      
      renderer.dispose();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Mapbox Map Inner Component ────────────────────────────────────────────────
function MapboxMapInner({ center, zoom, properties, selectedProperty, unitGeoJSON, activeTab, onPropertySelect, onUnitSelect, agentLocation, isFullscreen, theme, mapStyleMode, isLiteView, loadedModels }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const customLayerRef = useRef(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const mapStyle = theme === 'light'
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11';

  // Refs to prevent stale closures in single-mount Mapbox event handlers
  const mapStyleModeRef = useRef(mapStyleMode);
  const themeRef = useRef(theme);
  const propertiesRef = useRef(properties);
  const isLiteViewRef = useRef(isLiteView);
  const loadedModelsRef = useRef(loadedModels);

  useEffect(() => { mapStyleModeRef.current = mapStyleMode; }, [mapStyleMode]);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { propertiesRef.current = properties; }, [properties]);
  useEffect(() => { isLiteViewRef.current = isLiteView; }, [isLiteView]);
  useEffect(() => { loadedModelsRef.current = loadedModels; }, [loadedModels]);

  // Setup/Refresh standard style-bound layers and sources
  const setupMapStyleResources = useCallback((map) => {
    if (!map || !map.style) return;

    const currentMapStyleMode = mapStyleModeRef.current;
    const currentTheme = themeRef.current;
    const currentProperties = propertiesRef.current;

    const layers = map.getStyle()?.layers;
    if (!layers) return;
    const labelLayerId = layers.find(
      (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
    )?.id;

    // 1. Add Mapbox satellite layer (uses existing access token, no CORS issues)
    if (!map.getSource('mapbox-satellite')) {
      map.addSource('mapbox-satellite', {
        type: 'raster',
        url: 'mapbox://mapbox.satellite',
        tileSize: 256
      });
      map.addLayer({
        id: 'satellite-layer',
        type: 'raster',
        source: 'mapbox-satellite',
        paint: {
          'raster-opacity': currentMapStyleMode === 'satellite' ? 1.0 : 0.0
        }
      }, labelLayerId);
    }

    // 2. Add standard 3D buildings extrusions for Mombasa
    if (!map.getLayer('3d-buildings')) {
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['has', 'type'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': currentTheme === 'light' ? '#6366f1' : '#cabeff',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              14.5, ['coalesce', ['get', 'height'], 10]
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              14.5, ['coalesce', ['get', 'min_height'], 0]
            ],
            'fill-extrusion-opacity': isLiteViewRef.current ? 0.0 : 0.5
          }
        },
        labelLayerId
      );
    }

    // 3. Add custom 3D property building extrusions with dynamic heights based on unit count
    if (!map.getSource('property-buildings')) {
      const propFeatures = (currentProperties || []).map(prop => {
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
          'fill-extrusion-opacity': isLiteViewRef.current ? 0.85 : 0.0
        }
      });
    }
  }, []);

  // Initialize Map exactly ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapCenter = [center[1], center[0]];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: mapCenter,
      zoom: zoom || 14.5,
      pitch: isLiteViewRef.current ? 0 : 50,
      bearing: isLiteViewRef.current ? 0 : -17.6,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const handleStyleLoad = () => {
      setupMapStyleResources(map);
      setStyleLoaded(true);
    };

    map.on('style.load', handleStyleLoad);

    if (map.isStyleLoaded()) {
      handleStyleLoad();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle style toggling smoothly via setStyle instead of destroying and recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setStyleLoaded(false);
    map.setStyle(mapStyle);
  }, [theme]);

  // Handle dynamically changing satellite mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const satOpacity = mapStyleMode === 'satellite' ? 1.0 : 0.0;
    if (map.getLayer('satellite-layer')) {
      map.setPaintProperty('satellite-layer', 'raster-opacity', satOpacity);
    }
  }, [mapStyleMode, styleLoaded]);

  // Handle dynamically changing Lite View mode on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (isLiteView) {
      // Smoothly transition map to a flat 2D top-down view
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
        essential: true
      });
      // Hide standard Mapbox 3D buildings
      if (map.getLayer('3d-buildings')) {
        map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.0);
      }
      // Show custom property extrusions with 0.85 opacity in Lite Mode
      if (map.getLayer('property-extrusions')) {
        map.setPaintProperty('property-extrusions', 'fill-extrusion-opacity', 0.85);
      }
      // Hide custom 3D WebGL layer
      if (map.getLayer('3d-custom-buildings-layer')) {
        map.setLayoutProperty('3d-custom-buildings-layer', 'visibility', 'none');
      }
    } else {
      // Smoothly transition map to angled 3D view
      map.easeTo({
        pitch: 50,
        bearing: -17.6,
        duration: 1000,
        essential: true
      });
      // Show standard Mapbox 3D buildings
      if (map.getLayer('3d-buildings')) {
        map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.5);
      }
      // Hide custom property extrusions (keep as invisible click targets) in 3D Mode
      if (map.getLayer('property-extrusions')) {
        map.setPaintProperty('property-extrusions', 'fill-extrusion-opacity', 0.0);
      }
      // Show custom 3D WebGL layer
      if (map.getLayer('3d-custom-buildings-layer')) {
        map.setLayoutProperty('3d-custom-buildings-layer', 'visibility', 'visible');
      }
    }
  }, [isLiteView, styleLoaded]);

  // Handle properties changes dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const source = map.getSource('property-buildings');
    if (!source) return;

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

    source.setData({ type: 'FeatureCollection', features: propFeatures });
  }, [properties, styleLoaded]);

  // Handle dynamically updating GLB models in the Three.js scene when loadedModels becomes available
  useEffect(() => {
    const map = mapRef.current;
    const customLayer = customLayerRef.current;
    if (!map || !customLayer || !customLayer.scene || !loadedModels) return;

    properties.forEach((prop) => {
      const propId = prop._id || prop.id;
      // If we already added the GLB model, skip
      if (customLayer.scene.getObjectByName(`glb-${propId}`)) return;

      if (activeTab === 'units') return; // Don't add GLB model on units tab!

      const modelUrl = getBuildingModelPath(prop.units?.length || 0);
      let modelKey = 'small';
      if (modelUrl.includes('medium')) modelKey = 'medium';
      else if (modelUrl.includes('large')) modelKey = 'large';
      else if (modelUrl.includes('tower')) modelKey = 'tower';

      const sourceScene = loadedModels[modelKey];
      if (!sourceScene) return;

      // Remove fallback if exists
      const fallback = customLayer.scene.getObjectByName(`fallback-${propId}`);
      if (fallback) {
        customLayer.scene.remove(fallback);
        fallback.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((mat) => mat && mat.dispose());
          }
        });
      }

      // Clone and add GLB model
      const building = sourceScene.clone();
      building.name = `glb-${propId}`;

      // Color by occupancy
      const colorHex = getOccupancyColor(prop);
      const tint = new THREE.Color(colorHex);
      building.traverse((child) => {
        if (child.isMesh) {
          const mat = child.material.clone();
          mat.color.lerp(tint, 0.25);
          mat.emissive = tint;
          mat.emissiveIntensity = 0.15;
          mat.roughness = 0.5;
          mat.metalness = 0.15;
          mat.side = THREE.DoubleSide;
          child.material = mat;
        }
      });

      const box = new THREE.Box3().setFromObject(building);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetEnvelope = 30.0;
      const scaleFactor = targetEnvelope / (maxDim || 1.0);
      building.scale.set(scaleFactor, scaleFactor, scaleFactor);

      const center = box.getCenter(new THREE.Vector3());
      building.position.set(
        -center.x * scaleFactor,
        -box.min.y * scaleFactor,
        -center.z * scaleFactor
      );

      const coords = getPropertyCoords(prop);
      const propMerc = mapboxgl.MercatorCoordinate.fromLngLat(coords, 0);
      const refMerc = customLayer.refMercator;
      const refScale = customLayer.meterScale;
      const offX = refMerc ? (propMerc.x - refMerc.x) / refScale : 0;
      const offZ = refMerc ? (propMerc.y - refMerc.y) / refScale : 0;

      const wrapper = new THREE.Group();
      wrapper.add(building);
      wrapper.name = `glb-${propId}`;
      wrapper.position.set(offX, 0, offZ);
      wrapper.userData = { propertyId: propId };

      customLayer.scene.add(wrapper);
    });

    map.triggerRepaint();
  }, [loadedModels, properties, activeTab]);

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
    else map.once('style.load', doFly);
  }, [activeTab, selectedProperty]);

  // Inject CSS styles for custom 3D popups on mount
  useEffect(() => {
    const id = 'mapbox-property-popup-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = `
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

  // Handle markers & layers updates and interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    // Clear old markers (only agent beacon now)
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove custom 3D WebGL layer if it exists
    const customLayerId = '3d-custom-buildings-layer';

    if (activeTab === 'properties' || activeTab === 'units') {
      // 1. Create the Three.js Custom WebGL Layer using RTE (Relative to Eye)
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

          const models = loadedModelsRef.current;

          // Compute reference origin from center of all properties (official Mapbox pattern)
          const allCoords = properties.map(p => getPropertyCoords(p));
          const avgLng = allCoords.reduce((s, c) => s + c[0], 0) / (allCoords.length || 1);
          const avgLat = allCoords.reduce((s, c) => s + c[1], 0) / (allCoords.length || 1);
          const refMercator = mapboxgl.MercatorCoordinate.fromLngLat([avgLng, avgLat], 0);
          const refMeterScale = refMercator.meterInMercatorCoordinateUnits();

          this.modelTransform = {
            translateX: refMercator.x,
            translateY: refMercator.y,
            translateZ: refMercator.z || 0,
            rotateX: Math.PI / 2,
            scale: refMeterScale
          };
          this.refMercator = refMercator;
          this.meterScale = refMeterScale;

          // Build building meshes at meter offsets from reference origin
          properties.forEach((prop) => {
            try {
              const propId = prop._id || prop.id;
              const coords = getPropertyCoords(prop);
              const propMercator = mapboxgl.MercatorCoordinate.fromLngLat(coords, 0);

              // Compute scene position as meter offsets from reference origin
              const offsetX = (propMercator.x - refMercator.x) / refMeterScale;
              const offsetZ = (propMercator.y - refMercator.y) / refMeterScale;

              const modelUrl = getBuildingModelPath(prop.units?.length || 0);
              let modelKey = 'small';
              if (modelUrl.includes('medium')) modelKey = 'medium';
              else if (modelUrl.includes('large')) modelKey = 'large';
              else if (modelUrl.includes('tower')) modelKey = 'tower';

              const sourceScene = models?.[modelKey];

              if (sourceScene && activeTab !== 'units') {
                // GLB model is available and we are NOT on units tab
                const building = sourceScene.clone();
                building.name = `glb-${propId}`;

                // Apply occupancy color
                const colorHex = getOccupancyColor(prop);
                const tint = new THREE.Color(colorHex);
                building.traverse((child) => {
                  if (child.isMesh) {
                    const mat = child.material.clone();
                    mat.color.lerp(tint, 0.25);
                    mat.emissive = tint;
                    mat.emissiveIntensity = 0.15;
                    mat.roughness = 0.5;
                    mat.metalness = 0.15;
                    mat.side = THREE.DoubleSide;
                    child.material = mat;
                  }
                });

                // Scale to fit ~30m horizontal envelope
                const box = new THREE.Box3().setFromObject(building);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.z);
                const targetEnvelope = 30.0;
                const scaleFactor = targetEnvelope / (maxDim || 1.0);
                building.scale.set(scaleFactor, scaleFactor, scaleFactor);

                // Center horizontally and place base at ground level
                const center = box.getCenter(new THREE.Vector3());
                building.position.set(
                  -center.x * scaleFactor,
                  -box.min.y * scaleFactor,
                  -center.z * scaleFactor
                );

                const wrapper = new THREE.Group();
                wrapper.add(building);
                wrapper.name = `glb-${propId}`;
                wrapper.position.set(offsetX, 0, offsetZ);
                wrapper.userData = { propertyId: propId };

                this.scene.add(wrapper);
              } else {
                // Use fallback box (or stacked cubes for units tab)
                const building = createBuildingModel(prop, activeTab);
                building.name = `fallback-inner-${propId}`;

                const wrapper = new THREE.Group();
                wrapper.add(building);
                wrapper.name = `fallback-${propId}`;
                wrapper.position.set(offsetX, 0, offsetZ);
                wrapper.userData = { propertyId: propId };

                this.scene.add(wrapper);
              }
            } catch (err) {
              console.error("Error creating WebGL building mesh for property:", prop, err);
            }
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
          // Official Mapbox + Three.js pattern: projectionMatrix = mapboxMatrix * modelTransformMatrix
          const rotationX = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(1, 0, 0),
            this.modelTransform.rotateX
          );

          const m = new THREE.Matrix4().fromArray(matrix);
          const l = new THREE.Matrix4()
            .makeTranslation(
              this.modelTransform.translateX,
              this.modelTransform.translateY,
              this.modelTransform.translateZ
            )
            .scale(new THREE.Vector3(
              this.modelTransform.scale,
              -this.modelTransform.scale,
              this.modelTransform.scale
            ))
            .multiply(rotationX);

          this.camera.projectionMatrix = m.multiply(l);

          this.renderer.resetState();
          this.renderer.render(this.scene, this.camera);
          this.map.triggerRepaint();
        },
        onRemove: function (map, gl) {
          if (this.renderer) {
            this.renderer.dispose();
          }
          if (this.scene) {
            const disposedGeometries = new Set();
            const disposedMaterials = new Set();
            this.scene.traverse((object) => {
              if (object.geometry && !disposedGeometries.has(object.geometry)) {
                object.geometry.dispose();
                disposedGeometries.add(object.geometry);
              }
              if (object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach((mat) => {
                  if (mat && !disposedMaterials.has(mat)) {
                    mat.dispose();
                    disposedMaterials.add(mat);
                  }
                });
              }
            });
          }
        }
      };

      map.addLayer(customLayer);
      if (isLiteViewRef.current) {
        map.setLayoutProperty(customLayerId, 'visibility', 'none');
      }
      customLayerRef.current = customLayer;

      // Fit map bounds
      if (properties.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        properties.forEach((prop) => {
          bounds.extend(getPropertyCoords(prop));
        });
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1200 });
      }
    }

    // Create interactive click listener for native Mapbox fill-extrusion layers
    const onPropertyClick = (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const propName = feature.properties.name;
      const prop = properties.find((p) => p.name === propName);
      if (!prop) return;

      // Close any active popups first
      const popups = document.getElementsByClassName('mapboxgl-popup');
      for (let i = 0; i < popups.length; i++) {
        popups[i].remove();
      }

      // Directly select property
      onPropertySelect(prop);
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    if (activeTab === 'properties' || activeTab === 'units') {
      map.on('click', 'property-extrusions', onPropertyClick);
      map.on('mouseenter', 'property-extrusions', onMouseEnter);
      map.on('mouseleave', 'property-extrusions', onMouseLeave);
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

    // Render custom premium HTML markers if activeTab is not properties or units, OR if we are in Lite View
    if (isLiteView || (activeTab !== 'properties' && activeTab !== 'units')) {
      properties.forEach((prop) => {
        const coords = getPropertyCoords(prop);
        const el = document.createElement('div');
        el.className = 'property-map-marker-container';
        
        const innerEl = document.createElement('div');
        innerEl.className = 'property-map-marker';
        innerEl.style.cssText = `
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 6px 10px;
          border-radius: 99px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          transition: all 0.2s ease;
        `;
        
        const dot = document.createElement('span');
        dot.style.cssText = `
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px #3b82f6;
        `;
        
        const text = document.createElement('span');
        text.innerText = prop.name;
        text.style.cssText = `
          font-size: 10px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          font-family: system-ui, sans-serif;
        `;
        
        innerEl.appendChild(dot);
        innerEl.appendChild(text);
        el.appendChild(innerEl);

        // Hover animations
        innerEl.style.transformOrigin = 'center';
        innerEl.addEventListener('mouseenter', () => {
          innerEl.style.transform = 'scale(1.05)';
          innerEl.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        });
        innerEl.addEventListener('mouseleave', () => {
          innerEl.style.transform = 'scale(1)';
          innerEl.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        });

        // Click handler to select property and switch to units tab
        innerEl.addEventListener('click', () => {
          onPropertySelect?.(prop);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([coords[0], coords[1]])
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    return () => {
      const isMapValid = map && !map._removed;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (isMapValid) {
        map.off('click', 'property-extrusions', onPropertyClick);
        map.off('mouseenter', 'property-extrusions', onMouseEnter);
        map.off('mouseleave', 'property-extrusions', onMouseLeave);
      }
      try {
        if (isMapValid && map.style && map.getLayer(customLayerId)) {
          map.removeLayer(customLayerId);
        }
      } catch (e) {
        // Safe to ignore
      }
    };
  }, [activeTab, properties, agentLocation, theme, onPropertySelect, styleLoaded, isLiteView, loadedModels]);

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

// Global cache and loader for Mapbox GLTFLoader models to prevent canvas context runtime crash
const globalModelCache = {
  small: null,
  medium: null,
  large: null,
  tower: null,
  loading: false,
  loaded: false,
  listeners: []
};

const globalGLTFLoader = new GLTFLoader();

function preloadMapModels(onComplete) {
  if (globalModelCache.loaded) {
    onComplete?.(globalModelCache);
    return;
  }
  
  if (onComplete) {
    globalModelCache.listeners.push(onComplete);
  }

  if (globalModelCache.loading) return;
  globalModelCache.loading = true;

  const loadModel = (key, url) => {
    return new Promise((resolve) => {
      globalGLTFLoader.load(url, (gltf) => {
        globalModelCache[key] = gltf.scene;
        resolve();
      }, undefined, (err) => {
        console.error(`Failed to load Mapbox 3D model: ${url}`, err);
        resolve();
      });
    });
  };

  Promise.all([
    loadModel('small', '/models/b_small.glb'),
    loadModel('medium', '/models/b_medium.glb'),
    loadModel('large', '/models/b_large.glb'),
    loadModel('tower', '/models/b_tower.glb')
  ]).then(() => {
    globalModelCache.loaded = true;
    globalModelCache.loading = false;
    const listeners = globalModelCache.listeners;
    globalModelCache.listeners = [];
    listeners.forEach(cb => cb(globalModelCache));
  });
}

function MapboxMap(props) {
  const [loadedModels, setLoadedModels] = useState(null);

  useEffect(() => {
    if (props.isLiteView) return;

    preloadMapModels((models) => {
      setLoadedModels({
        small: models.small,
        medium: models.medium,
        large: models.large,
        tower: models.tower
      });
    });
  }, [props.isLiteView]);

  return <MapboxMapInner {...props} loadedModels={loadedModels} />;
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
            className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              isLiteView
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400'
                : 'bg-indigo-550/10 text-indigo-600 border-indigo-550/30 dark:bg-indigo-500/20 dark:text-indigo-400'
            }`}
            title={isLiteView ? 'Lite Mode active — Click to switch to 3D View' : '3D View active — Click to switch to Lite Mode'}
          >
            <Box size={13} />
            <span>{isLiteView ? 'Lite Mode' : '3D View'}</span>
          </button>

          <button
            onClick={() => setMapStyleMode(prev => prev === 'vector' ? 'satellite' : 'vector')}
            className={`px-2.5 py-1.5 rounded-lg border transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              mapStyleMode === 'satellite'
                ? 'bg-emerald-600/10 text-emerald-600 border-emerald-600/30 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-slate-500/10 text-slate-600 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-400'
            }`}
            title={mapStyleMode === 'satellite' ? 'Satellite View active — Click to switch to Vector View' : 'Vector View active — Click to switch to Satellite View'}
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

      {/* Map Views — shown for Properties tab, Units tab, and 3D tab with no property selected */}
      {(activeTab === 'properties' || activeTab === 'units' || (activeTab === '3d' && !selectedProperty)) && (
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
            isLiteView={isLiteView}
          />

          {/* Floating screen-based card popup overlay for selected property */}
          {selectedProperty && (activeTab === 'properties' || activeTab === 'units') && (
            <div className={`absolute bottom-4 right-4 z-[999] p-4 rounded-2xl shadow-2xl border w-80 flex flex-col gap-3 transition-all ${
              theme === 'dark' 
                ? 'bg-slate-900/95 border-white/10 text-white' 
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200'
            }`}>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h4 className="font-extrabold text-sm text-foreground">{selectedProperty.name}</h4>
                  <p className="text-[10px] text-muted font-mono">{selectedProperty.property_code}</p>
                </div>
                <button
                  onClick={() => { setSelectedProperty(null); setUnitGeoJSON(null); setSelectedUnit(null); }}
                  className="text-muted hover:text-foreground transition p-1 hover:bg-background/80 rounded-lg cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="text-xs text-muted space-y-1.5">
                <p>📍 {selectedProperty.address?.street}, {selectedProperty.address?.area}</p>
                <p className="font-medium">
                  🏢 {selectedProperty.units?.length || 0} Units · {
                    selectedProperty.units?.length > 0 
                      ? Math.round(((selectedProperty.units?.filter(u => u.status === 'occupied').length || 0) / selectedProperty.units.length) * 100) 
                      : 0
                  }% occupied
                </p>
              </div>
              <button
                onClick={() => setActiveTab('3d')}
                className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer text-center active:scale-[0.98]"
              >
                View 3D Model
              </button>
            </div>
          )}

          {/* Satellite badge when 3D tab is active with no property */}
          {activeTab === '3d' && !selectedProperty && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 z-10">
              🛰️ Select a property first to zoom into 3D building view
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

      {/* 3D Unit Grid — shown for 3D Building tab WITH a selected property */}
      {activeTab === '3d' && selectedProperty && (
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
