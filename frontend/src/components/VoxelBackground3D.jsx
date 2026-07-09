import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// Procedural palm tree component
function VoxelPalmTree({ position }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.8, 5]} />
        <meshStandardMaterial color="#854d0e" roughness={0.9} />
      </mesh>
      {/* Leaves */}
      <group position={[0, 0.8, 0]}>
        {[-0.3, 0, 0.3].map((x) =>
          [-0.3, 0, 0.3].map((z) => {
            if (x === 0 && z === 0) return null;
            return (
              <mesh key={`${x}-${z}`} position={[x * 0.7, 0.1 - Math.abs(x * z) * 0.5, z * 0.7]} rotation={[0.2, 0, 0.2]}>
                <boxGeometry args={[0.4, 0.04, 0.4]} />
                <meshStandardMaterial color="#16a34a" roughness={0.7} />
              </mesh>
            );
          })
        )}
      </group>
    </group>
  );
}

// Procedural Mombasa Voxel Building model
function MombasaVoxelBuilding({ activeFloor, hoverFloor, setHoverFloor, scrollY = 0, mouseX = 0, mouseY = 0 }) {
  const groupRef = useRef();
  const { camera } = useThree();

  // Gentle idle rotation + mouse parallax tilt
  useFrame((state) => {
    if (groupRef.current) {
      // Slow base rotation
      const baseRotation = state.clock.getElapsedTime() * 0.08;
      // Mouse tilt influence
      const targetY = baseRotation + mouseX * 0.15;
      const targetX = mouseY * 0.1;
      
      groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05;
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05;
    }

    // Scroll-driven zoom and position pan
    const targetZ = 9.5 - scrollY * 0.003;
    const targetCamY = 4.5 + scrollY * 0.002;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.position.y += (targetCamY - camera.position.y) * 0.05;
    camera.lookAt(0, 2.5, 0);
  });

  const floorsCount = 10;
  const floorHeight = 0.5;

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      {/* 1. Ground Lobby Base */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[3.2, 0.5, 3.2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.1} roughness={0.5} />
      </mesh>
      {/* Lobby Pillars */}
      {[-1.4, 1.4].map((x) =>
        [-1.4, 1.4].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.25, z]}>
            <cylinderGeometry args={[0.08, 0.08, 0.5, 6]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} />
          </mesh>
        ))
      )}

      {/* 2. Stacked Residential Floors */}
      {Array.from({ length: floorsCount }).map((_, idx) => {
        const floorY = 0.5 + idx * floorHeight + floorHeight / 2;
        const isHovered = hoverFloor === idx;
        const isActive = activeFloor === idx;

        // Custom emission or highlight color if selected/hovered
        const color = isActive 
          ? '#3b82f6' 
          : isHovered 
            ? '#60a5fa' 
            : idx % 2 === 0 
              ? '#cbd5e1' 
              : '#f1f5f9';

        const glassColor = isActive ? '#93c5fd' : '#bfdbfe';

        return (
          <group key={idx}>
            {/* Core slab */}
            <mesh
              position={[0, floorY, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoverFloor(idx);
              }}
              onPointerOut={() => {
                setHoverFloor(null);
              }}
            >
              <boxGeometry args={[2.8, floorHeight - 0.05, 2.8]} />
              <meshStandardMaterial 
                color={color} 
                roughness={0.3} 
                metalness={0.2}
                emissive={isActive ? '#1e3a8a' : isHovered ? '#1e40af' : '#000000'}
                emissiveIntensity={isActive ? 0.4 : isHovered ? 0.2 : 0}
              />
            </mesh>

            {/* Glowing Balcony Rails (glassmorphism effect) */}
            <mesh position={[0, floorY + 0.1, 0]}>
              <boxGeometry args={[2.9, 0.2, 2.9]} />
              <meshStandardMaterial 
                color={glassColor} 
                transparent 
                opacity={0.65} 
                roughness={0.05} 
                metalness={0.8} 
              />
            </mesh>

            {/* Inset Windows (small dark squares) */}
            {[-1.1, 0, 1.1].map((x) =>
              [-1.41, 1.41].map((z) => (
                <mesh key={`${x}-${z}`} position={[x, floorY + 0.05, z === 1.41 ? 1.3 : -1.3]}>
                  <boxGeometry args={[0.3, 0.2, 0.05]} />
                  <meshStandardMaterial color={isActive || isHovered ? '#fef08a' : '#1e293b'} emissive={isActive || isHovered ? '#eab308' : '#000000'} />
                </mesh>
              ))
            )}
          </group>
        );
      })}

      {/* 3. Penthouse / Rooftop Amenity Level */}
      <group position={[0, 0.5 + floorsCount * floorHeight, 0]}>
        {/* Penthouse structure */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[2.0, 0.4, 2.0]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        
        {/* Glowing Swimming Pool */}
        <mesh position={[0.4, 0.41, -0.4]}>
          <boxGeometry args={[0.8, 0.02, 0.6]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} roughness={0.1} />
        </mesh>
        
        {/* Surrounding Balustrade */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[2.7, 0.2, 2.7]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* 4. Surrounding Landscape Platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} />
      </mesh>
      <gridHelper args={[18, 18, '#3b82f6', '#334155']} position={[0, 0.02, 0]} />

      {/* Scattered Voxel Palm Trees */}
      <VoxelPalmTree position={[-2.4, 0, -2.4]} />
      <VoxelPalmTree position={[2.4, 0, 2.4]} />
      <VoxelPalmTree position={[-2.4, 0, 2.4]} />
      <VoxelPalmTree position={[2.4, 0, -2.4]} />
    </group>
  );
}

export default function VoxelBackground3D({ activeFloor = null, onHoverFloor = null }) {
  const [scrollY, setScrollY] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [localHoverFloor, setLocalHoverFloor] = useState(null);
  const [liteMode, setLiteMode] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const glAvailable = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      setHasWebGL(glAvailable);
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  // Listen to mouse movement and scroll for dynamic parallax
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const handleMouseMove = (e) => {
      // Normalize mouse to -1 to 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMouse({ x, y });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Propagate local floor hover to parent callbacks
  const handleSetHoverFloor = (idx) => {
    setLocalHoverFloor(idx);
    onHoverFloor?.(idx);
  };

  // Performance monitoring check
  useEffect(() => {
    // If device matches criteria of low performance, trigger Lite Mode (static image)
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      setLiteMode(true);
    }
    if (navigator.connection && (navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === '3g')) {
      setLiteMode(true);
    }
  }, []);

  if (!hasWebGL || liteMode) {
    return (
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none bg-slate-950 z-0">
        {/* Realistic image backdrop fallback */}
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat transition-transform duration-700 hover:scale-105 opacity-15"
          style={{ backgroundImage: `url('/assets/voxel_estate.png')` }}
        />
        {/* Spatial glowing effects */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] rounded-full bg-indigo-500/10 blur-[130px]" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden bg-slate-955/90 dark:bg-slate-955/90 transition-colors duration-300">
      {/* Canvas with proper interaction settings */}
      <div className="w-full h-full pointer-events-auto opacity-20 dark:opacity-25 transition-opacity duration-300">
        <Canvas camera={{ position: [0, 4.5, 9.5], fov: 40 }} gl={{ antialias: true, alpha: true }}>
          <color attach="background" args={['#090d16']} />
          <ambientLight intensity={0.5} />
          
          {/* Main directional light with warm/cool split */}
          <directionalLight position={[5, 10, 5]} intensity={1.5} color="#60a5fa" />
          <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#818cf8" />
          <pointLight position={[0, 6, 0]} intensity={1.2} color="#fef08a" />
          
          <Stars radius={100} depth={50} count={300} factor={4} saturation={0.5} fade speed={1} />
          
          <MombasaVoxelBuilding
            activeFloor={activeFloor}
            hoverFloor={localHoverFloor}
            setHoverFloor={handleSetHoverFloor}
            scrollY={scrollY}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
        </Canvas>
      </div>

      {/* Manual Switch to Lite View Control floating on the side */}
      <button
        onClick={() => setLiteMode(true)}
        className="absolute bottom-4 left-4 pointer-events-auto z-20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-lg transition-colors cursor-pointer"
        title="Reduce graphic requirements by displaying static renders"
      >
        Switch to Lite 2D View
      </button>
    </div>
  );
}
