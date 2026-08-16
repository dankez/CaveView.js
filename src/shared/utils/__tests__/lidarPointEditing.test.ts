import { describe, expect, it } from 'vitest';
import type { ParsedCave, ViewerCameraSnapshot } from '@shared/types';
import { hasRenderablePointColors } from '../pointCloudColors';
import {
  filterLidarPointsByMask,
  hasUsefulPointColors,
  selectProjectedLidarPoints,
} from '../lidarPointEditing';

function makeCave(points: number[]): ParsedCave {
  const pointCount = points.length / 3;
  const colors = new Float32Array(pointCount * 3);
  const classes = new Uint8Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    colors[i * 3] = i / Math.max(pointCount - 1, 1);
    colors[i * 3 + 1] = 0.5;
    colors[i * 3 + 2] = 1;
    classes[i] = i + 1;
  }

  return {
    segments: [],
    stations: [],
    stationLabels: [],
    scraps: [],
    surfaces: [],
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 10, y: 0, z: 0 },
      center: { x: 5, y: 0, z: 0 },
      size: { x: 10, y: 0, z: 0 },
    },
    centerOffset: { x: 0, y: 0, z: 0 },
    stationCount: 0,
    segmentCount: 0,
    scrapCount: 0,
    pointCount,
    hasSurface: false,
    isLiDAR: true,
    points: new Float32Array(points),
    pointColors: colors,
    hasPointColors: true,
    pointNormals: new Float32Array(0),
    hasPointNormals: false,
    pointIntensity: new Float32Array(0),
    pointClassification: classes,
  };
}

const camera: ViewerCameraSnapshot = {
  dist: 10,
  fov: 60,
  width: 100,
  height: 100,
  aspect: 1,
  near: 0.1,
  far: 100,
  position: [0, 0, 10],
  quaternion: [0, 0, 0, 1],
  target: [0, 0, 0],
};

describe('LiDAR point editing', () => {
  it('filters point cloud attributes using an edit mask', () => {
    const cave = makeCave([
      0, 0, 0,
      5, 0, 0,
      10, 0, 0,
    ]);
    cave.pointNormals = new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
    cave.hasPointNormals = true;
    const mask = new Uint8Array([1, 0, 1]);

    const result = filterLidarPointsByMask(cave, mask, false);

    expect(result.removedCount).toBe(2);
    expect(result.keptCount).toBe(1);
    expect(result.cave.pointCount).toBe(1);
    expect(Array.from(result.cave.points!)).toEqual([5, 0, 0]);
    expect(Array.from(result.cave.pointNormals!)).toEqual([0, 1, 0]);
    expect(Array.from(result.cave.pointClassification!)).toEqual([2]);
    expect(result.cave.pointCloudUrl).toBeUndefined();
  });

  it('preserves placeholder point colors while marking them unusable for shader fallback', () => {
    const cave = makeCave([
      0, 0, 0,
      5, 0, 0,
      10, 0, 0,
    ]);
    cave.pointColors = new Float32Array([
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
    ]);

    const result = filterLidarPointsByMask(cave, new Uint8Array([0, 1, 0]), false);

    expect(hasUsefulPointColors(cave.pointColors, cave.pointCount)).toBe(false);
    expect(result.cave.hasPointColors).toBe(true);
    expect((result.cave as any).hasUsablePointColors).toBe(false);
    expect(hasRenderablePointColors(result.cave)).toBe(false);
    expect(Array.from(result.cave.pointColors!)).toEqual([
      1, 1, 1,
      1, 1, 1,
    ]);

    cave.pointColors = new Float32Array([
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
    expect(hasUsefulPointColors(cave.pointColors, cave.pointCount)).toBe(false);
  });

  it('does not manufacture point colors when the source declared no color attribute', () => {
    const cave = makeCave([
      0, 0, 0,
      5, 0, 0,
      10, 0, 0,
    ]);
    cave.hasPointColors = false;

    const result = filterLidarPointsByMask(cave, new Uint8Array([0, 1, 0]), false);

    expect(result.cave.hasPointColors).toBe(false);
    expect(result.cave.pointColors?.length).toBe(0);
  });

  it('keeps varied point colors during LiDAR editing', () => {
    const cave = makeCave([
      0, 0, 0,
      5, 0, 0,
      10, 0, 0,
    ]);

    const result = filterLidarPointsByMask(cave, new Uint8Array([0, 1, 0]), false);

    expect(hasUsefulPointColors(cave.pointColors, cave.pointCount)).toBe(true);
    expect(result.cave.pointColors?.length).toBe(6);
    expect((result.cave as any).hasUsablePointColors).toBe(true);
    expect(hasRenderablePointColors(result.cave)).toBe(true);
  });

  it('selects LiDAR points by projected brush stroke', () => {
    const cave = makeCave([
      0, 0, 0,
      4, 0, 0,
      -4, 0, 0,
    ]);

    const result = selectProjectedLidarPoints(cave, camera, { width: 100, height: 100 }, [{ x: 50, y: 50 }], 12);

    expect(result.selectedCount).toBe(1);
    expect(Array.from(result.mask)).toEqual([1, 0, 0]);
  });
});
