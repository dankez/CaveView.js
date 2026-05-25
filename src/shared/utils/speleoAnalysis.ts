import * as THREE from 'three';
import type { ParsedCave, Segment, Lrud, Vec3 } from '../types';

export interface ProfileResult {
  lrud: Lrud;
  area: number;     // cross-section area in m^2
  volume: number;   // estimated physical volume in m^3
  length: number;   // length of the segment
  profilePoints: { x: number; y: number }[]; // 2D vertices for drawing cross-section
  isEstimated: boolean; // true if computed via 3D geometry fallback
}

export interface LiDARAnomaly {
  id: string;
  type: 'chimney' | 'window' | 'fracture';
  pos: Vec3;
  size: number;        // Height for chimney, width for window
  pointsCount: number;
  confidence: number;  // 0 to 100
  description: string;
  normal?: Vec3;       // plane normal for fractures
}

/**
 * Calculates a dynamic 2D cross-section and volume for a cave segment.
 * If the segment has no native LRUD, it dynamically queries surrounding 3D scraps/points to estimate.
 */
export function calculateVolumeAndProfile(segment: Segment, cave: ParsedCave): ProfileResult {
  const p1 = new THREE.Vector3(segment.from.x, segment.from.y, segment.from.z);
  const p2 = new THREE.Vector3(segment.to.x, segment.to.y, segment.to.z);
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const length = dir.length();
  dir.normalize();

  // 1. Try native LRUD from Therion/LOX
  const fromL = segment.fromLrud;
  const toL = segment.toLrud;

  let lrud: Lrud = { l: 0, r: 0, u: 0, d: 0 };
  let isEstimated = false;

  if (fromL && toL && (fromL.l || fromL.r || fromL.u || fromL.d || toL.l || toL.r || toL.u || toL.d)) {
    // Average from and to LRUD values
    lrud = {
      l: (fromL.l + toL.l) / 2,
      r: (fromL.r + toL.r) / 2,
      u: (fromL.u + toL.u) / 2,
      d: (fromL.d + toL.d) / 2,
    };
  } else {
    // 2. Fallback: Estimate LRUD using 3D scraps mesh or LiDAR points
    isEstimated = true;
    lrud = estimateLRUDFromGeometry(p1, p2, dir, cave);
  }

  // Sanitize values to prevent 0 or division errors
  if (lrud.l <= 0.05) lrud.l = 1.0;
  if (lrud.r <= 0.05) lrud.r = 1.0;
  if (lrud.u <= 0.05) lrud.u = 1.2;
  if (lrud.d <= 0.05) lrud.d = 0.8;

  // Eliptical area approximation (most caves are rounded or oval-ish)
  // Width = Left + Right, Height = Up + Down
  const w = lrud.l + lrud.r;
  const h = lrud.u + lrud.d;
  const area = Math.PI * (w / 2) * (h / 2); // m^2
  const volume = area * length;             // m^3

  // Create 2D profile coordinates for visual representation
  // Centered at (0, 0)
  const profilePoints = [
    { x: -lrud.l, y: -lrud.d }, // Bottom Left
    { x: -lrud.l, y: 0 },       // Mid Left
    { x: -lrud.l, y: lrud.u },  // Top Left
    { x: 0, y: lrud.u },        // Top Mid
    { x: lrud.r, y: lrud.u },   // Top Right
    { x: lrud.r, y: 0 },        // Mid Right
    { x: lrud.r, y: -lrud.d },  // Bottom Right
    { x: 0, y: -lrud.d },       // Bottom Mid
    { x: -lrud.l, y: -lrud.d }, // Close polygon
  ];

  return { lrud, area, volume, length, profilePoints, isEstimated };
}

/**
 * Estimates Left/Right/Up/Down dimensions by projecting raycasts to 3D mesh or LiDAR points
 */
function estimateLRUDFromGeometry(p1: THREE.Vector3, p2: THREE.Vector3, dir: THREE.Vector3, cave: ParsedCave): Lrud {
  const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

  // Determine orthogonal vectors for Left/Right and Up/Down
  // Default up vector
  const defaultUp = new THREE.Vector3(0, 0, 1);
  if (Math.abs(dir.dot(defaultUp)) > 0.95) {
    // If segment is vertical, use alternative default
    defaultUp.set(0, 1, 0);
  }
  const rightVec = new THREE.Vector3().crossVectors(dir, defaultUp).normalize();
  const upVec = new THREE.Vector3().crossVectors(rightVec, dir).normalize();

  // Default values
  let l = 1.5, r = 1.5, u = 2.0, d = 1.0;

  // Fallback A: Use Scraps (triangulated mesh) if available
  if (cave.scraps && cave.scrapCount > 0) {
    const directions = {
      l: rightVec.clone().multiplyScalar(-1),
      r: rightVec.clone(),
      u: upVec.clone(),
      d: upVec.clone().multiplyScalar(-1)
    };

    l = raycastScraps(center, directions.l, cave.scraps) ?? l;
    r = raycastScraps(center, directions.r, cave.scraps) ?? r;
    u = raycastScraps(center, directions.u, cave.scraps) ?? u;
    d = raycastScraps(center, directions.d, cave.scraps) ?? d;
  }
  // Fallback B: Use LiDAR points if available
  else if (cave.points && cave.pointCount > 0) {
    const directions = {
      l: rightVec.clone().multiplyScalar(-1),
      r: rightVec.clone(),
      u: upVec.clone(),
      d: upVec.clone().multiplyScalar(-1)
    };

    l = estimateDistanceToPointCloud(center, directions.l, cave.points, cave.pointCount) ?? l;
    r = estimateDistanceToPointCloud(center, directions.r, cave.points, cave.pointCount) ?? r;
    u = estimateDistanceToPointCloud(center, directions.u, cave.points, cave.pointCount) ?? u;
    d = estimateDistanceToPointCloud(center, directions.d, cave.points, cave.pointCount) ?? d;
  }

  return { l, r, u, d };
}

/** Raycast mesh scraps in a specific direction */
function raycastScraps(origin: THREE.Vector3, dir: THREE.Vector3, scraps: any[]): number | null {
  let minDist = Infinity;
  const ray = new THREE.Ray(origin, dir);

  // Traverse scraps triangles
  for (const scrap of scraps) {
    const v = scrap.vertices;
    for (const face of scrap.faces) {
      if (face.length < 3) continue;
      const a = new THREE.Vector3(v[face[0]].x, v[face[0]].y, v[face[0]].z);
      const b = new THREE.Vector3(v[face[1]].x, v[face[1]].y, v[face[1]].z);
      const c = new THREE.Vector3(v[face[2]].x, v[face[2]].y, v[face[2]].z);

      const target = new THREE.Vector3();
      const hit = ray.intersectTriangle(a, b, c, true, target);
      if (hit) {
        const dist = origin.distanceTo(target);
        if (dist < minDist) minDist = dist;
      }
    }
  }
  return minDist !== Infinity ? minDist : null;
}

/** Estimates distance to a point cloud in a specific direction with a small angular tolerance */
function estimateDistanceToPointCloud(origin: THREE.Vector3, dir: THREE.Vector3, points: Float32Array, pointCount: number): number | null {
  let minDist = Infinity;
  const maxDistance = 25.0; // boundary limit
  const maxAngleTolerance = 0.15; // rad (approx 8 degrees)

  for (let i = 0; i < pointCount; i++) {
    const px = points[i*3];
    const py = points[i*3+1];
    const pz = points[i*3+2];

    const toPt = new THREE.Vector3(px - origin.x, py - origin.y, pz - origin.z);
    const dist = toPt.length();
    if (dist > maxDistance || dist < 0.1) continue;

    toPt.normalize();
    const angle = toPt.angleTo(dir);
    if (angle < maxAngleTolerance) {
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist !== Infinity ? minDist : null;
}

/**
 * LiDAR anomaly detection — fyzikálne správny model pre husté skany (Erna, 6M+ bodov).
 *
 * Princíp detekcie komínov:
 *   Jaskyniar nesie skener cca 1.0–1.5 m nad dnom. Trajektória teda odráža pohyb po dne.
 *   Komín = voxelový stĺpec, kde výška k hornej stene je VÝRAZNE VÄČŠIA ako mediánová výška
 *   v okolí (5×5 voxelová plocha). Normálny strop sa NEDETEKUJE.
 *
 * Princíp detekcie okien:
 *   Vzor STENA→VOID→STENA v horizontálnom smere, pričom VOID musí byť aspoň 1.5 m
 *   a STENA za ním musí byť hustejšia ako okolie (nová chodba, nie len hluk).
 */
export function analyzeLiDARAnomalies(cave: ParsedCave, onStatus?: (msg: string) => void): LiDARAnomaly[] {
  if (!cave.points || cave.pointCount === 0) return [];

  const points = cave.points;
  const count = cave.pointCount;
  const anomalies: LiDARAnomaly[] = [];

  // ── 1. Voxelový grid 1.0 m ──────────────────────────────────────────────
  const VS = 1.0; // voxel size in meters
  const grid = new Map<string, number>();

  let minZ = Infinity, maxZ = -Infinity;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    const px = points[i * 3];
    const py = points[i * 3 + 1];
    const pz = points[i * 3 + 2];
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
    if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
    const key = `${Math.floor(px/VS)},${Math.floor(py/VS)},${Math.floor(pz/VS)}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  // Adaptívny prah hustoty — závisí od priemernej hustoty skanu
  const totalVoxels = grid.size;
  const avgDensity = count / Math.max(totalVoxels, 1);
  // Voxel sa považuje za "plný" ak má aspoň 30% priemernej hustoty
  const WALL_THRESH = Math.max(8, avgDensity * 0.3);

  const isWall = (ix: number, iy: number, iz: number) =>
    (grid.get(`${ix},${iy},${iz}`) || 0) >= WALL_THRESH;

  // ── 2. Trajektória skenera ───────────────────────────────────────────────
  const trajectory: { x: number; y: number; z: number }[] = [];
  if (cave.segments && cave.segments.length > 0) {
    cave.segments.forEach(s => {
      if (s.type === 'cave') {
        trajectory.push(s.from);
        trajectory.push(s.to);
      }
    });
  }

  // Fallback: odhadni trajektóriu z dolného percentilu Z v XY stĺpcoch
  if (trajectory.length === 0) {
    const columnFloor = new Map<string, number>();
    for (let i = 0; i < count; i += 6) {
      const px = points[i * 3], py = points[i * 3 + 1], pz = points[i * 3 + 2];
      const key = `${Math.round(px / 2)},${Math.round(py / 2)}`;
      if (!columnFloor.has(key) || pz < columnFloor.get(key)!) {
        columnFloor.set(key, pz);
      }
    }
    columnFloor.forEach((floorZ, key) => {
      const [cx, cy] = key.split(',').map(Number);
      trajectory.push({ x: cx * 2, y: cy * 2, z: floorZ + 1.3 });
    });
  }

  if (trajectory.length === 0) trajectory.push({ x: 0, y: 0, z: minZ + 1.3 });

  // ── 3. Pomocná funkcia: výška stropu nad bodom ───────────────────────────
  const ceilHeight = (ix: number, iy: number, izFloor: number, maxUp: number): number => {
    for (let dz = 1; dz <= maxUp; dz++) {
      if (isWall(ix, iy, izFloor + dz)) return dz;
    }
    return maxUp; // otvorené hore — maxUP
  };

  // ── 4. Median výšky stropu pre XY kolóny ────────────────────────────────
  // Pre každý voxelový stĺpec (ix, iy) vypočítame výšku stropu.
  // Komín = stĺpec, kde výška je výrazne väčšia ako medián susedov (5×5 okno).
  if (onStatus) onStatus('Mapujem výšky stropu...');

  const MAX_UP = Math.ceil((maxZ - minZ) / VS) + 2;
  type ColKey = string;
  const colCeil = new Map<ColKey, number>(); // "ix,iy" -> ceil distance in voxels

  trajectory.forEach(tp => {
    const tx = Math.floor(tp.x / VS);
    const ty = Math.floor(tp.y / VS);
    const tz = Math.floor(tp.z / VS);
    if (!colCeil.has(`${tx},${ty}`)) {
      colCeil.set(`${tx},${ty}`, ceilHeight(tx, ty, tz, MAX_UP));
    }
  });

  // ── 5. Detekcia KOMÍNOV — porovnanie voči lokálnemu mediánu ─────────────
  if (onStatus) onStatus('Hľadám komíny...');
  let chimneyIdx = 1;
  const usedPositions: { x: number; y: number; z: number; type: string }[] = [];
  const MIN_SEPARATION = 10.0; // min 10 m medzi anomáliami rovnakého typu

  const tooClose = (x: number, y: number, z: number, type: string) =>
    usedPositions.some(u => u.type === type &&
      Math.sqrt((u.x-x)**2 + (u.y-y)**2 + (u.z-z)**2) < MIN_SEPARATION);

  colCeil.forEach((myH, key) => {
    const [ix, iy] = key.split(',').map(Number);

    // Collect neighbour ceiling heights (5×5 window)
    const neighbours: number[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const h = colCeil.get(`${ix+dx},${iy+dy}`);
        if (h !== undefined) neighbours.push(h);
      }
    }
    if (neighbours.length < 4) return; // not enough context

    neighbours.sort((a, b) => a - b);
    const median = neighbours[Math.floor(neighbours.length / 2)];

    // Komín = moja výška je aspoň 2.5× medián A aspoň 6 voxelov (6 m) vyššia
    const excess = myH - median;
    if (excess < 6 || myH < median * 2.5) return;

    const worldX = (ix + 0.5) * VS;
    const worldY = (iy + 0.5) * VS;
    // find floor Z for this column
    const trajPt = trajectory.find(tp =>
      Math.floor(tp.x/VS) === ix && Math.floor(tp.y/VS) === iy
    );
    const floorZ = trajPt ? trajPt.z : minZ + 1.3;
    const worldZ = floorZ + (myH * VS) / 2;
    const heightM = myH * VS;

    if (tooClose(worldX, worldY, worldZ, 'chimney')) return;

    // Confidence: čím väčší rozdiel voči mediánu, tým istejší
    const ratio = myH / Math.max(median, 1);
    const confidence = Math.min(97, Math.floor(55 + ratio * 12));

    usedPositions.push({ x: worldX, y: worldY, z: worldZ, type: 'chimney' });
    anomalies.push({
      id: `chimney-${chimneyIdx++}`,
      type: 'chimney',
      pos: { x: worldX, y: worldY, z: worldZ },
      size: heightM,
      pointsCount: Math.floor(heightM * avgDensity),
      confidence,
      description: `Komín ${heightM.toFixed(1)} m (${(ratio).toFixed(1)}× vyšší ako okolie, medián: ${(median*VS).toFixed(1)} m). Možná nevylezená vertikálna vetva.`
    });
  });

  // ── 6. Detekcia OKIEN — vzor STENA→VOID→STENA ───────────────────────────
  if (onStatus) onStatus('Hľadám bočné okná...');
  let windowIdx = 1;

  // Subsample trajectory pre rýchlosť (každý 4. bod)
  const sampledTraj = trajectory.filter((_, i) => i % 4 === 0);

  sampledTraj.forEach(tp => {
    const tx = Math.floor(tp.x / VS);
    const ty = Math.floor(tp.y / VS);
    const tz = Math.floor(tp.z / VS);

    // 4 horizontálne smery
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

    for (const [dx, dy] of dirs) {
      // Fáza 1: Nájdi prvú stenu (chodba má steny blízko)
      let wallStart = -1;
      for (let d = 1; d <= 5; d++) {
        if (isWall(tx + dx*d, ty + dy*d, tz)) { wallStart = d; break; }
      }
      if (wallStart < 0) continue; // nie je stena v tejto oblasti

      // Fáza 2: Za stenou hľadaj VOID (aspoň 2 prázdne voxely = 2 m medzera)
      let voidStart = -1, voidEnd = -1;
      for (let d = wallStart + 1; d <= wallStart + 4; d++) {
        const pts = grid.get(`${tx+dx*d},${ty+dy*d},${tz}`) || 0;
        if (pts < WALL_THRESH * 0.4) {
          if (voidStart < 0) voidStart = d;
          voidEnd = d;
        } else {
          break;
        }
      }
      if (voidStart < 0 || voidEnd - voidStart < 1) continue; // void príliš malý

      // Fáza 3: Za VOID musí byť ďalšia stena (paralelná chodba)
      let hasBackWall = false;
      let backWallDensity = 0;
      for (let d = voidEnd + 1; d <= voidEnd + 5; d++) {
        const pts = grid.get(`${tx+dx*d},${ty+dy*d},${tz}`) || 0;
        if (pts >= WALL_THRESH) { hasBackWall = true; backWallDensity = pts; break; }
      }
      if (!hasBackWall) continue;

      // Verifikácia: overenie aj na tz-1 a tz+1 (okno musí byť priestorové, nie len 1 layer)
      const confirmLayers = [-1, 1].filter(dz =>
        isWall(tx + dx*(wallStart), ty + dy*(wallStart), tz + dz) &&
        !(grid.get(`${tx+dx*(voidStart)},${ty+dy*(voidStart)},${tz+dz}`) || 0 >= WALL_THRESH)
      ).length;
      if (confirmLayers < 1) continue;

      const worldX = tp.x + dx * voidStart * VS;
      const worldY = tp.y + dy * voidStart * VS;
      const worldZ = tp.z;
      const voidWidth = (voidEnd - voidStart + 1) * VS;

      if (tooClose(worldX, worldY, worldZ, 'window')) continue;

      const confidence = Math.min(95, Math.floor(60 + backWallDensity / avgDensity * 8));
      usedPositions.push({ x: worldX, y: worldY, z: worldZ, type: 'window' });
      anomalies.push({
        id: `window-${windowIdx++}`,
        type: 'window',
        pos: { x: worldX, y: worldY, z: worldZ },
        size: voidWidth,
        pointsCount: Math.floor(backWallDensity),
        confidence,
        description: `Bočné okno/priechod šírky ~${voidWidth.toFixed(1)} m za stenou. Možná paralelná chodba alebo nepreskúmaná odbočka.`
      });
    }
  });

  // ── 7. RANSAC tektonické pukliny (len ak sú normály k dispozícii) ────────
  if (cave.pointNormals && cave.pointNormals.length > 0) {
    if (onStatus) onStatus('Analyzujem tektonické pukliny...');
    const normals = cave.pointNormals;
    const bucketSize = 0.15;
    const planeBuckets = new Map<string, number>();

    for (let i = 0; i < count; i += 15) {
      const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
      // Ignoruj horizontálne normály (strop/podlaha — nie pukliny)
      if (Math.abs(nz) > 0.7) continue;
      const key = `${Math.round(nx/bucketSize)},${Math.round(ny/bucketSize)},${Math.round(nz/bucketSize)}`;
      planeBuckets.set(key, (planeBuckets.get(key) || 0) + 1);
    }

    const sortedPlanes = Array.from(planeBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    sortedPlanes.forEach(([key, hits], idx) => {
      if (hits < 200) return; // príliš málo bodov na štatisticky spoľahlivú plochu
      const [bx, by, bz] = key.split(',').map(Number);
      const nx = bx * bucketSize, ny = by * bucketSize, nz = bz * bucketSize;
      const normalVec = new THREE.Vector3(nx, ny, nz).normalize();

      let sumX = 0, sumY = 0, sumZ = 0, ptCount = 0;
      for (let i = 0; i < count; i += 20) {
        const pVec = new THREE.Vector3(normals[i*3], normals[i*3+1], normals[i*3+2]).normalize();
        if (pVec.angleTo(normalVec) < 0.12) {
          sumX += points[i*3]; sumY += points[i*3+1]; sumZ += points[i*3+2];
          ptCount++;
        }
      }
      if (ptCount < 150) return;

      const pos = { x: sumX/ptCount, y: sumY/ptCount, z: sumZ/ptCount };
      if (tooClose(pos.x, pos.y, pos.z, 'fracture')) return;

      usedPositions.push({ ...pos, type: 'fracture' });
      anomalies.push({
        id: `fracture-${idx+1}`,
        type: 'fracture',
        pos,
        size: 8.0,
        pointsCount: ptCount,
        confidence: Math.min(97, Math.floor(72 + hits / 8)),
        normal: { x: normalVec.x, y: normalVec.y, z: normalVec.z },
        description: `Tektonická puklina azimut ${Math.floor(Math.atan2(normalVec.y, normalVec.x)*180/Math.PI)}°. Riadiaci smer chodby.`
      });
    });
  }

  if (onStatus) onStatus(null as any);
  return anomalies;
}


