console.log('[Worker] Script loaded');

import { PLYLoader } from './plyLoader';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

const MAX_POINTS_PER_NODE = 50000;
const MAX_DEPTH = 8;

export class OctreeNode {
  isLeaf: boolean = true;
  children: OctreeNode[] | null = null;
  indices: number[] = [];

  constructor(
    public bounds: Bounds,
    public depth: number = 0,
    public id: string = '0'
  ) {}

  split() {
    this.isLeaf = false;
    this.children = [];
    const min = this.bounds.min;
    const max = this.bounds.max;
    const mid = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    };

    for (let i = 0; i < 8; i++) {
      const childBounds: Bounds = {
        min: {
          x: (i & 1) ? mid.x : min.x,
          y: (i & 2) ? mid.y : min.y,
          z: (i & 4) ? mid.z : min.z,
        },
        max: {
          x: (i & 1) ? max.x : mid.x,
          y: (i & 2) ? max.y : mid.y,
          z: (i & 4) ? max.z : mid.z,
        }
      };
      this.children.push(new OctreeNode(childBounds, this.depth + 1, `${this.id}-${i}`));
    }
  }

  insert(index: number, x: number, y: number, z: number, points: Float32Array) {
    if (this.isLeaf) {
      this.indices.push(index);
      if (this.indices.length > MAX_POINTS_PER_NODE && this.depth < MAX_DEPTH) {
        this.split();
        const oldIndices = this.indices;
        this.indices = [];
        for (const idx of oldIndices) {
          this.insertIntoChildren(idx, points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2], points);
        }
      }
    } else {
      this.insertIntoChildren(index, x, y, z, points);
    }
  }

  private insertIntoChildren(index: number, x: number, y: number, z: number, points: Float32Array) {
    const mid = {
      x: (this.bounds.min.x + this.bounds.max.x) / 2,
      y: (this.bounds.min.y + this.bounds.max.y) / 2,
      z: (this.bounds.min.z + this.bounds.max.z) / 2,
    };
    const i = (x > mid.x ? 1 : 0) | (y > mid.y ? 2 : 0) | (z > mid.z ? 4 : 0);
    this.children![i].insert(index, x, y, z, points);
  }

  traverse(callback: (node: OctreeNode) => void) {
    callback(this);
    if (this.children) {
      for (const child of this.children) {
        child.traverse(callback);
      }
    }
  }
}

self.onmessage = (event: MessageEvent) => {
  const { buffer } = event.data;
  console.log('[Worker] Received buffer, size:', buffer?.byteLength);
  if (!buffer) return;

  try {
    const loader = new PLYLoader();
    const { points, colors, normals, intensity, vertexCount } = loader.parse(buffer);

    // Compute initial bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertexCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // ─── 1. Krok: 2D Height Distribution Grid ──────────────────────────────────
    const grid = new Map<string, number[]>();
    const cellSize = 0.5; // 0.5m grid cell size for high-precision voxelization

    for (let i = 0; i < vertexCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2]; // Original JTSK altitude

      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      const key = `${gx},${gy}`;

      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(z);
    }

    // ─── 2. Krok: Height Bucket Clustering & Gap Detection (CPU) ───────────────
    // Tento algoritmus analyzuje vertikálne rozdelenie výšok v každom stĺpci.
    // Deteguje prázdne vzdušné priestory (medzery >= 40cm), čím chirurgicky
    // oddelí skutočnú podlahu od visiacich previsov nízkeho stropu a stalaktitov.
    const cellBounds = new Map<string, { minFloor: number, maxFloor: number, minCeil: number, maxCeil: number }>();
    const bucketSize = 0.2; // 20cm height segments for precise layer detection

    for (const [key, heights] of grid.entries()) {
      if (heights.length === 0) continue;

      let minZ = Infinity, maxZ = -Infinity;
      for (const h of heights) {
        if (h < minZ) minZ = h;
        if (h > maxZ) maxZ = h;
      }

      if (maxZ - minZ < 0.4) {
        // Flat area or too few points, no gap analysis needed
        cellBounds.set(key, { minFloor: minZ, maxFloor: maxZ, minCeil: minZ, maxCeil: maxZ });
        continue;
      }

      // Build height occupancy buckets
      const numBuckets = Math.ceil((maxZ - minZ) / bucketSize) + 1;
      const buckets = new Uint8Array(numBuckets);
      for (const h of heights) {
        const idx = Math.floor((h - minZ) / bucketSize);
        if (idx >= 0 && idx < numBuckets) buckets[idx] = 1;
      }

      // 1. Find floor boundary (bottom-up: stop at the first gap of >= 40cm)
      let maxFloorIdx = 0;
      let consecutiveGaps = 0;
      for (let i = 0; i < numBuckets; i++) {
        if (buckets[i] === 0) {
          consecutiveGaps++;
          if (consecutiveGaps >= 2) { // 40cm gap detected
            break;
          }
        } else {
          consecutiveGaps = 0;
          maxFloorIdx = i;
        }
      }
      const maxFloor = minZ + (maxFloorIdx + 1) * bucketSize;

      // 2. Find ceiling boundary (top-down: stop at the first gap of >= 40cm)
      let minCeilIdx = numBuckets - 1;
      consecutiveGaps = 0;
      for (let i = numBuckets - 1; i >= 0; i--) {
        if (buckets[i] === 0) {
          consecutiveGaps++;
          if (consecutiveGaps >= 2) { // 40cm gap detected
            break;
          }
        } else {
          consecutiveGaps = 0;
          minCeilIdx = i;
        }
      }
      const minCeil = minZ + minCeilIdx * bucketSize;

      cellBounds.set(key, {
        minFloor: minZ,
        maxFloor: Math.min(maxFloor, maxZ),
        minCeil: Math.max(minCeil, minZ),
        maxCeil: maxZ
      });
    }

    // ─── 3. Krok: Relatívna výška pre každý bod (-1.0 podlaha až +1.0 strop) ────
    const relHeights = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];

      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      const key = `${gx},${gy}`;

      const bounds = cellBounds.get(key);
      if (bounds) {
        if (z <= bounds.maxFloor) {
          // Bod patrí k súvislej podlahe. Mapujeme do [-1.0, -0.2]
          const range = bounds.maxFloor - bounds.minFloor;
          const t = range > 0.05 ? (z - bounds.minFloor) / range : 0.0;
          relHeights[i] = -1.0 + t * 0.8;
        } else if (z >= bounds.minCeil) {
          // Bod patrí k súvislému stropu. Mapujeme do [0.2, 1.0]
          const range = bounds.maxCeil - bounds.minCeil;
          const t = range > 0.05 ? (z - bounds.minCeil) / range : 1.0;
          relHeights[i] = 0.2 + t * 0.8;
        } else {
          // Bod leží vo vzdušnej medzere (previs nízkeho stropu / plávajúci artefakt)
          relHeights[i] = 0.0;
        }
      } else {
        relHeights[i] = 0.0;
      }
    }

    // ─── 4. Krok: Octree & Stream ──────────────────────────────────────────────
    const root = new OctreeNode({
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    });

    let maxIntensity = 0;
    for (let i = 0; i < vertexCount; i++) {
      if (intensity[i] > maxIntensity) maxIntensity = intensity[i];
      root.insert(i, points[i * 3], points[i * 3 + 1], points[i * 3 + 2], points);
    }

    const intensityScale = maxIntensity > 1.0 ? 1.0 / maxIntensity : 1.0;

    root.traverse((node) => {
      if (node.isLeaf && node.indices.length > 0) {
        const nodePoints = new Float32Array(node.indices.length * 3);
        const nodeColors = new Float32Array(node.indices.length * 3);
        const nodeNormals = new Float32Array(node.indices.length * 3);
        const nodeIntensity = new Float32Array(node.indices.length);
        const nodeRelHeight = new Float32Array(node.indices.length); // NEW

        for (let i = 0; i < node.indices.length; i++) {
          const idx = node.indices[i];
          nodePoints[i * 3] = points[idx * 3] - cx;
          nodePoints[i * 3 + 1] = points[idx * 3 + 2] - cz; // Swap Y/Z for Three.js
          nodePoints[i * 3 + 2] = -(points[idx * 3 + 1] - cy);
          
          nodeColors[i * 3] = colors[idx * 3];
          nodeColors[i * 3 + 1] = colors[idx * 3 + 1];
          nodeColors[i * 3 + 2] = colors[idx * 3 + 2];

          nodeNormals[i * 3] = normals[idx * 3];
          nodeNormals[i * 3 + 1] = normals[idx * 3 + 2];
          nodeNormals[i * 3 + 2] = -normals[idx * 3 + 1];
          
          nodeIntensity[i] = intensity[idx] * intensityScale;
          nodeRelHeight[i] = relHeights[idx]; // NEW
        }

        const b = node.bounds;
        const nodeBounds = {
          min: { 
            x: b.min.x - cx, 
            y: b.min.z - cz, 
            z: -(b.max.y - cy) 
          },
          max: { 
            x: b.max.x - cx, 
            y: b.max.z - cz, 
            z: -(b.min.y - cy) 
          }
        };

        self.postMessage({
          type: 'POINTCLOUD_CHUNK',
          id: node.id,
          bounds: nodeBounds,
          points: nodePoints,
          colors: nodeColors,
          normals: nodeNormals,
          intensity: nodeIntensity,
          relHeight: nodeRelHeight, // NEW
          vertexCount: node.indices.length
        }, [nodePoints.buffer, nodeColors.buffer, nodeNormals.buffer, nodeIntensity.buffer, nodeRelHeight.buffer] as any);
      }
    });

    self.postMessage({ type: 'DONE', vertexCount });

  } catch (error) {
    self.postMessage({ type: 'ERROR', error: (error as Error).message });
  }
};
