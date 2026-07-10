import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

function RotatingVoxelEstate({ speed = 0.015 }) {
  const meshRef = useRef();
  
  // Load the premium voxel estate texture from public assets
  const texture = useLoader(THREE.TextureLoader, '/assets/voxel_estate.png');

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += speed;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} scale={[2.6, 2.6, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={texture} 
        transparent={true} 
        side={THREE.DoubleSide} 
        depthWrite={false}
      />
    </mesh>
  );
}

export default function VoxelBuildingMini3D({ className = "w-full h-40" }) {
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
      <Canvas camera={{ position: [0, 0.5, 3.5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <RotatingVoxelEstate />
        </Suspense>
      </Canvas>
    </div>
  );
}
