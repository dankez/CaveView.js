import * as THREE from 'three';
import type { ParsedCave, Vec3, ViewerCameraSnapshot } from '@shared/types';
import { hasRenderablePointColors, hasUsefulPointColors } from './pointCloudColors';

export { hasUsefulPointColors } from './pointCloudColors';

export type LidarEditMode = 'off' | 'erase' | 'keep';

export interface LidarScreenPoint {
  x: number;
  y: number;
}

export interface LidarCanvasRect {
  width: number;
  height: number;
}

export interface LidarSelectionResult {
  mask: Uint8Array;
  selectedCount: number;
  newlySelectedCount: number;
}

export interface LidarFilterResult {
  cave: ParsedCave;
  keptCount: number;
  removedCount: number;
}

const EMPTY_BOUNDS = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  center: { x: 0, y: 0, z: 0 },
  size: { x: 0, y: 0, z: 0 },
};

function cloneVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z, relHeight: value.relHeight };
}

function cloneTypedArray<T extends Float32Array | Uint8Array | undefined>(value: T): T {
  if (!value) return value;
  return new (value.constructor as any)(value) as T;
}

function hasSourcePointColors(cave: ParsedCave, pointCount: number): boolean {
  if (!cave.pointColors || cave.pointColors.length < pointCount * 3) return false;
  if (cave.hasPointColors === true) return true;
  if (cave.hasPointColors === false) return false;
  return hasUsefulPointColors(cave.pointColors, pointCount);
}

function hasSourcePointNormals(cave: ParsedCave, pointCount: number): boolean {
  if (!cave.pointNormals || cave.pointNormals.length < pointCount * 3) return false;
  if (cave.hasPointNormals === false) return false;
  return true;
}

export function cloneLidarEditSnapshot(cave: ParsedCave): ParsedCave {
  return {
    ...cave,
    bounds: {
      min: cloneVec3(cave.bounds.min),
      max: cloneVec3(cave.bounds.max),
      center: cloneVec3(cave.bounds.center),
      size: cloneVec3(cave.bounds.size),
    },
    centerOffset: cloneVec3(cave.centerOffset),
    points: cloneTypedArray(cave.points),
    pointColors: cloneTypedArray(cave.pointColors),
    pointNormals: cloneTypedArray(cave.pointNormals),
    pointIntensity: cloneTypedArray(cave.pointIntensity),
    pointClassification: cloneTypedArray(cave.pointClassification),
    surfaces: cave.surfaces,
    scraps: cave.scraps,
    segments: cave.segments,
    stations: cave.stations,
    stationLabels: cave.stationLabels,
  };
}

export function recomputePointBounds(points: Float32Array, pointCount: number): ParsedCave['bounds'] {
  if (pointCount <= 0) return EMPTY_BOUNDS;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < pointCount; i++) {
    const p = i * 3;
    const x = points[p];
    const y = points[p + 1];
    const z = points[p + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minX)) return EMPTY_BOUNDS;

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    },
  };
}

export function filterLidarPointsByMask(cave: ParsedCave, mask: Uint8Array, keepSelected: boolean): LidarFilterResult {
  const points = cave.points;
  const pointCount = cave.pointCount;
  if (!points || pointCount === 0) {
    return { cave, keptCount: 0, removedCount: 0 };
  }

  let keptCount = 0;
  for (let i = 0; i < pointCount; i++) {
    const selected = mask[i] === 1;
    if (keepSelected ? selected : !selected) keptCount++;
  }

  const outPoints = new Float32Array(keptCount * 3);
  const hasColors = hasSourcePointColors(cave, pointCount);
  const hasUsableColors = hasColors && hasRenderablePointColors(cave, pointCount);
  const hasNormals = hasSourcePointNormals(cave, pointCount);
  const hasIntensity = !!cave.pointIntensity && cave.pointIntensity.length >= pointCount;
  const hasClassification = !!cave.pointClassification && cave.pointClassification.length >= pointCount;
  const outColors = hasColors ? new Float32Array(keptCount * 3) : new Float32Array(0);
  const outNormals = hasNormals ? new Float32Array(keptCount * 3) : new Float32Array(0);
  const outIntensity = hasIntensity ? new Float32Array(keptCount) : new Float32Array(0);
  const outClassification = hasClassification ? new Uint8Array(keptCount) : new Uint8Array(0);

  let outIndex = 0;
  for (let i = 0; i < pointCount; i++) {
    const selected = mask[i] === 1;
    if (!(keepSelected ? selected : !selected)) continue;

    const src3 = i * 3;
    const dst3 = outIndex * 3;
    outPoints[dst3] = points[src3];
    outPoints[dst3 + 1] = points[src3 + 1];
    outPoints[dst3 + 2] = points[src3 + 2];
    if (hasColors) {
      outColors[dst3] = cave.pointColors![src3];
      outColors[dst3 + 1] = cave.pointColors![src3 + 1];
      outColors[dst3 + 2] = cave.pointColors![src3 + 2];
    }
    if (hasNormals) {
      outNormals[dst3] = cave.pointNormals![src3];
      outNormals[dst3 + 1] = cave.pointNormals![src3 + 1];
      outNormals[dst3 + 2] = cave.pointNormals![src3 + 2];
    }
    if (hasIntensity) outIntensity[outIndex] = cave.pointIntensity![i];
    if (hasClassification) outClassification[outIndex] = cave.pointClassification![i];
    outIndex++;
  }

  const nextCave: ParsedCave = {
    ...cave,
    pointCount: keptCount,
    points: outPoints,
    pointColors: outColors,
    hasPointColors: hasColors,
    hasUsablePointColors: hasUsableColors,
    pointNormals: outNormals,
    hasPointNormals: hasNormals,
    pointIntensity: outIntensity,
    pointClassification: outClassification,
    pointCloudUrl: undefined,
    bounds: recomputePointBounds(outPoints, keptCount),
  };

  return {
    cave: nextCave,
    keptCount,
    removedCount: pointCount - keptCount,
  };
}

export function downsampleStrokePoints(points: LidarScreenPoint[], minSpacing: number): LidarScreenPoint[] {
  if (points.length <= 2) return points;
  const result: LidarScreenPoint[] = [points[0]];
  let last = points[0];
  const minSpacingSq = minSpacing * minSpacing;

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy >= minSpacingSq) {
      result.push(p);
      last = p;
    }
  }

  const tail = points[points.length - 1];
  if (tail !== result[result.length - 1]) result.push(tail);
  return result;
}

function createCamera(snapshot: ViewerCameraSnapshot): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(snapshot.fov, snapshot.aspect, snapshot.near, snapshot.far);
  camera.position.fromArray(snapshot.position);
  camera.quaternion.fromArray(snapshot.quaternion);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  return camera;
}

function createStrokeGrid(points: LidarScreenPoint[], radius: number): Map<string, LidarScreenPoint[]> {
  const grid = new Map<string, LidarScreenPoint[]>();
  const cellSize = Math.max(1, radius);

  for (const point of points) {
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);
    const key = `${cellX},${cellY}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(point);
    else grid.set(key, [point]);
  }

  return grid;
}

function hasNearbyStrokePoint(
  grid: Map<string, LidarScreenPoint[]>,
  x: number,
  y: number,
  radius: number
): boolean {
  const cellSize = Math.max(1, radius);
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  const radiusSq = radius * radius;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = grid.get(`${cellX + dx},${cellY + dy}`);
      if (!bucket) continue;
      for (const point of bucket) {
        const px = x - point.x;
        const py = y - point.y;
        if (px * px + py * py <= radiusSq) return true;
      }
    }
  }

  return false;
}

export function selectProjectedLidarPoints(
  cave: ParsedCave,
  cameraSnapshot: ViewerCameraSnapshot,
  canvasRect: LidarCanvasRect,
  strokePoints: LidarScreenPoint[],
  radiusPx: number,
  existingMask?: Uint8Array | null,
  calibrationOffset?: Vec3 | null
): LidarSelectionResult {
  const points = cave.points;
  const pointCount = cave.pointCount;
  const mask = existingMask && existingMask.length === pointCount ? new Uint8Array(existingMask) : new Uint8Array(pointCount);
  if (!points || pointCount === 0 || strokePoints.length === 0 || canvasRect.width <= 0 || canvasRect.height <= 0) {
    let selectedCount = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) selectedCount++;
    return { mask, selectedCount, newlySelectedCount: 0 };
  }

  const camera = createCamera(cameraSnapshot);
  const strokeGrid = createStrokeGrid(strokePoints, radiusPx);
  const projected = new THREE.Vector3();
  const offsetX = calibrationOffset?.x || 0;
  const offsetY = calibrationOffset?.y || 0;
  const offsetZ = calibrationOffset?.z || 0;
  let newlySelectedCount = 0;
  let selectedCount = 0;

  for (let i = 0; i < pointCount; i++) {
    const p = i * 3;
    projected.set(
      points[p] + offsetX,
      points[p + 2] + offsetZ,
      -points[p + 1] - offsetY
    );
    projected.project(camera);
    if (projected.z < -1 || projected.z > 1) {
      if (mask[i]) selectedCount++;
      continue;
    }

    const sx = (projected.x * 0.5 + 0.5) * canvasRect.width;
    const sy = (-projected.y * 0.5 + 0.5) * canvasRect.height;
    if (sx < -radiusPx || sy < -radiusPx || sx > canvasRect.width + radiusPx || sy > canvasRect.height + radiusPx) {
      if (mask[i]) selectedCount++;
      continue;
    }

    if (hasNearbyStrokePoint(strokeGrid, sx, sy, radiusPx)) {
      if (!mask[i]) newlySelectedCount++;
      mask[i] = 1;
    }
    if (mask[i]) selectedCount++;
  }

  return { mask, selectedCount, newlySelectedCount };
}
