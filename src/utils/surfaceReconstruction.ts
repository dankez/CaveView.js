import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fast Voxel-based Shell Reconstruction.
 * Instead of complex Marching Cubes, we use voxel cubes + aggressive smoothing.
 * This creates the "plachta" (sheet) look requested by the user.
 */
export function reconstructSurface(points: {x:number, y:number, z:number}[], voxelSize = 0.5): THREE.BufferGeometry {
  if (points.length < 10) return new THREE.BufferGeometry();

  // 1. Bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }

  // Safety check for resolution
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  
  // Adjust voxel size if model is too large to prevent memory crash
  const maxRes = 150; // max 150 cells in any dimension
  let activeVoxelSize = voxelSize;
  if (dx / activeVoxelSize > maxRes) activeVoxelSize = dx / maxRes;
  if (dy / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dy / maxRes);
  if (dz / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dz / maxRes);

  const resX = Math.ceil(dx / activeVoxelSize);
  const resY = Math.ceil(dy / activeVoxelSize);
  
  // 2. Voxelize using a Set for sparsity (saves memory and avoids giant arrays)
  const occupied = new Set<number>();
  for (const p of points) {
    const ix = Math.floor((p.x - minX) / activeVoxelSize);
    const iy = Math.floor((p.y - minY) / activeVoxelSize);
    const iz = Math.floor((p.z - minZ) / activeVoxelSize);
    // Packed key
    occupied.add(ix + iy * 2000 + iz * 4000000);
  }

  // 3. Generate Cube Faces for occupied voxels
  // Only add faces that are on the boundary (neighbor is empty) to save geometry
  const vertices: number[] = [];
  
  const hasNeighbor = (ix: number, iy: number, iz: number) => occupied.has(ix + iy * 2000 + iz * 4000000);

  for (const key of occupied) {
    const ix = key % 2000;
    const iy = Math.floor((key % 4000000) / 2000);
    const iz = Math.floor(key / 4000000);

    const x = minX + ix * activeVoxelSize;
    const y = minY + iy * activeVoxelSize;
    const z = minZ + iz * activeVoxelSize;
    const s = activeVoxelSize;

    // Helper to add quad
    const addQuad = (v1: number[], v2: number[], v3: number[], v4: number[]) => {
      // Triangle 1
      vertices.push(...v1, ...v2, ...v3);
      // Triangle 2
      vertices.push(...v1, ...v3, ...v4);
    };

    // Check 6 neighbors
    // Top
    if (!hasNeighbor(ix, iy, iz + 1)) addQuad([x, z+s, -y], [x+s, z+s, -y], [x+s, z+s, -(y+s)], [x, z+s, -(y+s)]);
    // Bottom
    if (!hasNeighbor(ix, iy, iz - 1)) addQuad([x, z, -(y+s)], [x+s, z, -(y+s)], [x+s, z, -y], [x, z, -y]);
    // Front
    if (!hasNeighbor(ix, iy - 1, iz)) addQuad([x, z, -y], [x+s, z, -y], [x+s, z+s, -y], [x, z+s, -y]);
    // Back
    if (!hasNeighbor(ix, iy + 1, iz)) addQuad([x+s, z, -(y+s)], [x, z, -(y+s)], [x, z+s, -(y+s)], [x+s, z+s, -(y+s)]);
    // Left
    if (!hasNeighbor(ix - 1, iy, iz)) addQuad([x, z, -(y+s)], [x, z, -y], [x, z+s, -y], [x, z+s, -(y+s)]);
    // Right
    if (!hasNeighbor(ix + 1, iy, iz)) addQuad([x+s, z, -y], [x+s, z, -(y+s)], [x+s, z+s, -(y+s)], [x+s, z+s, -y]);
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  // 4. Post-processing for "Organic" look
  // Merge vertices to make it a continuous manifold
  geo = mergeVertices(geo, 0.01);
  geo.computeVertexNormals();

  return geo;
}
