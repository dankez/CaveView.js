import { describe, it, expect } from 'vitest';

/**
 * Tento test simuluje logiku segmentácie z pointcloud.worker.ts
 * bez potreby spúšťať samotný worker.
 */
function simulateSegmentation(points: Float32Array) {
  const cellSize = 0.5;
  const vertexCount = points.length / 3;

  // 1. Grid
  const grid = new Map<string, number[]>();
  for (let i = 0; i < vertexCount; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const key = `${gx},${gy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(z);
  }

  // 2. Parting Line logic (midpoint)
  const cellBounds = new Map<string, { minZ: number, midZ: number, halfHeight: number }>();
  for (const [key, heights] of grid.entries()) {
    const minZ = Math.min(...heights);
    const maxZ = Math.max(...heights);
    cellBounds.set(key, { 
      minZ, 
      midZ: (minZ + maxZ) / 2, 
      halfHeight: (maxZ - minZ) / 2 
    });
  }

  // 3. Rel Heights
  const relHeights = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const key = `${gx},${gy}`;
    const b = cellBounds.get(key)!;

    if (b.halfHeight > 0.02) {
      relHeights[i] = (z - b.midZ) / b.halfHeight;
    } else {
      relHeights[i] = -1.0;
    }
  }

  return relHeights;
}

describe('LiDAR Segmentation Logic (Parting Line)', () => {
  it('should correctly segment a simple flat floor', () => {
    const points = new Float32Array([
      0.25, 0.25, 100,
      0.25, 0.25, 100.01 // takmer ploché
    ]);
    const rel = simulateSegmentation(points);
    expect(rel[0]).toBe(-1.0);
  });

  it('should map floor to -1 and ceiling to +1 with midpoint at 0', () => {
    const points = new Float32Array([
      0.25, 0.25, 100.0, // Dno
      0.25, 0.25, 105.0, // Strop
      0.25, 0.25, 102.5  // Stred
    ]);
    const rel = simulateSegmentation(points);
    
    expect(rel[0]).toBeCloseTo(-1.0, 5); 
    expect(rel[1]).toBeCloseTo(1.0, 5);  
    expect(rel[2]).toBeCloseTo(0.0, 5);  
  });

  it('should naturally handle boulders (no artificial gaps)', () => {
    const points = new Float32Array([
      0.25, 0.25, 100.0, // Zem
      0.25, 0.25, 101.0, // Balvan
      0.25, 0.25, 110.0  // Strop
    ]);
    const rel = simulateSegmentation(points);
    
    // Midpoint je 105.0. 
    // Zem (100) je -1.0
    // Balvan (101) je -0.8
    expect(rel[0]).toBeCloseTo(-1.0, 5);
    expect(rel[1]).toBeCloseTo(-0.8, 5); 
    expect(rel[2]).toBeCloseTo(1.0, 5);
  });
});
