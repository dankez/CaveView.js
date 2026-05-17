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

    const root = new OctreeNode({
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // Build Octree & find max intensity
    let maxIntensity = 0;
    for (let i = 0; i < vertexCount; i++) {
      if (intensity[i] > maxIntensity) maxIntensity = intensity[i];
      root.insert(i, points[i * 3], points[i * 3 + 1], points[i * 3 + 2], points);
    }

    const intensityScale = maxIntensity > 1.0 ? 1.0 / maxIntensity : 1.0;

    // Stream nodes
    root.traverse((node) => {
      if (node.isLeaf && node.indices.length > 0) {
        const nodePoints = new Float32Array(node.indices.length * 3);
        const nodeColors = new Float32Array(node.indices.length * 3);
        const nodeNormals = new Float32Array(node.indices.length * 3);
        const nodeIntensity = new Float32Array(node.indices.length);

        for (let i = 0; i < node.indices.length; i++) {
          const idx = node.indices[i];
          // CENTER THE POINTS!
          nodePoints[i * 3] = points[idx * 3] - cx;
          nodePoints[i * 3 + 1] = points[idx * 3 + 2] - cz; // Swap Y/Z to match Three.js (v1 logic: x, z, -y)
          nodePoints[i * 3 + 2] = -(points[idx * 3 + 1] - cy);
          
          nodeColors[i * 3] = colors[idx * 3];
          nodeColors[i * 3 + 1] = colors[idx * 3 + 1];
          nodeColors[i * 3 + 2] = colors[idx * 3 + 2];

          nodeNormals[i * 3] = normals[idx * 3];
          nodeNormals[i * 3 + 1] = normals[idx * 3 + 2];
          nodeNormals[i * 3 + 2] = -normals[idx * 3 + 1];
          
          nodeIntensity[i] = intensity[idx] * intensityScale;
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
          vertexCount: node.indices.length
        }, [nodePoints.buffer, nodeColors.buffer, nodeNormals.buffer, nodeIntensity.buffer] as any);
      }
    });

    self.postMessage({ type: 'DONE', vertexCount });

  } catch (error) {
    self.postMessage({ type: 'ERROR', error: (error as Error).message });
  }
};
