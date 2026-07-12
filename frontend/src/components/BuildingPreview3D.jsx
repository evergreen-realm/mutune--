import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Box, X } from 'lucide-react';
import * as THREE from 'three';

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

function DetailedBuildingModelR3F({ property, color = '#2563eb' }) {
  const floors = property?.units?.length || 6;
  const height = floors * 0.5;
  const width = 2.0;
  const depth = 2.0;

  const windowElements = [];
  for (let f = 0; f < floors; f++) {
    const y = (f * 0.5) + 0.25;
    // Front face
    for (let x = -0.6; x <= 0.6; x += 0.6) {
      windowElements.push(
        <mesh key={`f-${f}-${x}`} position={[x, y, (depth / 2) + 0.01]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
      );
    }
    // Back face
    for (let x = -0.6; x <= 0.6; x += 0.6) {
      windowElements.push(
        <mesh key={`b-${f}-${x}`} position={[x, y, -(depth / 2) - 0.01]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
      );
    }
    // Right face
    for (let z = -0.6; z <= 0.6; z += 0.6) {
      windowElements.push(
        <mesh key={`r-${f}-${z}`} position={[(width / 2) + 0.01, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
      );
    }
    // Left face
    for (let z = -0.6; z <= 0.6; z += 0.6) {
      windowElements.push(
        <mesh key={`l-${f}-${z}`} position={[-(width / 2) - 0.01, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
      );
    }
  }

  return (
    <group position={[0, 0, 0]}>
      {/* Main Body */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Windows */}
      {windowElements}
      {/* Roof */}
      <mesh position={[0, height + 0.025, 0]}>
        <boxGeometry args={[width * 1.05, 0.05, depth * 1.05]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Unit3DBlock({ unit, position, isSelected, onHover, onClick }) {
  const status = getUnitStatus(unit);
  const color = statusColors[status] || '#6b7280';

  const [hovered, setHovered] = useState(false);

  const scale = isSelected ? [1.1, 1.1, 1.1] : hovered ? [1.05, 1.05, 1.05] : [1, 1, 1];
  const emissive = isSelected ? '#ffffff' : hovered ? '#475569' : '#000000';
  const emissiveIntensity = isSelected ? 0.35 : hovered ? 0.2 : 0;

  return (
    <group position={position}>
      {/* Main Apartment Block (no windows/roofs) */}
      <mesh
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover?.(unit);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover?.(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(unit);
        }}
      >
        <boxGeometry args={[1.4, 1.0, 1.4]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.2}
          transparent={status === 'vacant'}
          opacity={status === 'vacant' ? 0.55 : 1.0}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </group>
  );
}

export default function BuildingPreview3D({ property, selectedUnit, onClose, onUnitSelect, theme = 'dark' }) {
  const [hoveredUnit, setHoveredUnit] = useState(null);
  const [viewMode, setViewMode] = useState('image'); // 'image' | 'interactive'
  const isLight = theme === 'light';

  if (!property) {
    return (
      <div className={`h-80 flex flex-col items-center justify-center rounded-xl border ${
        isLight
          ? 'bg-surface-bright border-border text-muted'
          : 'bg-surface border-border text-muted'
      }`}>
        <Box size={32} className="mb-2 opacity-40 animate-pulse" />
        <p className="text-xs">No property selected for 3D Preview</p>
      </div>
    );
  }

  const units = property.units || [];
  
  const getUnitFloor = (unit, idx) => {
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

  const floorsList = units.map((u, idx) => getUnitFloor(u, idx));
  const minFloor = floorsList.length > 0 ? Math.min(...floorsList) : 0;

  const floorCounts = {};
  units.forEach((unit, idx) => {
    const fl = getUnitFloor(unit, idx);
    floorCounts[fl] = (floorCounts[fl] || 0) + 1;
  });
  const maxUnitsPerFloor = Math.max(...Object.values(floorCounts), 1);
  const W = maxUnitsPerFloor <= 4 ? 2 : maxUnitsPerFloor <= 9 ? 3 : 4;

  const spacingX = 1.6;
  const spacingY = 1.2;
  const spacingZ = 1.6;
  const colCount = W;
  const rowCount = Math.ceil(maxUnitsPerFloor / W);
  
  const xOffset = -(colCount - 1) * spacingX / 2;
  const zOffset = -(rowCount - 1) * spacingZ / 2;

  const floorIndices = {};
  const unitPositions = units.map((unit, idx) => {
    const fl = getUnitFloor(unit, idx);
    const floorNorm = fl - minFloor;
    const floorIndex = floorIndices[fl] || 0;
    floorIndices[fl] = floorIndex + 1;

    const col = floorIndex % W;
    const row = Math.floor(floorIndex / W);

    const x = col * spacingX + xOffset;
    const y = floorNorm * spacingY + 0.5;
    const z = row * spacingZ + zOffset;

    return [x, y, z];
  });

  const groundColor = isLight ? '#e2e8f0' : '#0b0f19';
  const gridColor1 = '#2563eb';
  const gridColor2 = isLight ? '#cbd5e1' : '#334155';

  return (
    <div className={`relative rounded-xl border p-4 overflow-hidden ${
      isLight ? 'bg-surface border-border' : 'bg-surface border-border'
    }`} style={{ minHeight: '400px' }}>
      <div className="absolute top-4 left-4 z-10">
        <h3 className="font-bold text-sm text-foreground">{property.name}</h3>
        <p className="text-xs text-muted font-mono">{property.property_code}</p>
        <div className="mt-2 flex gap-2">
          <span className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${
            isLight
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'bg-surface-bright border-border text-muted font-semibold'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> {viewMode === 'image' ? 'Cinematic Render' : 'Interactive 3D Blocks'}
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div className="flex gap-1 p-0.5 bg-background/80 backdrop-blur-md rounded-lg border border-border">
          <button
            onClick={() => setViewMode('image')}
            className={`px-2.5 py-1 text-[11px] rounded-md font-bold transition-all cursor-pointer ${
              viewMode === 'image'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-bright'
            }`}
          >
            Cinematic Render
          </button>
          <button
            onClick={() => setViewMode('interactive')}
            className={`px-2.5 py-1 text-[11px] rounded-md font-bold transition-all cursor-pointer ${
              viewMode === 'interactive'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-bright'
            }`}
          >
            Interactive Blocks
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 bg-surface-bright hover:bg-background text-muted hover:text-foreground rounded-lg border border-border transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className={`w-full h-80 rounded-lg overflow-hidden border mt-10 relative ${
        isLight ? 'bg-surface-bright border-border' : 'bg-background border-border'
      }`}>
        {viewMode === 'image' ? (
          <Canvas camera={{ position: [8, 6, 8], fov: 45 }}>
            <ambientLight intensity={isLight ? 0.6 : 0.4} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} />
            <Environment preset="city" />
            <group position={[0, -1, 0]}>
              {units.length === 0 ? (
                <DetailedBuildingModelR3F property={property} color="#2563eb" />
              ) : (
                units.map((unit, idx) => (
                  <Unit3DBlock
                    key={unit._id || idx}
                    unit={unit}
                    position={unitPositions[idx]}
                    isSelected={selectedUnit?._id === unit._id}
                    onHover={setHoveredUnit}
                    onClick={onUnitSelect}
                  />
                ))
              )}

              <gridHelper args={[15, 15, gridColor1, gridColor2]} position={[0, 0.01, 0]} />
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[15, 15]} />
                <meshStandardMaterial color={groundColor} roughness={0.9} />
              </mesh>
            </group>

            <OrbitControls
              autoRotate
              autoRotateSpeed={1.5}
              enableDamping
              dampingFactor={0.05}
              maxPolarAngle={Math.PI / 2 - 0.05}
              minDistance={3}
              maxDistance={20}
            />
          </Canvas>
        ) : (
          <Canvas camera={{ position: [5, 4, 8], fov: 45 }}>
            <ambientLight intensity={isLight ? 0.6 : 0.4} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} />
            <Environment preset="city" />
            <group position={[0, -1, 0]}>
              {units.length === 0 ? (
                <DetailedBuildingModelR3F property={property} color="#2563eb" />
              ) : (
                units.map((unit, idx) => (
                  <Unit3DBlock
                    key={unit._id || idx}
                    unit={unit}
                    position={unitPositions[idx]}
                    isSelected={selectedUnit?._id === unit._id}
                    onHover={setHoveredUnit}
                    onClick={onUnitSelect}
                  />
                ))
              )}

              <gridHelper args={[15, 15, gridColor1, gridColor2]} position={[0, 0.01, 0]} />
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[15, 15]} />
                <meshStandardMaterial color={groundColor} roughness={0.9} />
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
        )}
      </div>

      <div className="mt-4 flex flex-col md:flex-row justify-between items-stretch gap-3 border-t border-border pt-3">
        <div className="flex-1 text-xs text-muted">
          {hoveredUnit ? (
            <div className="bg-surface-bright p-2.5 rounded border border-border">
              <p className="font-semibold text-foreground">Unit {hoveredUnit.unit_number}</p>
              <p className="text-xs text-muted capitalize">Status: {hoveredUnit.status?.replace('_', ' ')}</p>
              <p className="text-xs text-muted">Rent: KES {hoveredUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : selectedUnit ? (
            <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-600 dark:text-blue-400">Selected: Unit {selectedUnit.unit_number}</p>
              <p className="text-xs text-foreground capitalize">Status: {selectedUnit.status?.replace('_', ' ')}</p>
              <p className="text-xs text-foreground">Rent: KES {selectedUnit.rent_kes?.toLocaleString()}</p>
            </div>
          ) : (
            <p className="italic text-muted py-2">Hover over or click a 3D unit block to inspect details. Drag to rotate model.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          {Object.entries(statusColors).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-muted font-medium">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
