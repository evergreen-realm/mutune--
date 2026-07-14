import { useGLTF } from '@react-three/drei';

export function getBuildingModelPath(unitCount) {
  const count = Number(unitCount) || 0;
  if (count <= 4) return '/models/b_small.glb';
  if (count <= 10) return '/models/b_medium.glb';
  if (count <= 20) return '/models/b_large.glb';
  return '/models/b_tower.glb';
}

export function useBuildingModel(unitCount) {
  const path = getBuildingModelPath(unitCount);
  return useGLTF(path);
}

// Preload the GLB assets to prevent loading stutters
useGLTF.preload('/models/b_small.glb');
useGLTF.preload('/models/b_medium.glb');
useGLTF.preload('/models/b_large.glb');
useGLTF.preload('/models/b_tower.glb');
