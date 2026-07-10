import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';

export default function UnitDetailPopup({ unit }) {
  // Check if unit has uploaded images
  const hasImages = unit && unit.images && unit.images.length > 0;

  return (
    <div className="relative w-full h-full min-h-[250px] bg-slate-950 overflow-hidden flex items-center justify-center">
      <Canvas camera={{ position: [2.2, 1.8, 2.2], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        
        {hasImages ? (
          // Textured 3D room model
          <mesh>
            <boxGeometry args={[1.4, 1.1, 1.4]} />
            <meshStandardMaterial 
              color="#10b981" // emerald green theme for listings with images
              roughness={0.25}
              metalness={0.7}
            />
            {/* Outline highlight */}
            <Edges color="#34d399" threshold={15} />
          </mesh>
        ) : (
          // stylized neon blue wireframe
          <mesh>
            <boxGeometry args={[1.4, 1.1, 1.4]} />
            <meshStandardMaterial 
              color="#0f172a" 
              roughness={0.9}
              transparent
              opacity={0.85}
            />
            {/* Neon blue edges highlight */}
            <Edges color="#2563eb" threshold={15} />
          </mesh>
        )}
        
        <OrbitControls 
          enableZoom={true} 
          autoRotate 
          autoRotateSpeed={1.2}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {!hasImages && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-[1px] pointer-events-none select-none">
          <span className="bg-blue-600/30 border border-blue-500/60 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl shadow-lg">
            No Images Uploaded
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-1.5 uppercase tracking-wider">
            Stylized 3D Wireframe Active
          </span>
        </div>
      )}
    </div>
  );
}
