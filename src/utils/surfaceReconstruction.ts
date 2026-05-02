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

  const isExterior = (ix: number, iy: number, iz: number) => {
    return exterior.has(ix + iy * 2000 + iz * 4000000);
  };

  // 4. Generate Smooth Mesh (Dual-like approach)
  const finalVertices: number[] = [];
  
  // Calculate centroids for occupied voxels efficiently O(N)
  const centroids = new Map<number, THREE.Vector3>();
  const sums = new Map<number, { x: number, y: number, z: number, count: number }>();
  
  for (const p of points) {
    const ix = Math.floor((p.x - minX) / activeVoxelSize);
    const iy = Math.floor((p.y - minY) / activeVoxelSize);
    const iz = Math.floor((p.z - minZ) / activeVoxelSize);
    const key = ix + iy * 2000 + iz * 4000000;
    
    let s = sums.get(key);
    if (!s) {
      s = { x: 0, y: 0, z: 0, count: 0 };
      sums.set(key, s);
    }
    s.x += p.x; s.y += p.z; s.z += -p.y;
    s.count++;
  }

  sums.forEach((s, key) => {
    centroids.set(key, new THREE.Vector3(s.x / s.count, s.y / s.count, s.z / s.count));
  });

  // To avoid blockiness, we create vertices at GRID CORNERS
  // Each corner is shared by 8 voxels.
  const cornerCache = new Map<string, number[]>();
  const getCornerVertex = (gx: number, gy: number, gz: number) => {
    const cid = `${gx},${gy},${gz}`;
    if (cornerCache.has(cid)) return cornerCache.get(cid)!;

    // Average centroids of occupied voxels touching this corner
    let sx=0, sy=0, sz=0, c=0;
    for (let dx=-1; dx<=0; dx++) {
      for (let dy=-1; dy<=0; dy++) {
        for (let dz=-1; dz<=0; dz++) {
          const vKey = (gx+dx) + (gy+dy)*2000 + (gz+dz)*4000000;
          const cent = centroids.get(vKey);
          if (cent) { sx += cent.x; sy += cent.y; sz += cent.z; c++; }
        }
      }
    }
    
    let res: number[];
    if (c > 0) {
      res = [sx/c, sy/c, sz/c];
    } else {
      res = [minX + gx * activeVoxelSize, gz * activeVoxelSize, -(minY + gy * activeVoxelSize)];
    }
    cornerCache.set(cid, res);
    return res;
  };

  const addQuad = (v1: number[], v2: number[], v3: number[], v4: number[]) => {
    finalVertices.push(...v1, ...v2, ...v3, ...v1, ...v3, ...v4);
  };

  for (const key of occupied) {
    const ix = key % 2000;
    const iy = Math.floor((key % 4000000) / 2000);
    const iz = Math.floor(key / 4000000);

    // Faces only if touching exterior
    if (isExterior(ix, iy, iz + 1)) addQuad(getCornerVertex(ix, iy, iz+1), getCornerVertex(ix+1, iy, iz+1), getCornerVertex(ix+1, iy+1, iz+1), getCornerVertex(ix, iy+1, iz+1));
    if (isExterior(ix, iy, iz - 1)) addQuad(getCornerVertex(ix, iy+1, iz), getCornerVertex(ix+1, iy+1, iz), getCornerVertex(ix+1, iy, iz), getCornerVertex(ix, iy, iz));
    if (isExterior(ix, iy - 1, iz)) addQuad(getCornerVertex(ix, iy, iz), getCornerVertex(ix+1, iy, iz), getCornerVertex(ix+1, iy, iz+1), getCornerVertex(ix, iy, iz+1));
    if (isExterior(ix, iy + 1, iz)) addQuad(getCornerVertex(ix+1, iy+1, iz), getCornerVertex(ix, iy+1, iz), getCornerVertex(ix, iy+1, iz+1), getCornerVertex(ix+1, iy+1, iz+1));
    if (isExterior(ix - 1, iy, iz)) addQuad(getCornerVertex(ix, iy+1, iz), getCornerVertex(ix, iy, iz), getCornerVertex(ix, iy, iz+1), getCornerVertex(ix, iy+1, iz+1));
    if (isExterior(ix + 1, iy, iz)) addQuad(getCornerVertex(ix+1, iy, iz), getCornerVertex(ix+1, iy+1, iz), getCornerVertex(ix+1, iy+1, iz+1), getCornerVertex(ix+1, iy, iz+1));
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(finalVertices, 3));
  geo = mergeVertices(geo, 0.0001);
  geo.computeVertexNormals();
  return geo;
}
