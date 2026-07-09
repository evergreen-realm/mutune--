import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

function VoxelLogoMesh({ spinningSpeed = 0.02, scale = 1.0 }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += spinningSpeed;
      meshRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
    }
  });

  return (
    <group ref={meshRef} scale={[scale, scale, scale]}>
      {/* Foundation Base */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[1.0, 0.2, 1.0]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Main Building Block */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#eff6ff" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Rooftop Penthouse */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color="#bfdbfe" roughness={0.2} metalness={0.4} />
      </mesh>

      {/* Mini glowing balcony or accents */}
      <mesh position={[0, 0.2, 0.41]}>
        <boxGeometry args={[0.6, 0.1, 0.02]} />
        <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Mini glowing windows */}
      {[-0.2, 0.2].map((x, idx) => (
        <mesh key={idx} position={[x, 0.1, -0.41]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export default function VoxelLogo3D({ className = "w-10 h-10", isSpinningFast = false, scale = 1.6 }) {
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
    // Return flat fallback icon representation
    return (
      <div className={`${className} flex items-center justify-center bg-blue-600 rounded-lg text-white font-black text-xs shadow-md shadow-blue-500/20`}>
        🏢
      </div>
    );
  }

  // If thinking state (isSpinningFast is true), make it spin rapidly
  const speed = isSpinningFast ? 0.08 : 0.015;

  return (
    <div className={`${className} overflow-hidden pointer-events-none select-none`}>
      <Canvas camera={{ position: [0, 1.2, 2.5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#93c5fd" />
        <VoxelLogoMesh spinningSpeed={speed} scale={scale} />
      </Canvas>
    </div>
  );
}
