import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// --- PÔVODNÉ VYHLADZOVACIE FUNKCIE (Taubin & Weighted Normals) ---

function applyTaubinSmoothing(geometry: THREE.BufferGeometry, iterations = 5): THREE.BufferGeometry {
  if (!geometry.index) return geometry;
  const pos = geometry.attributes.position;
  const posArr = pos.array as Float32Array;
  const idx = geometry.index.array;
  const vCount = pos.count;
  
  const adj = new Array(vCount);
  for (let i = 0; i < vCount; i++) adj[i] = new Set<number>();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i+1], c = idx[i+2];
    adj[a].add(b); adj[a].add(c);
    adj[b].add(a); adj[b].add(c);
    adj[c].add(a); adj[c].add(b);
  }

  const lambda = 0.5, mu = -0.53;
  const tempArr = new Float32Array(posArr.length);

  for (let iter = 0; iter < iterations; iter++) {
    // Lambda pass
    for (let i = 0; i < vCount; i++) {
      const neighbors = adj[i];
      if (neighbors.size === 0) {
        tempArr[i*3]=posArr[i*3]; tempArr[i*3+1]=posArr[i*3+1]; tempArr[i*3+2]=posArr[i*3+2];
        continue;
      }
      let sx=0, sy=0, sz=0;
      for (const n of neighbors) { sx += posArr[n*3]; sy += posArr[n*3+1]; sz += posArr[n*3+2]; }
      const invSize = 1.0 / neighbors.size;
      tempArr[i*3]   = posArr[i*3]   + lambda * (sx * invSize - posArr[i*3]);
      tempArr[i*3+1] = posArr[i*3+1] + lambda * (sy * invSize - posArr[i*3+1]);
      tempArr[i*3+2] = posArr[i*3+2] + lambda * (sz * invSize - posArr[i*3+2]);
    }
    posArr.set(tempArr);

    // Mu pass
    for (let i = 0; i < vCount; i++) {
      const neighbors = adj[i];
      if (neighbors.size === 0) continue;
      let sx=0, sy=0, sz=0;
      for (const n of neighbors) { sx += posArr[n*3]; sy += posArr[n*3+1]; sz += posArr[n*3+2]; }
      const invSize = 1.0 / neighbors.size;
      tempArr[i*3]   = posArr[i*3]   + mu * (sx * invSize - posArr[i*3]);
      tempArr[i*3+1] = posArr[i*3+1] + mu * (sy * invSize - posArr[i*3+1]);
      tempArr[i*3+2] = posArr[i*3+2] + mu * (sz * invSize - posArr[i*3+2]);
    }
    posArr.set(tempArr);
  }
  pos.needsUpdate = true;
  return geometry;
}

function computeAngleWeightedNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.index) { geometry.computeVertexNormals(); return geometry; }
  const posArr = geometry.attributes.position.array as Float32Array;
  const idx = geometry.index.array;
  const vCount = geometry.attributes.position.count;
  const normals = new Float32Array(vCount * 3);
  
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), bc = new THREE.Vector3(), cb = new THREE.Vector3();

  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i], ib = idx[i+1], ic = idx[i+2];
    vA.fromArray(posArr, ia * 3); vB.fromArray(posArr, ib * 3); vC.fromArray(posArr, ic * 3);
    ab.subVectors(vB, vA); ac.subVectors(vC, vA); bc.subVectors(vC, vB);
    cb.crossVectors(ab, ac); cb.normalize();
    
    const aLSq = bc.lengthSq(), bLSq = ac.lengthSq(), cLSq = ab.lengthSq();
    const aLen = Math.sqrt(aLSq), bLen = Math.sqrt(bLSq), cLen = Math.sqrt(cLSq);
    
    let angleA = 0, angleB = 0, angleC = 0;
    if (bLen > 0 && cLen > 0) angleA = Math.acos(Math.max(-1, Math.min(1, (bLSq + cLSq - aLSq) / (2 * bLen * cLen))));
    if (aLen > 0 && cLen > 0) angleB = Math.acos(Math.max(-1, Math.min(1, (aLSq + cLSq - bLSq) / (2 * aLen * cLen))));
    if (aLen > 0 && bLen > 0) angleC = Math.PI - angleA - angleB;
    
    normals[ia*3] += cb.x * angleA; normals[ia*3+1] += cb.y * angleA; normals[ia*3+2] += cb.z * angleA;
    normals[ib*3] += cb.x * angleB; normals[ib*3+1] += cb.y * angleB; normals[ib*3+2] += cb.z * angleB;
    normals[ic*3] += cb.x * angleC; normals[ic*3+1] += cb.y * angleC; normals[ic*3+2] += cb.z * angleC;
  }

  for (let i = 0; i < vCount; i++) {
    const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len > 0) { normals[i*3] /= len; normals[i*3+1] /= len; normals[i*3+2] /= len; }
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Fast Voxel-based Shell Reconstruction (Legacy Organic).
 */
export function reconstructSurface(points: {x:number, y:number, z:number}[], voxelSize = 0.5, isAccurate = false, organicLevel = 5): THREE.BufferGeometry {
  if (points.length < 10) return new THREE.BufferGeometry();

  // ... (vypocet bounds zostava rovnaky)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }

  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
  const maxRes = 150;
  let activeVoxelSize = voxelSize;
  if (dx / activeVoxelSize > maxRes) activeVoxelSize = dx / maxRes;
  if (dy / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dy / maxRes);
  if (dz / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dz / maxRes);

  const getVKey = (ix: number, iy: number, iz: number) => {
    return BigInt(ix + 1000) | (BigInt(iy + 1000) << 20n) | (BigInt(iz + 1000) << 40n);
  };

  const occupied = new Set<bigint>();
  for (const p of points) {
    const ix = Math.floor((p.x - minX) / activeVoxelSize);
    const iy = Math.floor((p.y - minY) / activeVoxelSize);
    const iz = Math.floor((p.z - minZ) / activeVoxelSize);
    occupied.add(getVKey(ix, iy, iz));
  }

  // --- KROK: Vyplnenie malých dier (Dilation) ---
  // Sila dilatácie závisí od organicLevel (nad 7 robíme 2 kroky dilatácie)
  if (!isAccurate && organicLevel > 0) {
    const dilationSteps = organicLevel > 7 ? 2 : 1;
    for (let step = 0; step < dilationSteps; step++) {
      const toAdd = new Set<bigint>();
      for (const vKey of occupied) {
        const [ix, iy, iz] = [
          Number(vKey & 0xFFFFFn) - 1000,
          Number((vKey >> 20n) & 0xFFFFFn) - 1000,
          Number((vKey >> 40n) & 0xFFFFFn) - 1000
        ];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              toAdd.add(getVKey(ix + dx, iy + dy, iz + dz));
            }
          }
        }
      }
      for (const vKey of toAdd) occupied.add(vKey);
    }
  }

  const resX = Math.ceil(dx / activeVoxelSize), resY = Math.ceil(dy / activeVoxelSize), resZ = Math.ceil(dz / activeVoxelSize);
  const exterior = new Set<bigint>();
  const queue: [number, number, number][] = [];
  
  const addExterior = (ix: number, iy: number, iz: number) => {
    const key = getVKey(ix, iy, iz);
    if (!exterior.has(key)) {
      exterior.add(key);
      queue.push([ix, iy, iz]);
    }
  };

  for (let x = -1; x <= resX; x++) {
    for (let y = -1; y <= resY; y++) {
      addExterior(x, y, -1); addExterior(x, y, resZ);
    }
  }
  for (let x = -1; x <= resX; x++) {
    for (let z = 0; z < resZ; z++) {
      addExterior(x, -1, z); addExterior(x, resY, z);
    }
  }
  for (let y = 0; y < resY; y++) {
    for (let z = 0; z < resZ; z++) {
      addExterior(-1, y, z); addExterior(resX, y, z);
    }
  }

  while (queue.length > 0) {
    const [ix, iy, iz] = queue.pop()!;
    for (const [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
      const nx = ix + dx, ny = iy + dy, nz = iz + dz;
      if (nx >= -1 && nx <= resX && ny >= -1 && ny <= resY && nz >= -1 && nz <= resZ) {
        if (!occupied.has(getVKey(nx, ny, nz)) && !exterior.has(getVKey(nx, ny, nz))) {
          addExterior(nx, ny, nz);
        }
      }
    }
  }

  const vertices: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<bigint, number>();

  const getVertex = (ix: number, iy: number, iz: number) => {
    const key = getVKey(ix, iy, iz);
    if (vertexMap.has(key)) return vertexMap.get(key)!;
    const idx = vertices.length / 3;
    vertices.push(minX + ix * activeVoxelSize, minY + iy * activeVoxelSize, minZ + iz * activeVoxelSize);
    vertexMap.set(key, idx);
    return idx;
  };

  for (let ix = 0; ix <= resX; ix++) {
    for (let iy = 0; iy <= resY; iy++) {
      for (let iz = 0; iz <= resZ; iz++) {
        if (occupied.has(getVKey(ix, iy, iz))) {
          for (const [dx, dy, dz, f] of [[1,0,0,0], [-1,0,0,1], [0,1,0,2], [0,-1,0,3], [0,0,1,4], [0,0,-1,5]]) {
            if (exterior.has(getVKey(ix + dx, iy + dy, iz + dz))) {
              let i1, i2, i3, i4;
              if (f === 0) { i1=[1,0,0]; i2=[1,1,0]; i3=[1,1,1]; i4=[1,0,1]; }
              else if (f === 1) { i1=[0,0,0]; i2=[0,0,1]; i3=[0,1,1]; i4=[0,1,0]; }
              else if (f === 2) { i1=[0,1,0]; i2=[0,1,1]; i3=[1,1,1]; i4=[1,1,0]; }
              else if (f === 3) { i1=[0,0,0]; i2=[1,0,0]; i3=[1,0,1]; i4=[0,0,1]; }
              else if (f === 4) { i1=[0,0,1]; i2=[1,0,1]; i3=[1,1,1]; i4=[0,1,1]; }
              else { i1=[0,0,0]; i2=[0,1,0]; i3=[1,1,0]; i4=[1,0,0]; }
              const a = getVertex(ix+i1[0], iy+i1[1], iz+i1[2]);
              const b = getVertex(ix+i2[0], iy+i2[1], iz+i2[2]);
              const c = getVertex(ix+i3[0], iy+i3[1], iz+i3[2]);
              const d = getVertex(ix+i4[0], iy+i4[1], iz+i4[2]);
              indices.push(a, b, c, a, c, d);
            }
          }
        }
      }
    }
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);

  // 1. Zvariť vrcholy
  geo = mergeVertices(geo, 0.001);

  if (isAccurate) {
    // --- TRIANGLE MESH (Accurate) ---
    // Ponechávame Taubin pre presnosť (toto bolo označené ako OK)
    geo = applyTaubinSmoothing(geo, 3);
  } else {
    // --- ORGANICKÝ / VYHLADENÝ (Silk/Fabric) ---
    // Použijeme čistý Laplacian so silným napätím (0.6), aby sme dosiahli efekt napnutej látky
    const pos = geo.attributes.position.array as Float32Array;
    const idx = geo.index!.array;
    const vCount = geo.attributes.position.count;
    
    // Počet iterácií výrazne zvýšený pre "silk" efekt (minimum 15, maximum 45)
    const silkIterations = 15 + (organicLevel * 3);
    
    for (let it = 0; it < silkIterations; it++) {
      const newPos = new Float32Array(pos.length);
      const sums = new Float32Array(pos.length);
      const counts = new Uint32Array(vCount);
      
      for (let i = 0; i < idx.length; i += 3) {
        const i1 = idx[i], i2 = idx[i+1], i3 = idx[i+2];
        const add = (a: number, b: number) => {
          sums[a*3]+=pos[b*3]; sums[a*3+1]+=pos[b*3+1]; sums[a*3+2]+=pos[b*3+2];
          counts[a]++;
        };
        add(i1,i2); add(i1,i3); add(i2,i1); add(i2,i3); add(i3,i1); add(i3,i2);
      }
      
      for (let i = 0; i < vCount; i++) {
        if (counts[i] > 0) {
          // Napätie 0.6 pre ešte hladší efekt "hodvábu"
          newPos[i*3] = pos[i*3] + (sums[i*3]/counts[i] - pos[i*3]) * 0.6;
          newPos[i*3+1] = pos[i*3+1] + (sums[i*3+1]/counts[i] - pos[i*3+1]) * 0.6;
          newPos[i*3+2] = pos[i*3+2] + (sums[i*3+2]/counts[i] - pos[i*3+2]) * 0.6;
        } else {
          newPos[i*3]=pos[i*3]; newPos[i*3+1]=pos[i*3+1]; newPos[i*3+2]=pos[i*3+2];
        }
      }
      pos.set(newPos);
    }
  }

  // 3. Poctivé vážené normály (Silk efekt)
  geo = computeAngleWeightedNormals(geo);

  return geo;
}

/**
 * Professional-grade Surface Nets implementation (v3).
 * Optimized for both LiDAR (dense) and LOX (sparse) data.
 */
export function reconstructSurfaceNet(points: Float32Array | {x:number,y:number,z:number}[], voxelSize = 0.5): THREE.BufferGeometry {
  const pCount = points instanceof Float32Array ? points.length / 3 : points.length;
  if (pCount < 10) return new THREE.BufferGeometry();

  // 1. Bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  if (points instanceof Float32Array) {
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i], y = points[i+1], z = points[i+2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  } else {
    for (const p of points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
  }

  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
  const maxRes = 150;
  let activeVoxelSize = voxelSize;
  if (dx / activeVoxelSize > maxRes) activeVoxelSize = dx / maxRes;
  if (dy / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dy / maxRes);
  if (dz / activeVoxelSize > maxRes) activeVoxelSize = Math.max(activeVoxelSize, dz / maxRes);

  const getVKey = (ix: number, iy: number, iz: number) => {
    return BigInt(ix + 1000) | (BigInt(iy + 1000) << 20n) | (BigInt(iz + 1000) << 40n);
  };
  const fromVKey = (key: bigint) => {
    return [Number(key & 0xFFFFFn) - 1000, Number((key >> 20n) & 0xFFFFFn) - 1000, Number((key >> 40n) & 0xFFFFFn) - 1000];
  };

  // 2. Voxelization and Centroids
  const voxelSums = new Map<bigint, {x:number, y:number, z:number, count:number}>();
  if (points instanceof Float32Array) {
    for (let i = 0; i < points.length; i += 3) {
      const gx = Math.floor((points[i] - minX) / activeVoxelSize);
      const gy = Math.floor((points[i+1] - minY) / activeVoxelSize);
      const gz = Math.floor((points[i+2] - minZ) / activeVoxelSize);
      const key = getVKey(gx, gy, gz);
      let vs = voxelSums.get(key);
      if (!vs) { vs = { x:0, y:0, z:0, count:0 }; voxelSums.set(key, vs); }
      vs.x += points[i]; vs.y += points[i+1]; vs.z += points[i+2];
      vs.count++;
    }
  } else {
    for (const p of points) {
      const gx = Math.floor((p.x - minX) / activeVoxelSize);
      const gy = Math.floor((p.y - minY) / activeVoxelSize);
      const gz = Math.floor((p.z - minZ) / activeVoxelSize);
      const key = getVKey(gx, gy, gz);
      let vs = voxelSums.get(key);
      if (!vs) { vs = { x:0, y:0, z:0, count:0 }; voxelSums.set(key, vs); }
      vs.x += p.x; vs.y += p.y; vs.z += p.z;
      vs.count++;
    }
  }

  // 3. Shell Discovery (Exterior-in)
  const resX = Math.ceil(dx / activeVoxelSize), resY = Math.ceil(dy / activeVoxelSize), resZ = Math.ceil(dz / activeVoxelSize);
  const shell = new Set<bigint>(voxelSums.keys());
  
  // 4. Dual Grid Corner Averaging (Corner-Grid Triangulation)
  const vertexIndices = new Map<bigint, number>();
  const finalVertices: number[] = [];
  const finalIndices: number[] = [];

  const getCornerVertex = (gx: number, gy: number, gz: number) => {
    const key = getVKey(gx, gy, gz);
    if (vertexIndices.has(key)) return vertexIndices.get(key)!;

    let wx = 0, wy = 0, wz = 0, totalW = 0;
    for (let ddx = -1; ddx <= 0; ddx++) {
      for (let ddy = -1; ddy <= 0; ddy++) {
        for (let ddz = -1; ddz <= 0; ddz++) {
          const vs = voxelSums.get(getVKey(gx + ddx, gy + ddy, gz + ddz));
          if (vs) {
            const w = vs.count;
            wx += (vs.x / vs.count) * w; wy += (vs.y / vs.count) * w; wz += (vs.z / vs.count) * w;
            totalW += w;
          }
        }
      }
    }

    const idx = finalVertices.length / 3;
    if (totalW > 0) {
      finalVertices.push(wx / totalW, wy / totalW, wz / totalW);
    } else {
      finalVertices.push(minX + gx * activeVoxelSize, minY + gy * activeVoxelSize, minZ + gz * activeVoxelSize);
    }
    vertexIndices.set(key, idx);
    return idx;
  };

  for (const vKey of shell) {
    const [gx, gy, gz] = fromVKey(vKey);
    for (const [dx, dy, dz, axis] of [[1,0,0,0], [0,1,0,1], [0,0,1,2]]) {
      const neighborKey = getVKey(gx + dx, gy + dy, gz + dz);
      if (!shell.has(neighborKey)) {
        let i1, i2, i3, i4;
        if (axis === 0) { i1=[1,0,0]; i2=[1,1,0]; i3=[1,1,1]; i4=[1,0,1]; }
        else if (axis === 1) { i1=[0,1,0]; i2=[0,1,1]; i3=[1,1,1]; i4=[1,1,0]; }
        else { i1=[0,0,1]; i2=[1,0,1]; i3=[1,1,1]; i4=[0,1,1]; }
        const a = getCornerVertex(gx+i1[0], gy+i1[1], gz+i1[2]);
        const b = getCornerVertex(gx+i2[0], gy+i2[1], gz+i2[2]);
        const c = getCornerVertex(gx+i3[0], gy+i3[1], gz+i3[2]);
        const d = getCornerVertex(gx+i4[0], gy+i4[1], gz+i4[2]);
        finalIndices.push(a, b, c, a, c, d);
      }
    }
    // Inward check
    for (const [dx, dy, dz, axis] of [[-1,0,0,0], [0,-1,0,1], [0,0,-1,2]]) {
      const neighborKey = getVKey(gx + dx, gy + dy, gz + dz);
      if (!shell.has(neighborKey)) {
        let i1, i2, i3, i4;
        if (axis === 0) { i1=[0,0,0]; i2=[0,0,1]; i3=[0,1,1]; i4=[0,1,0]; }
        else if (axis === 1) { i1=[0,0,0]; i2=[1,0,0]; i3=[1,0,1]; i4=[0,0,1]; }
        else { i1=[0,0,0]; i2=[0,1,0]; i3=[1,1,0]; i4=[1,0,0]; }
        const a = getCornerVertex(gx+i1[0], gy+i1[1], gz+i1[2]);
        const b = getCornerVertex(gx+i2[0], gy+i2[1], gz+i2[2]);
        const c = getCornerVertex(gx+i3[0], gy+i3[1], gz+i3[2]);
        const d = getCornerVertex(gx+i4[0], gy+i4[1], gz+i4[2]);
        finalIndices.push(a, b, c, a, c, d);
      }
    }
  }

  if (finalVertices.length === 0) return new THREE.BufferGeometry();
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(finalVertices, 3));
  geo.setIndex(finalIndices);
  geo = mergeVertices(geo, 0.001);

  // 6. Taubin Smoothing (Volume-preserving)
  const pos = geo.attributes.position.array as Float32Array;
  const idx = geo.index?.array || Array.from({ length: pos.length / 3 }, (_, i) => i);
  const lambda = 0.5, mu = -0.53;
  for (let it = 0; it < 3; it++) {
    for (const step of [lambda, mu]) {
      const newPos = new Float32Array(pos.length);
      const sum = new Float32Array(pos.length), cnt = new Uint32Array(pos.length / 3);
      for (let i = 0; i < idx.length; i += 3) {
        const i1=idx[i], i2=idx[i+1], i3=idx[i+2];
        const add = (a:number,b:number) => { sum[a*3]+=pos[b*3]; sum[a*3+1]+=pos[b*3+1]; sum[a*3+2]+=pos[b*3+2]; cnt[a]++; };
        add(i1,i2); add(i1,i3); add(i2,i1); add(i2,i3); add(i3,i1); add(i3,i2);
      }
      for (let i = 0; i < pos.length / 3; i++) {
        if (cnt[i] > 0) {
          newPos[i*3] = pos[i*3] + (sum[i*3]/cnt[i] - pos[i*3])*step;
          newPos[i*3+1] = pos[i*3+1] + (sum[i*3+1]/cnt[i] - pos[i*3+1])*step;
          newPos[i*3+2] = pos[i*3+2] + (sum[i*3+2]/cnt[i] - pos[i*3+2])*step;
        } else {
          newPos[i*3]=pos[i*3]; newPos[i*3+1]=pos[i*3+1]; newPos[i*3+2]=pos[i*3+2];
        }
      }
      pos.set(newPos);
    }
  }

  geo.computeVertexNormals();
  // @ts-ignore
  geo.computeBoundsTree();
  return geo;
}
