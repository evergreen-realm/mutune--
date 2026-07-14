import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useBuildingModel } from '../hooks/useBuildingModel';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("VoxelBuildingMini3D Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full w-full bg-slate-950/20 text-slate-500 text-[10px] font-bold font-mono">
          ERROR LOADING 3D VIEW
        </div>
      );
    }
    return this.props.children;
  }
}

function RotatingBuildingModel({ floors, color = '#a855f7' }) { // purple default matching LandlordDashboardPage
  const groupRef = useRef();
  const { scene } = useBuildingModel(floors);

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        const mat = child.material.clone();
        const tint = new THREE.Color(color);
        mat.color.lerp(tint, 0.40); // 40% color wash
        mat.emissive = tint;
        mat.emissiveIntensity = 0.15; // Subtle emissive glow
        mat.roughness = 0.4;
        mat.metalness = 0.15;
        mat.transparent = true;
        mat.opacity = 0.9;
        mat.side = THREE.DoubleSide;
        child.material = mat;
      }
    });
    return clone;
  }, [scene, color]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.015;
    }
  });

  useEffect(() => {
    if (groupRef.current) {
      const box = new THREE.Box3().setFromObject(clonedScene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      // Center the model in the rotation group
      clonedScene.position.x = -center.x;
      clonedScene.position.y = -box.min.y - size.y / 2; // Center vertically too
      clonedScene.position.z = -center.z;
      
      // Scale to fit a bounding box size of 1.8 units
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.8 / (maxDim || 1.0);
      groupRef.current.scale.set(scale, scale, scale);
    }
  }, [clonedScene]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

export default function VoxelBuildingMini3D({ floors = 6, colorPattern = 'purple', className = "w-full h-40" }) {
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

  // Determine Hex Color based on colorPattern prop
  const colorMap = {
    purple: '#a855f7',
    blue: '#3b82f6',
    emerald: '#10b981',
    rose: '#f43f5e',
    amber: '#f59e0b'
  };
  const color = colorMap[colorPattern] || '#a855f7';

  return (
    <div className={`${className} select-none relative overflow-hidden rounded-2xl bg-slate-950/20`}>
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full w-full text-slate-500 text-[10px] font-bold font-mono">
            LOADING 3D VIEW…
          </div>
        }>
          <Canvas camera={{ position: [0, 0, 3.0], fov: 45 }} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={1.2} />
            <directionalLight position={[-5, -10, -5]} intensity={0.4} />
            <RotatingBuildingModel floors={floors} color={color} />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
