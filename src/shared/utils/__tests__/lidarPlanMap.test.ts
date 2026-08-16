import { describe, expect, it } from 'vitest';
import { buildLidarPlanContourLines, buildLidarPlanMapData } from '../lidarPlanMap';

describe('lidar plan map generation', () => {
  it('builds an occupied floor-height grid from point cloud columns', () => {
    const values: number[] = [];
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 3; y++) {
        values.push(x, y, 100 + x * 0.2 + y * 0.1);
        values.push(x, y, 105 + x * 0.2 + y * 0.1);
      }
    }

    const data = buildLidarPlanMapData(new Float32Array(values), values.length / 3, null, { targetSize: 64 });

    expect(data.usedPoints).toBe(40);
    expect(data.occupiedCells).toBeGreaterThan(10);
    expect(data.minZ).toBeGreaterThanOrEqual(100);
    expect(data.maxZ).toBeLessThan(102);
    expect(data.maxZ).toBeGreaterThan(data.minZ);
    expect(data.cellSize).toBeGreaterThan(0);
  });

  it('uses the complete model bounds even when cave LiDAR class is present', () => {
    const points = new Float32Array([
      -100, -100, 10,
      100, 100, 11,
      0, 0, 20,
      4, 3, 21,
    ]);
    const classification = new Uint8Array([2, 2, 10, 10]);

    const data = buildLidarPlanMapData(points, 4, classification, { targetSize: 64 });

    expect(data.usedPoints).toBe(4);
    expect(data.minX).toBeCloseTo(-100);
    expect(data.maxX).toBeCloseTo(100);
    expect(data.minY).toBeCloseTo(-100);
    expect(data.maxY).toBeCloseTo(100);
  });

  it('fills small internal mask imperfections before rendering the plan surface', () => {
    const values: number[] = [];
    for (let x = 0; x <= 6; x++) {
      for (let y = 0; y <= 6; y++) {
        if (x === 3 && y === 3) continue;
        values.push(x, y, 120 + x * 0.2 + y * 0.15);
      }
    }

    const data = buildLidarPlanMapData(new Float32Array(values), values.length / 3, null, {
      targetSize: 32,
      minOutlineLengthMeters: 5,
    });
    const centerCol = Math.floor((3 - data.minX) / data.cellSize);
    const centerRow = Math.floor((3 - data.minY) / data.cellSize);
    const centerIdx = centerRow * data.cols + centerCol;

    expect(data.occupancy[centerIdx]).toBe(1);
    expect(Number.isFinite(data.heights[centerIdx])).toBe(true);
  });

  it('builds long 0.5m contour lines from a smoothed floor surface and ignores local blocks', () => {
    const values: number[] = [];
    for (let x = 0; x <= 30; x++) {
      for (let y = 0; y <= 30; y++) {
        const localBlock = x === 15 && y === 15 ? 8 : 0;
        values.push(x, y, 100 + y * 0.12 + localBlock);
      }
    }

    const data = buildLidarPlanMapData(new Float32Array(values), values.length / 3, null, {
      targetSize: 96,
      minOutlineLengthMeters: 5,
    });
    const lines = buildLidarPlanContourLines(data, {
      contourInterval: 0.5,
      minContourLengthMeters: 5,
    });
    const elevations = lines.map(line => line.elevation);

    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every(line => line.lengthMeters >= 5)).toBe(true);
    expect(elevations.every(elevation => Math.abs(elevation * 2 - Math.round(elevation * 2)) < 0.001)).toBe(true);
    expect(Math.max(...elevations)).toBeLessThan(104.5);
    expect(lines.some(line => line.major && Math.abs(line.elevation / 2 - Math.round(line.elevation / 2)) < 0.001)).toBe(true);
  });
});
