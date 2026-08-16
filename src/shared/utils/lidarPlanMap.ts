export interface LidarPlanMapData {
  cols: number;
  rows: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
  usedPoints: number;
  occupiedCells: number;
  heights: Float32Array;
  contourHeights: Float32Array;
  occupancy: Uint8Array;
}

export interface BuildLidarPlanMapOptions {
  targetSize?: number;
  contourInterval?: number;
  minOutlineLengthMeters?: number;
  minContourLengthMeters?: number;
}

export interface LidarPlanMapRenderResult {
  dataUrl: string;
  width: number;
  height: number;
}

const EMPTY_HEIGHT = Number.NaN;
const DEFAULT_MIN_OUTLINE_LENGTH_METERS = 5;
const DEFAULT_MIN_CONTOUR_LENGTH_METERS = 5;

export interface PlanPoint {
  x: number;
  y: number;
}

interface OutlineEdge {
  start: PlanPoint;
  end: PlanPoint;
}

interface OutlinePath {
  points: PlanPoint[];
  area: number;
  lengthMeters: number;
}

interface ContourSegment {
  a: PlanPoint;
  b: PlanPoint;
}

export interface LidarPlanContourLine {
  elevation: number;
  major: boolean;
  lengthMeters: number;
  points: PlanPoint[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildLidarPlanMapData(
  points: Float32Array,
  pointCount: number,
  _classification?: Uint8Array | null,
  options: BuildLidarPlanMapOptions = {}
): LidarPlanMapData {
  const targetSize = clamp(Math.floor(options.targetSize || 1024), 256, 1600);
  const minOutlineLengthMeters = Math.max(0, options.minOutlineLengthMeters ?? DEFAULT_MIN_OUTLINE_LENGTH_METERS);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let usedPoints = 0;

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
    usedPoints++;
  }

  if (usedPoints === 0 || !Number.isFinite(minX) || !Number.isFinite(minY)) {
    throw new Error('No usable LiDAR points for plan map');
  }

  const spanX = Math.max(maxX - minX, 0.01);
  const spanY = Math.max(maxY - minY, 0.01);
  const area = Math.max(spanX * spanY, 0.01);
  const targetCellSize = Math.max(spanX, spanY) / Math.max(1, targetSize - 1);
  const densityCellSize = Math.sqrt(area / Math.max(usedPoints, 1)) * 1.15;
  const cellSize = Math.max(targetCellSize, densityCellSize);
  const cols = Math.max(1, Math.min(targetSize, Math.ceil(spanX / cellSize) + 1));
  const rows = Math.max(1, Math.min(targetSize, Math.ceil(spanY / cellSize) + 1));
  const total = cols * rows;
  const heights = new Float32Array(total);
  const occupancy = new Uint8Array(total);
  const counts = new Uint32Array(total);

  heights.fill(EMPTY_HEIGHT);

  for (let i = 0; i < pointCount; i++) {
    const p = i * 3;
    const x = points[p];
    const y = points[p + 1];
    const z = points[p + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const col = clamp(Math.floor((x - minX) / cellSize), 0, cols - 1);
    const row = clamp(Math.floor((y - minY) / cellSize), 0, rows - 1);
    const idx = row * cols + col;
    if (!Number.isFinite(heights[idx]) || z < heights[idx]) {
      heights[idx] = z;
    }
    counts[idx]++;
  }

  let occupiedCells = 0;
  for (let i = 0; i < total; i++) {
    if (counts[i] > 0 && Number.isFinite(heights[i])) {
      occupancy[i] = 1;
      occupiedCells++;
    }
  }

  cleanPlanMapMask(cols, rows, heights, occupancy, cellSize, minOutlineLengthMeters);
  interpolateOccupiedHeights(cols, rows, heights, occupancy);
  smoothOccupiedHeights(cols, rows, heights, occupancy, 4);
  const contourHeights = buildContourSurfaceHeights(cols, rows, heights, occupancy, cellSize);

  const heightRange = getOccupiedHeightRange(heights, occupancy);
  occupiedCells = 0;
  for (let i = 0; i < total; i++) {
    if (occupancy[i]) occupiedCells++;
  }

  return {
    cols,
    rows,
    minX,
    minY,
    maxX,
    maxY,
    minZ: heightRange.minZ,
    maxZ: heightRange.maxZ,
    cellSize,
    usedPoints,
    occupiedCells,
    heights,
    contourHeights,
    occupancy,
  };
}

function cleanPlanMapMask(
  cols: number,
  rows: number,
  heights: Float32Array,
  occupancy: Uint8Array,
  cellSize: number,
  minOutlineLengthMeters: number
) {
  settleLocalMaskNoise(cols, rows, heights, occupancy);
  settleLocalMaskNoise(cols, rows, heights, occupancy);
  removeShortOccupiedComponents(cols, rows, heights, occupancy, cellSize, minOutlineLengthMeters);
  fillInternalMaskHoles(cols, rows, heights, occupancy, cellSize, minOutlineLengthMeters);
  settleLocalMaskNoise(cols, rows, heights, occupancy);
}

function settleLocalMaskNoise(cols: number, rows: number, heights: Float32Array, occupancy: Uint8Array) {
  const nextOccupancy = new Uint8Array(occupancy);
  const nextHeights = new Float32Array(heights);

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const idx = row * cols + col;
      let neighbours = 0;
      let zSum = 0;
      let zCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = (row + dy) * cols + (col + dx);
          if (occupancy[nIdx]) {
            neighbours++;
            if (Number.isFinite(heights[nIdx])) {
              zSum += heights[nIdx];
              zCount++;
            }
          }
        }
      }

      if (!occupancy[idx] && neighbours >= 6) {
        nextOccupancy[idx] = 1;
        nextHeights[idx] = zCount > 0 ? zSum / zCount : EMPTY_HEIGHT;
      } else if (occupancy[idx] && neighbours <= 1) {
        nextOccupancy[idx] = 0;
        nextHeights[idx] = EMPTY_HEIGHT;
      }
    }
  }

  occupancy.set(nextOccupancy);
  heights.set(nextHeights);
}

function removeShortOccupiedComponents(
  cols: number,
  rows: number,
  heights: Float32Array,
  occupancy: Uint8Array,
  cellSize: number,
  minOutlineLengthMeters: number
) {
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const component: number[] = [];

  for (let start = 0; start < total; start++) {
    if (!occupancy[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    let perimeterEdges = 0;
    component.length = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const idx = queue[head++];
      component.push(idx);
      const row = Math.floor(idx / cols);
      const col = idx - row * cols;

      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];

      for (let i = 0; i < neighbours.length; i++) {
        const nIdx = neighbours[i];
        if (nIdx < 0 || !occupancy[nIdx]) {
          perimeterEdges++;
          continue;
        }
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }

    if (perimeterEdges * cellSize < minOutlineLengthMeters) {
      for (let i = 0; i < component.length; i++) {
        const idx = component[i];
        occupancy[idx] = 0;
        heights[idx] = EMPTY_HEIGHT;
      }
    }
  }
}

function fillInternalMaskHoles(
  cols: number,
  rows: number,
  heights: Float32Array,
  occupancy: Uint8Array,
  cellSize: number,
  minOutlineLengthMeters: number
) {
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const component: number[] = [];
  const maxHolePerimeterMeters = Math.max(minOutlineLengthMeters, cellSize * 4);

  for (let start = 0; start < total; start++) {
    if (occupancy[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    let touchesOuterSpace = false;
    let boundaryEdges = 0;
    let boundaryHeightSum = 0;
    let boundaryHeightCount = 0;
    component.length = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const idx = queue[head++];
      component.push(idx);
      const row = Math.floor(idx / cols);
      const col = idx - row * cols;
      if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) {
        touchesOuterSpace = true;
      }

      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];

      for (let i = 0; i < neighbours.length; i++) {
        const nIdx = neighbours[i];
        if (nIdx < 0) continue;
        if (occupancy[nIdx]) {
          boundaryEdges++;
          const z = heights[nIdx];
          if (Number.isFinite(z)) {
            boundaryHeightSum += z;
            boundaryHeightCount++;
          }
          continue;
        }
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }

    if (!touchesOuterSpace && boundaryEdges * cellSize <= maxHolePerimeterMeters) {
      const fillHeight = boundaryHeightCount > 0 ? boundaryHeightSum / boundaryHeightCount : EMPTY_HEIGHT;
      for (let i = 0; i < component.length; i++) {
        const idx = component[i];
        occupancy[idx] = 1;
        heights[idx] = fillHeight;
      }
    }
  }
}

function interpolateOccupiedHeights(cols: number, rows: number, heights: Float32Array, occupancy: Uint8Array) {
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    const nextHeights = new Float32Array(heights);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (!occupancy[idx] || Number.isFinite(heights[idx])) continue;

        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nCol = col + dx;
            const nRow = row + dy;
            if (nCol < 0 || nRow < 0 || nCol >= cols || nRow >= rows) continue;
            const nIdx = nRow * cols + nCol;
            if (!occupancy[nIdx] || !Number.isFinite(heights[nIdx])) continue;
            sum += heights[nIdx];
            count++;
          }
        }

        if (count > 0) {
          nextHeights[idx] = sum / count;
          changed = true;
        }
      }
    }

    heights.set(nextHeights);
    if (!changed) break;
  }
}

function smoothOccupiedHeights(cols: number, rows: number, heights: Float32Array, occupancy: Uint8Array, passes: number) {
  for (let pass = 0; pass < passes; pass++) {
    const nextHeights = new Float32Array(heights);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (!occupancy[idx] || !Number.isFinite(heights[idx])) continue;

        let sum = heights[idx] * 4;
        let weight = 4;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nCol = col + dx;
            const nRow = row + dy;
            if (nCol < 0 || nRow < 0 || nCol >= cols || nRow >= rows) continue;
            const nIdx = nRow * cols + nCol;
            if (!occupancy[nIdx] || !Number.isFinite(heights[nIdx])) continue;
            const nWeight = dx === 0 || dy === 0 ? 2 : 1;
            sum += heights[nIdx] * nWeight;
            weight += nWeight;
          }
        }

        nextHeights[idx] = sum / weight;
      }
    }
    heights.set(nextHeights);
  }
}

function suppressLocalHeightOutliers(
  cols: number,
  rows: number,
  heights: Float32Array,
  occupancy: Uint8Array,
  cellSize: number,
  passes: number
) {
  const minimumThreshold = Math.max(0.38, cellSize * 0.18);

  for (let pass = 0; pass < passes; pass++) {
    const nextHeights = new Float32Array(heights);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const z = heights[idx];
        if (!occupancy[idx] || !Number.isFinite(z)) continue;

        let sum = 0;
        let sumSq = 0;
        let count = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nCol = col + dx;
            const nRow = row + dy;
            if (nCol < 0 || nRow < 0 || nCol >= cols || nRow >= rows) continue;
            const nIdx = nRow * cols + nCol;
            if (!occupancy[nIdx] || !Number.isFinite(heights[nIdx])) continue;
            const h = heights[nIdx];
            sum += h;
            sumSq += h * h;
            count++;
          }
        }

        if (count < 8) continue;
        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        const stdDev = Math.sqrt(variance);
        const threshold = Math.max(minimumThreshold, stdDev * 2.35);
        if (Math.abs(z - mean) > threshold) {
          nextHeights[idx] = mean;
        }
      }
    }

    heights.set(nextHeights);
  }
}

function buildContourSurfaceHeights(
  cols: number,
  rows: number,
  heights: Float32Array,
  occupancy: Uint8Array,
  cellSize: number
): Float32Array {
  const contourHeights = new Float32Array(heights);
  suppressLocalHeightOutliers(cols, rows, contourHeights, occupancy, cellSize, 3);
  smoothOccupiedHeights(cols, rows, contourHeights, occupancy, 10);
  suppressLocalHeightOutliers(cols, rows, contourHeights, occupancy, cellSize, 1);
  smoothOccupiedHeights(cols, rows, contourHeights, occupancy, 4);
  return contourHeights;
}

function getOccupiedHeightRange(heights: Float32Array, occupancy: Uint8Array): { minZ: number; maxZ: number } {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    if (!occupancy[i] || !Number.isFinite(heights[i])) continue;
    const z = heights[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    return { minZ: 0, maxZ: 0 };
  }
  return { minZ, maxZ };
}

function getHeight(data: LidarPlanMapData, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= data.cols || row >= data.rows) return EMPTY_HEIGHT;
  const idx = row * data.cols + col;
  return data.occupancy[idx] ? data.heights[idx] : EMPTY_HEIGHT;
}

function shadeForCell(data: LidarPlanMapData, col: number, row: number): number {
  const z = getHeight(data, col, row);
  const left = getHeight(data, col - 1, row);
  const right = getHeight(data, col + 1, row);
  const down = getHeight(data, col, row - 1);
  const up = getHeight(data, col, row + 1);
  const dzdx = ((Number.isFinite(right) ? right : z) - (Number.isFinite(left) ? left : z)) / Math.max(data.cellSize * 2, 0.001);
  const dzdy = ((Number.isFinite(up) ? up : z) - (Number.isFinite(down) ? down : z)) / Math.max(data.cellSize * 2, 0.001);
  const nx = -dzdx;
  const ny = -dzdy;
  const nz = 1;
  const len = Math.hypot(nx, ny, nz) || 1;
  const lx = -0.45;
  const ly = -0.55;
  const lz = 0.72;
  const llen = Math.hypot(lx, ly, lz);
  const dot = (nx * lx + ny * ly + nz * lz) / (len * llen);
  let localSum = 0;
  let localCount = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const h = getHeight(data, col + dx, row + dy);
      if (!Number.isFinite(h)) continue;
      localSum += h;
      localCount++;
    }
  }
  const localMean = localCount > 0 ? localSum / localCount : z;
  const cavity = clamp((localMean - z) / Math.max(data.cellSize * 2.5, 0.001), -0.75, 0.75);
  const normalizedZ = (z - data.minZ) / Math.max(data.maxZ - data.minZ, 1);
  return clamp(0.52 + dot * 0.36 + normalizedZ * 0.1 + cavity * 0.12, 0.2, 0.98);
}

function pointKey(point: PlanPoint): string {
  return `${point.x},${point.y}`;
}

function addOutlineEdge(edges: OutlineEdge[], outgoing: Map<string, number[]>, start: PlanPoint, end: PlanPoint) {
  const index = edges.length;
  edges.push({ start, end });
  const key = pointKey(start);
  const bucket = outgoing.get(key);
  if (bucket) {
    bucket.push(index);
  } else {
    outgoing.set(key, [index]);
  }
}

function pathLength(points: PlanPoint[]): number {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

function signedArea(points: PlanPoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function perpendicularDistance(point: PlanPoint, start: PlanPoint, end: PlanPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denom = Math.hypot(dx, dy);
  if (denom === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / denom;
}

function simplifyOpenPath(points: PlanPoint[], tolerance: number): PlanPoint[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let splitIndex = 0;
  const lastIndex = points.length - 1;

  for (let i = 1; i < lastIndex; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[lastIndex]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= tolerance) {
    return [points[0], points[lastIndex]];
  }

  const left = simplifyOpenPath(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyOpenPath(points.slice(splitIndex), tolerance);
  return left.slice(0, -1).concat(right);
}

function simplifyClosedPath(points: PlanPoint[], tolerance: number): PlanPoint[] {
  if (points.length <= 8) return points;
  let cleaned = points;
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (first.x === last.x && first.y === last.y) cleaned = cleaned.slice(0, -1);
  }

  const withoutCollinear: PlanPoint[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const prev = cleaned[(i - 1 + cleaned.length) % cleaned.length];
    const current = cleaned[i];
    const next = cleaned[(i + 1) % cleaned.length];
    const cross = (current.x - prev.x) * (next.y - current.y) - (current.y - prev.y) * (next.x - current.x);
    if (Math.abs(cross) > 0.001) withoutCollinear.push(current);
  }
  if (withoutCollinear.length <= 8) return withoutCollinear.length > 0 ? withoutCollinear : cleaned;

  const rotated = withoutCollinear.concat(withoutCollinear[0]);
  const simplified = simplifyOpenPath(rotated, tolerance);
  simplified.pop();
  return simplified.length > 3 ? simplified : withoutCollinear;
}

function traceOutlinePaths(data: LidarPlanMapData, minOutlineLengthMeters: number): OutlinePath[] {
  const edges: OutlineEdge[] = [];
  const outgoing = new Map<string, number[]>();

  for (let row = 0; row < data.rows; row++) {
    for (let col = 0; col < data.cols; col++) {
      const idx = row * data.cols + col;
      if (!data.occupancy[idx]) continue;
      const bottomEmpty = row === 0 || !data.occupancy[(row - 1) * data.cols + col];
      const rightEmpty = col === data.cols - 1 || !data.occupancy[row * data.cols + col + 1];
      const topEmpty = row === data.rows - 1 || !data.occupancy[(row + 1) * data.cols + col];
      const leftEmpty = col === 0 || !data.occupancy[row * data.cols + col - 1];

      if (bottomEmpty) addOutlineEdge(edges, outgoing, { x: col, y: row }, { x: col + 1, y: row });
      if (rightEmpty) addOutlineEdge(edges, outgoing, { x: col + 1, y: row }, { x: col + 1, y: row + 1 });
      if (topEmpty) addOutlineEdge(edges, outgoing, { x: col + 1, y: row + 1 }, { x: col, y: row + 1 });
      if (leftEmpty) addOutlineEdge(edges, outgoing, { x: col, y: row + 1 }, { x: col, y: row });
    }
  }

  const used = new Uint8Array(edges.length);
  const paths: OutlinePath[] = [];
  const tolerance = clamp(0.6 / Math.max(data.cellSize, 0.001), 0.8, 6);

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    if (used[edgeIndex]) continue;
    const first = edges[edgeIndex];
    const points: PlanPoint[] = [first.start];
    let currentIndex = edgeIndex;

    for (let guard = 0; guard < edges.length + 1; guard++) {
      if (used[currentIndex]) break;
      const edge = edges[currentIndex];
      used[currentIndex] = 1;
      points.push(edge.end);

      if (edge.end.x === first.start.x && edge.end.y === first.start.y) break;

      const nextIndexes = outgoing.get(pointKey(edge.end)) || [];
      const nextIndex = nextIndexes.find(index => !used[index]);
      if (nextIndex === undefined) break;
      currentIndex = nextIndex;
    }

    if (points.length < 4) continue;
    const simplified = simplifyClosedPath(points, tolerance);
    if (simplified.length < 4) continue;
    const area = signedArea(simplified);
    const lengthMeters = pathLength(simplified) * data.cellSize;
    if (area <= 0 || lengthMeters < minOutlineLengthMeters) continue;
    paths.push({ points: simplified, area, lengthMeters });
  }

  paths.sort((a, b) => b.lengthMeters - a.lengthMeters);
  return paths;
}

function toCanvasPoint(point: PlanPoint, data: LidarPlanMapData, padding: number): PlanPoint {
  return {
    x: padding + point.x,
    y: padding + data.rows - point.y,
  };
}

function drawClosedBezierPath(ctx: CanvasRenderingContext2D, rawPoints: PlanPoint[]) {
  if (rawPoints.length < 4) return;
  const points = rawPoints.map((point, index) => {
    const next = rawPoints[(index + 1) % rawPoints.length];
    return {
      x: point.x * 0.86 + next.x * 0.14,
      y: point.y * 0.86 + next.y * 0.14,
    };
  });
  ctx.moveTo(points[0].x, points[0].y);
  const tension = 0.82;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    const cp1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension,
      y: p1.y + ((p2.y - p0.y) / 6) * tension,
    };
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension,
      y: p2.y - ((p3.y - p1.y) / 6) * tension,
    };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
  }
  ctx.closePath();
}

function drawOpenBezierPath(ctx: CanvasRenderingContext2D, rawPoints: PlanPoint[]) {
  if (rawPoints.length < 2) return;
  ctx.moveTo(rawPoints[0].x, rawPoints[0].y);
  if (rawPoints.length === 2) {
    ctx.lineTo(rawPoints[1].x, rawPoints[1].y);
    return;
  }

  const tension = 0.72;
  for (let i = 0; i < rawPoints.length - 1; i++) {
    const p0 = rawPoints[Math.max(0, i - 1)];
    const p1 = rawPoints[i];
    const p2 = rawPoints[i + 1];
    const p3 = rawPoints[Math.min(rawPoints.length - 1, i + 2)];
    const cp1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension,
      y: p1.y + ((p2.y - p0.y) / 6) * tension,
    };
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension,
      y: p2.y - ((p3.y - p1.y) / 6) * tension,
    };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
  }
}

function getContourInterval(options: BuildLidarPlanMapOptions): number {
  return Math.min(Math.max(options.contourInterval ?? 0.5, 0.25), 0.5);
}

function getContourHeight(data: LidarPlanMapData, contourHeights: Float32Array, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= data.cols || row >= data.rows) return EMPTY_HEIGHT;
  const idx = row * data.cols + col;
  return data.occupancy[idx] ? contourHeights[idx] : EMPTY_HEIGHT;
}

function getContourHeightRange(data: LidarPlanMapData, contourHeights: Float32Array): { minZ: number; maxZ: number } {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < contourHeights.length; i++) {
    if (!data.occupancy[i] || !Number.isFinite(contourHeights[i])) continue;
    const z = contourHeights[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) return { minZ: 0, maxZ: 0 };
  return { minZ, maxZ };
}

function isMajorContourElevation(elevation: number): boolean {
  return Math.abs(elevation / 2 - Math.round(elevation / 2)) < 0.001;
}

function addContourIntersection(
  intersections: PlanPoint[],
  elevation: number,
  aValue: number,
  bValue: number,
  a: PlanPoint,
  b: PlanPoint
) {
  const aAbove = aValue >= elevation;
  const bAbove = bValue >= elevation;
  if (aAbove === bAbove || aValue === bValue) return;
  const t = clamp((elevation - aValue) / (bValue - aValue), 0, 1);
  intersections.push({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
}

function addContourSegmentsForSquare(
  segments: ContourSegment[],
  elevation: number,
  col: number,
  row: number,
  bottomLeft: number,
  bottomRight: number,
  topRight: number,
  topLeft: number
) {
  const p0 = { x: col + 0.5, y: row + 0.5 };
  const p1 = { x: col + 1.5, y: row + 0.5 };
  const p2 = { x: col + 1.5, y: row + 1.5 };
  const p3 = { x: col + 0.5, y: row + 1.5 };
  const intersections: PlanPoint[] = [];

  addContourIntersection(intersections, elevation, bottomLeft, bottomRight, p0, p1);
  addContourIntersection(intersections, elevation, bottomRight, topRight, p1, p2);
  addContourIntersection(intersections, elevation, topRight, topLeft, p2, p3);
  addContourIntersection(intersections, elevation, topLeft, bottomLeft, p3, p0);

  if (intersections.length === 2) {
    segments.push({ a: intersections[0], b: intersections[1] });
  } else if (intersections.length === 4) {
    segments.push({ a: intersections[0], b: intersections[1] });
    segments.push({ a: intersections[2], b: intersections[3] });
  }
}

function contourKey(point: PlanPoint): string {
  return `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`;
}

function polylineLength(points: PlanPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

function simplifyContourLine(points: PlanPoint[], tolerance: number): PlanPoint[] {
  if (points.length <= 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const closed = Math.hypot(first.x - last.x, first.y - last.y) < 0.001;
  if (!closed) return simplifyOpenPath(points, tolerance);

  const simplified = simplifyClosedPath(points.slice(0, -1), tolerance);
  return simplified.concat(simplified[0]);
}

function extendContourLine(
  points: PlanPoint[],
  atStart: boolean,
  adjacency: Map<string, number[]>,
  segments: ContourSegment[],
  used: Uint8Array
) {
  let key = contourKey(atStart ? points[0] : points[points.length - 1]);

  for (let guard = 0; guard < segments.length; guard++) {
    const candidates = adjacency.get(key) || [];
    const nextIndex = candidates.find(index => !used[index]);
    if (nextIndex === undefined) return;

    used[nextIndex] = 1;
    const segment = segments[nextIndex];
    const aKey = contourKey(segment.a);
    const nextPoint = aKey === key ? segment.b : segment.a;

    if (atStart) {
      points.unshift(nextPoint);
    } else {
      points.push(nextPoint);
    }

    key = contourKey(nextPoint);
  }
}

function connectContourSegments(
  segments: ContourSegment[],
  elevation: number,
  data: LidarPlanMapData,
  minContourLengthMeters: number
): LidarPlanContourLine[] {
  const adjacency = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const aKey = contourKey(segment.a);
    const bKey = contourKey(segment.b);
    const aBucket = adjacency.get(aKey);
    if (aBucket) aBucket.push(i);
    else adjacency.set(aKey, [i]);
    const bBucket = adjacency.get(bKey);
    if (bBucket) bBucket.push(i);
    else adjacency.set(bKey, [i]);
  }

  const lines: LidarPlanContourLine[] = [];
  const used = new Uint8Array(segments.length);
  const tolerance = clamp(0.28 / Math.max(data.cellSize, 0.001), 0.35, 2.4);

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const segment = segments[i];
    const points = [segment.a, segment.b];

    extendContourLine(points, false, adjacency, segments, used);
    extendContourLine(points, true, adjacency, segments, used);

    const simplified = simplifyContourLine(points, tolerance);
    const lengthMeters = polylineLength(simplified) * data.cellSize;
    if (lengthMeters < minContourLengthMeters || simplified.length < 2) continue;

    lines.push({
      elevation,
      major: isMajorContourElevation(elevation),
      lengthMeters,
      points: simplified,
    });
  }

  return lines;
}

export function buildLidarPlanContourLines(
  data: LidarPlanMapData,
  options: BuildLidarPlanMapOptions = {}
): LidarPlanContourLine[] {
  const contourInterval = getContourInterval(options);
  const minContourLengthMeters = Math.max(
    options.minContourLengthMeters ?? DEFAULT_MIN_CONTOUR_LENGTH_METERS,
    data.cellSize * 6
  );
  const contourHeights =
    data.contourHeights && data.contourHeights.length === data.heights.length
      ? data.contourHeights
      : data.heights;
  const range = getContourHeightRange(data, contourHeights);
  if (range.maxZ - range.minZ < contourInterval) return [];

  const segmentsByLevel = new Map<number, ContourSegment[]>();
  for (let row = 0; row < data.rows - 1; row++) {
    for (let col = 0; col < data.cols - 1; col++) {
      const bottomLeft = getContourHeight(data, contourHeights, col, row);
      const bottomRight = getContourHeight(data, contourHeights, col + 1, row);
      const topRight = getContourHeight(data, contourHeights, col + 1, row + 1);
      const topLeft = getContourHeight(data, contourHeights, col, row + 1);
      if (
        !Number.isFinite(bottomLeft) ||
        !Number.isFinite(bottomRight) ||
        !Number.isFinite(topRight) ||
        !Number.isFinite(topLeft)
      ) {
        continue;
      }

      const squareMin = Math.min(bottomLeft, bottomRight, topRight, topLeft);
      const squareMax = Math.max(bottomLeft, bottomRight, topRight, topLeft);
      const firstLevelKey = Math.floor(squareMin / contourInterval) + 1;
      const lastLevelKey = Math.floor(squareMax / contourInterval);

      for (let levelKey = firstLevelKey; levelKey <= lastLevelKey; levelKey++) {
        const elevation = levelKey * contourInterval;
        const segments = segmentsByLevel.get(levelKey);
        if (segments) {
          addContourSegmentsForSquare(segments, elevation, col, row, bottomLeft, bottomRight, topRight, topLeft);
        } else {
          const newSegments: ContourSegment[] = [];
          addContourSegmentsForSquare(newSegments, elevation, col, row, bottomLeft, bottomRight, topRight, topLeft);
          segmentsByLevel.set(levelKey, newSegments);
        }
      }
    }
  }

  const lines: LidarPlanContourLine[] = [];
  const sortedLevels = Array.from(segmentsByLevel.keys()).sort((a, b) => a - b);
  for (const levelKey of sortedLevels) {
    const segments = segmentsByLevel.get(levelKey);
    if (!segments || segments.length === 0) continue;
    lines.push(...connectContourSegments(segments, levelKey * contourInterval, data, minContourLengthMeters));
  }

  return lines;
}

function drawPlanMapContours(ctx: CanvasRenderingContext2D, data: LidarPlanMapData, padding: number, options: BuildLidarPlanMapOptions) {
  const lines = buildLidarPlanContourLines(data, options);
  if (lines.length === 0) return;
  const minorWidth = clamp(0.12 / Math.max(data.cellSize, 0.001), 0.65, 1.2);
  const majorWidth = clamp(0.2 / Math.max(data.cellSize, 0.001), 1.15, 2);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const major of [false, true]) {
    for (const line of lines) {
      if (line.major !== major) continue;
      const canvasPoints = line.points.map(point => toCanvasPoint(point, data, padding));
      const first = canvasPoints[0];
      const last = canvasPoints[canvasPoints.length - 1];
      const closed = canvasPoints.length > 3 && Math.hypot(first.x - last.x, first.y - last.y) < 0.001;

      ctx.beginPath();
      if (closed) {
        drawClosedBezierPath(ctx, canvasPoints.slice(0, -1));
      } else {
        drawOpenBezierPath(ctx, canvasPoints);
      }
      ctx.strokeStyle = major ? 'rgba(45, 37, 28, 0.72)' : 'rgba(92, 76, 56, 0.44)';
      ctx.lineWidth = major ? majorWidth : minorWidth;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawPlanMapOutlines(ctx: CanvasRenderingContext2D, data: LidarPlanMapData, padding: number, minOutlineLengthMeters: number) {
  const outlinePaths = traceOutlinePaths(data, minOutlineLengthMeters);
  if (outlinePaths.length === 0) return;
  const primaryOutline = outlinePaths[0];
  const lineWidth = clamp(0.42 / Math.max(data.cellSize, 0.001), 3.25, 8);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  drawClosedBezierPath(ctx, primaryOutline.points.map(point => toCanvasPoint(point, data, padding)));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
  ctx.lineWidth = lineWidth + 2;
  ctx.stroke();

  ctx.beginPath();
  drawClosedBezierPath(ctx, primaryOutline.points.map(point => toCanvasPoint(point, data, padding)));
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

export function renderLidarPlanMapToDataUrl(
  data: LidarPlanMapData,
  options: BuildLidarPlanMapOptions = {}
): LidarPlanMapRenderResult {
  const minOutlineLengthMeters = Math.max(0, options.minOutlineLengthMeters ?? DEFAULT_MIN_OUTLINE_LENGTH_METERS);
  const padding = 18;
  const width = data.cols + padding * 2;
  const height = data.rows + padding * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');

  const image = ctx.createImageData(width, height);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 246;
    pixels[i + 1] = 244;
    pixels[i + 2] = 238;
    pixels[i + 3] = 255;
  }

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = (y * width + x) * 4;
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = a;
  };

  for (let row = 0; row < data.rows; row++) {
    for (let col = 0; col < data.cols; col++) {
      const idx = row * data.cols + col;
      if (!data.occupancy[idx]) continue;
      const shade = shadeForCell(data, col, row);
      const x = padding + col;
      const y = padding + (data.rows - 1 - row);
      const normalizedZ = (data.heights[idx] - data.minZ) / Math.max(data.maxZ - data.minZ, 1);
      const relief = 0.76 + shade * 0.46;
      const r = Math.round((178 + normalizedZ * 30) * relief + 18);
      const g = Math.round((165 + normalizedZ * 26) * relief + 16);
      const b = Math.round((137 + normalizedZ * 20) * relief + 12);
      setPixel(x, y, clamp(r, 70, 245), clamp(g, 66, 236), clamp(b, 58, 218));
    }
  }

  ctx.putImageData(image, 0, 0);
  drawPlanMapContours(ctx, data, padding, options);
  drawPlanMapOutlines(ctx, data, padding, minOutlineLengthMeters);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}
