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

  // 2. Voxelize using a Map for packing (saves memory and avoids giant arrays)
  const occupied = new Set<number>();
  for (const p of points) {
    const ix = Math.floor((p.x - minX) / activeVoxelSize);
    const iy = Math.floor((p.y - minY) / activeVoxelSize);
    const iz = Math.floor((p.z - minZ) / activeVoxelSize);
    occupied.add(ix + iy * 2000 + iz * 4000000);
  }

  // 3. PERFORMANCE OPTIMIZATION: "Outer Shell Only" via Flood Fill
  // Identify which empty voxels are "outside" the model.
  // We start from the corners and fill all reachable empty space.
  const resX = Math.ceil(dx / activeVoxelSize);
  const resY = Math.ceil(dy / activeVoxelSize);
  const resZ = Math.ceil(dz / activeVoxelSize);
  
  const exterior = new Set<number>();
  const queue: [number, number, number][] = [];
  
  const addExterior = (ix: number, iy: number, iz: number) => {
    const key = ix + iy * 2000 + iz * 4000000;
    if (!exterior.has(key)) {
      exterior.add(key);
      queue.push([ix, iy, iz]);
    }
  };

  // Start from all boundary faces of the bounding box (with 1 voxel padding)
  for (let x = -1; x <= resX; x++) {
    for (let y = -1; y <= resY; y++) {
      addExterior(x, y, -1);
      addExterior(x, y, resZ);
    }
  }
  for (let x = -1; x <= resX; x++) {
    for (let z = 0; z < resZ; z++) {
      addExterior(x, -1, z);
      addExterior(x, resY, z);
    }
  }
  for (let y = 0; y < resY; y++) {
    for (let z = 0; z < resZ; z++) {
      addExterior(-1, y, z);
      addExterior(resX, y, z);
    }
  }

  const isOccupied = (ix: number, iy: number, iz: number) => {
    if (ix < -1 || ix > resX || iy < -1 || iy > resY || iz < -1 || iz > resZ) return false;
    return occupied.has(ix + iy * 2000 + iz * 4000000);
  };

  while (queue.length > 0) {
    const [ix, iy, iz] = queue.pop()!; // pop is O(1)

    // Neighbors
    const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
    for (const [dx, dy, dz] of neighbors) {
      const nx = ix + dx, ny = iy + dy, nz = iz + dz;
      if (nx >= -1 && nx <= resX && ny >= -1 && ny <= resY && nz >= -1 && nz <= resZ) {
        if (!isOccupied(nx, ny, nz)) {
          addExterior(nx, ny, nz);
        }
      }
    }
  }

  // 4. Generate Cube Faces for occupied voxels ONLY if they touch EXTERIOR empty space
  const vertices: number[] = [];
  const isExterior = (ix: number, iy: number, iz: number) => {
    return exterior.has(ix + iy * 2000 + iz * 4000000);
  };

  for (const key of occupied) {
    const ix = key % 2000;
    const iy = Math.floor((key % 4000000) / 2000);
    const iz = Math.floor(key / 4000000);

    const x = minX + ix * activeVoxelSize;
    const y = minY + iy * activeVoxelSize;
    const z = minZ + iz * activeVoxelSize;
    const s = activeVoxelSize;

    const addQuad = (v1: number[], v2: number[], v3: number[], v4: number[]) => {
      vertices.push(...v1, ...v2, ...v3, ...v1, ...v3, ...v4);
    };

    // Only add faces that touch the "exterior" world
    if (isExterior(ix, iy, iz + 1)) addQuad([x, z+s, -y], [x+s, z+s, -y], [x+s, z+s, -(y+s)], [x, z+s, -(y+s)]);
    if (isExterior(ix, iy, iz - 1)) addQuad([x, z, -(y+s)], [x+s, z, -(y+s)], [x+s, z, -y], [x, z, -y]);
    if (isExterior(ix, iy - 1, iz)) addQuad([x, z, -y], [x+s, z, -y], [x+s, z+s, -y], [x, z+s, -y]);
    if (isExterior(ix, iy + 1, iz)) addQuad([x+s, z, -(y+s)], [x, z, -(y+s)], [x, z+s, -(y+s)], [x+s, z+s, -(y+s)]);
    if (isExterior(ix - 1, iy, iz)) addQuad([x, z, -(y+s)], [x, z, -y], [x, z+s, -y], [x, z+s, -(y+s)]);
    if (isExterior(ix + 1, iy, iz)) addQuad([x+s, z, -y], [x+s, z, -(y+s)], [x+s, z+s, -(y+s)], [x+s, z+s, -y]);
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo = mergeVertices(geo, 0.01);
  geo.computeVertexNormals();

  return geo;
}
