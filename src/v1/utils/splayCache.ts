import type { SplayMeshGeometryData } from '../types/splayTypes';

/**
 * Session-level cache for Splay SDF generated geometries.
 * Prevents re-computing 3D volumetric SDF meshes when toggling Splay SDF walls on/off.
 */
const splaySessionCache = new Map<string, SplayMeshGeometryData>();

export function getSplayCacheKey(
  caveId: string | number,
  stationCount: number,
  voxelSize: number,
  smoothK: number,
  capsuleRadius: number,
  isovalue: number = 0.0
): string {
  return `splay_${caveId}_${stationCount}_${voxelSize.toFixed(3)}_${smoothK.toFixed(3)}_${capsuleRadius.toFixed(3)}_${isovalue.toFixed(3)}`;
}

export function getCachedSplayGeometry(key: string): SplayMeshGeometryData | undefined {
  return splaySessionCache.get(key);
}

export function setCachedSplayGeometry(key: string, data: SplayMeshGeometryData): void {
  splaySessionCache.set(key, {
    positions: data.positions,
    normals: data.normals,
    indices: data.indices,
    vertexCount: data.vertexCount,
    triangleCount: data.triangleCount,
  });
}

export function clearSplayCache(): void {
  splaySessionCache.clear();
}
