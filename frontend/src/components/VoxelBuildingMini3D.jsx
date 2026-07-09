import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

function VoxelBuildingMesh({ floors = 6, speed = 0.02, colorPattern = 'blue' }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += speed;
    }
  });

  const baseColor = colorPattern === 'purple' ? '#a855f7' : '#3b82f6';
  const accentColor = colorPattern === 'purple' ? '#c084fc' : '#60a5fa';

  return (
    <group ref={meshRef} position={[0, -0.6, 0]}>
      {/* Base Foundation */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.2, 0.1, 1.2]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* Stacked Floors */}
      {Array.from({ length: floors }).map((_, idx) => {
        const floorY = 0.1 + idx * 0.2 + 0.1;
        return (
          <group key={idx}>
            <mesh position={[0, floorY, 0]}>
              <boxGeometry args={[1.0, 0.18, 1.0]} />
              <meshStandardMaterial 
                color={idx % 2 === 0 ? baseColor : '#f8fafc'} 
                roughness={0.3} 
                metalness={0.1}
              />
            </mesh>
            {/* Balcony slab */}
            <mesh position={[0, floorY + 0.06, 0]}>
              <boxGeometry args={[1.05, 0.03, 1.05]} />
              <meshStandardMaterial color={accentColor} transparent opacity={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* Roof structure */}
      <mesh position={[0.2, 0.1 + floors * 0.2 + 0.08, -0.2]}>
        <boxGeometry args={[0.4, 0.15, 0.4]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}

export default function VoxelBuildingMini3D({ className = "w-full h-40", floors = 6, colorPattern = 'blue' }) {
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const glAvailable = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      setHasWebGL(glAvailable);
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-950 text-slate-500`}>
        <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Loading 3D Preview…</span>
      </div>
    );
  }

  return (
    <div className={`${className} pointer-events-none select-none relative overflow-hidden rounded-2xl`}>
      <Canvas camera={{ position: [2.2, 1.8, 2.2], fov: 40 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} color="#93c5fd" />
        <VoxelBuildingMesh floors={floors} colorPattern={colorPattern} />
      </Canvas>
    </div>
  );
}
