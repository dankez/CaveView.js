import type {
  SplayWorkerInputMessage,
  SplayWorkerOutputMessage,
  SplayMeshGeometryData,
  SplaySdfGridData,
  StationWithSplays,
  SplayTetrahedron,
  SplayPoint,
  BoundingBox3D,
} from '../types/splayTypes';

import {
  vec3Normalize,
  smin,
  sdfCapsule,
  sdfTetrahedron,
  buildSplayTetrahedrons,
  computeSplayBoundingBox,
} from '../utils/splayMath';

/**
 * Surface Nets / Dual Isosurface Extractor inside Web Worker.
 * Extracts a watertight, smooth 2-manifold triangular mesh from the SDF volume.
 */

interface SpatialGridConfig {
  readonly origin: SplayPoint;
  readonly voxelSize: number;
  readonly dimX: number;
  readonly dimY: number;
  readonly dimZ: number;
}

/**
 * Evaluates the blended Signed Distance Function at a world coordinate P.
 * Uses spatial bounding bounding-box culling for maximum performance on mobile/web.
 */
function evaluateSDF(
  p: SplayPoint,
  tetrahedrons: readonly SplayTetrahedron[],
  tetBBoxes: readonly BoundingBox3D[],
  traverseCapsules: readonly { a: SplayPoint; b: SplayPoint; radius: number }[],
  smoothK: number
): number {
  let minSdf = 1e6;

  // 1. Evaluate Tetrahedrons with Bounding Box fast-rejection
  const tetCount = tetrahedrons.length;
  for (let i = 0; i < tetCount; i++) {
    const bbox = tetBBoxes[i];
    // Fast distance test to bounding box
    const dx = Math.max(0, Math.max(bbox.min.x - p.x, p.x - bbox.max.x));
    const dy = Math.max(0, Math.max(bbox.min.y - p.y, p.y - bbox.max.y));
    const dz = Math.max(0, Math.max(bbox.min.z - p.z, p.z - bbox.max.z));
    const boxDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // If point is too far outside this tetrahedron's influence compared to current minSdf, skip
    if (boxDist > minSdf + smoothK) {
      continue;
    }

    const d = sdfTetrahedron(p, tetrahedrons[i]);
    minSdf = smin(minSdf, d, smoothK);
  }

  // 2. Evaluate Traverse Connector Capsules
  const capCount = traverseCapsules.length;
  for (let i = 0; i < capCount; i++) {
    const cap = traverseCapsules[i];
    const d = sdfCapsule(p, cap.a, cap.b, cap.radius);
    minSdf = smin(minSdf, d, smoothK);
  }

  return minSdf;
}

/**
 * Computes the SDF normal via central differences.
 */
function computeSdfNormal(
  p: SplayPoint,
  tetrahedrons: readonly SplayTetrahedron[],
  tetBBoxes: readonly BoundingBox3D[],
  traverseCapsules: readonly { a: SplayPoint; b: SplayPoint; radius: number }[],
  smoothK: number,
  eps: number
): SplayPoint {
  const dx = evaluateSDF({ x: p.x + eps, y: p.y, z: p.z }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK) -
             evaluateSDF({ x: p.x - eps, y: p.y, z: p.z }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK);
  const dy = evaluateSDF({ x: p.x, y: p.y + eps, z: p.z }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK) -
             evaluateSDF({ x: p.x, y: p.y - eps, z: p.z }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK);
  const dz = evaluateSDF({ x: p.x, y: p.y, z: p.z + eps }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK) -
             evaluateSDF({ x: p.x, y: p.y, z: p.z - eps }, tetrahedrons, tetBBoxes, traverseCapsules, smoothK);

  return vec3Normalize({ x: dx, y: dy, z: dz });
}

/**
 * Surface Nets dual contouring algorithm.
 * Generates smooth vertices inside boundary cells and dual quads/triangles on crossing edges.
 */
function extractSurfaceNets(
  grid: Float32Array,
  gridConfig: SpatialGridConfig,
  isovalue: number,
  tetrahedrons: readonly SplayTetrahedron[],
  tetBBoxes: readonly BoundingBox3D[],
  traverseCapsules: readonly { a: SplayPoint; b: SplayPoint; radius: number }[],
  smoothK: number
): SplayMeshGeometryData {
  const { origin, voxelSize, dimX, dimY, dimZ } = gridConfig;
  const sliceSize = dimX * dimY;

  const getIndex = (x: number, y: number, z: number): number => x + y * dimX + z * sliceSize;

  // Track vertex IDs generated per active cell
  const cellVertexMap = new Int32Array(dimX * dimY * dimZ).fill(-1);

  const positionsList: number[] = [];
  const normalsList: number[] = [];
  const indicesList: number[] = [];

  const eps = voxelSize * 0.5;

  // 1. Dual Vertex Generation for active cells
  for (let z = 0; z < dimZ - 1; z++) {
    for (let y = 0; y < dimY - 1; y++) {
      for (let x = 0; x < dimX - 1; x++) {
        // Sample 8 corners of the voxel cell
        const v0 = grid[getIndex(x, y, z)] - isovalue;
        const v1 = grid[getIndex(x + 1, y, z)] - isovalue;
        const v2 = grid[getIndex(x, y + 1, z)] - isovalue;
        const v3 = grid[getIndex(x + 1, y + 1, z)] - isovalue;
        const v4 = grid[getIndex(x, y, z + 1)] - isovalue;
        const v5 = grid[getIndex(x + 1, y, z + 1)] - isovalue;
        const v6 = grid[getIndex(x, y + 1, z + 1)] - isovalue;
        const v7 = grid[getIndex(x + 1, y + 1, z + 1)] - isovalue;

        const mask =
          ((v0 > 0 ? 1 : 0) << 0) |
          ((v1 > 0 ? 1 : 0) << 1) |
          ((v2 > 0 ? 1 : 0) << 2) |
          ((v3 > 0 ? 1 : 0) << 3) |
          ((v4 > 0 ? 1 : 0) << 4) |
          ((v5 > 0 ? 1 : 0) << 5) |
          ((v6 > 0 ? 1 : 0) << 6) |
          ((v7 > 0 ? 1 : 0) << 7);

        // Entirely inside or entirely outside: no surface in this cell
        if (mask === 0 || mask === 0xff) {
          continue;
        }

        // Calculate average intersection point along crossing edges
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let edgeCount = 0;

        const addEdgeInterp = (
          x0: number, y0: number, z0: number, val0: number,
          x1: number, y1: number, z1: number, val1: number
        ): void => {
          if ((val0 > 0) !== (val1 > 0)) {
            const mu = (0 - val0) / (val1 - val0);
            sumX += x0 + mu * (x1 - x0);
            sumY += y0 + mu * (y1 - y0);
            sumZ += z0 + mu * (z1 - z0);
            edgeCount++;
          }
        };

        // 12 cell edges
        addEdgeInterp(x, y, z, v0, x + 1, y, z, v1);
        addEdgeInterp(x, y + 1, z, v2, x + 1, y + 1, z, v3);
        addEdgeInterp(x, y, z + 1, v4, x + 1, y, z + 1, v5);
        addEdgeInterp(x, y + 1, z + 1, v6, x + 1, y + 1, z + 1, v7);

        addEdgeInterp(x, y, z, v0, x, y + 1, z, v2);
        addEdgeInterp(x + 1, y, z, v1, x + 1, y + 1, z, v3);
        addEdgeInterp(x, y, z + 1, v4, x, y + 1, z + 1, v6);
        addEdgeInterp(x + 1, y, z + 1, v5, x + 1, y + 1, z + 1, v7);

        addEdgeInterp(x, y, z, v0, x, y, z + 1, v4);
        addEdgeInterp(x + 1, y, z, v1, x + 1, y, z + 1, v5);
        addEdgeInterp(x, y + 1, z, v2, x, y + 1, z + 1, v6);
        addEdgeInterp(x + 1, y + 1, z, v3, x + 1, y + 1, z + 1, v7);

        if (edgeCount > 0) {
          const inv = 1.0 / edgeCount;
          const worldX = origin.x + (sumX * inv) * voxelSize;
          const worldY = origin.y + (sumY * inv) * voxelSize;
          const worldZ = origin.z + (sumZ * inv) * voxelSize;

          const norm = computeSdfNormal(
            { x: worldX, y: worldY, z: worldZ },
            tetrahedrons,
            tetBBoxes,
            traverseCapsules,
            smoothK,
            eps
          );

          const vertexIdx = positionsList.length / 3;
          cellVertexMap[getIndex(x, y, z)] = vertexIdx;

          positionsList.push(worldX, worldY, worldZ);
          normalsList.push(norm.x, norm.y, norm.z);
        }
      }
    }
  }

  // 2. Dual Quad / Triangle Polygonization on crossing edges
  for (let z = 1; z < dimZ - 1; z++) {
    for (let y = 1; y < dimY - 1; y++) {
      for (let x = 1; x < dimX - 1; x++) {
        const val = grid[getIndex(x, y, z)] - isovalue;

        // X-axis edge check
        const valX = grid[getIndex(x + 1, y, z)] - isovalue;
        if ((val > 0) !== (valX > 0)) {
          const c00 = cellVertexMap[getIndex(x, y - 1, z - 1)];
          const c10 = cellVertexMap[getIndex(x, y, z - 1)];
          const c11 = cellVertexMap[getIndex(x, y, z)];
          const c01 = cellVertexMap[getIndex(x, y - 1, z)];

          if (c00 >= 0 && c10 >= 0 && c11 >= 0 && c01 >= 0) {
            if (val > 0) {
              indicesList.push(c00, c10, c11, c00, c11, c01);
            } else {
              indicesList.push(c00, c11, c10, c00, c01, c11);
            }
          }
        }

        // Y-axis edge check
        const valY = grid[getIndex(x, y + 1, z)] - isovalue;
        if ((val > 0) !== (valY > 0)) {
          const c00 = cellVertexMap[getIndex(x - 1, y, z - 1)];
          const c10 = cellVertexMap[getIndex(x, y, z - 1)];
          const c11 = cellVertexMap[getIndex(x, y, z)];
          const c01 = cellVertexMap[getIndex(x - 1, y, z)];

          if (c00 >= 0 && c10 >= 0 && c11 >= 0 && c01 >= 0) {
            if (val > 0) {
              indicesList.push(c00, c11, c10, c00, c01, c11);
            } else {
              indicesList.push(c00, c10, c11, c00, c11, c01);
            }
          }
        }

        // Z-axis edge check
        const valZ = grid[getIndex(x, y, z + 1)] - isovalue;
        if ((val > 0) !== (valZ > 0)) {
          const c00 = cellVertexMap[getIndex(x - 1, y - 1, z)];
          const c10 = cellVertexMap[getIndex(x, y - 1, z)];
          const c11 = cellVertexMap[getIndex(x, y, z)];
          const c01 = cellVertexMap[getIndex(x - 1, y, z)];

          if (c00 >= 0 && c10 >= 0 && c11 >= 0 && c01 >= 0) {
            if (val > 0) {
              indicesList.push(c00, c10, c11, c00, c11, c01);
            } else {
              indicesList.push(c00, c11, c10, c00, c01, c11);
            }
          }
        }
      }
    }
  }

  const positions = new Float32Array(positionsList);
  const normals = new Float32Array(normalsList);
  const indices = new Uint32Array(indicesList);

  return {
    positions,
    normals,
    indices,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  };
}

/**
 * Worker message dispatcher.
 */
self.onmessage = (e: MessageEvent<SplayWorkerInputMessage>) => {
  const startTime = performance.now();
  const { type, stations, config } = e.data;

  try {
    if (!stations || stations.length === 0) {
      const errorResponse: SplayWorkerOutputMessage = {
        status: 'error',
        error: 'No stations provided for splay wall generation.',
      };
      self.postMessage(errorResponse);
      return;
    }

    // 1. Build Tetrahedrons
    const tetrahedrons = buildSplayTetrahedrons(stations);

    // Compute bounding boxes for each tetrahedron for O(1) broadphase rejection
    const tetBBoxes: BoundingBox3D[] = tetrahedrons.map(t => {
      const minX = Math.min(t.a.x, t.b.x, t.c.x, t.d.x);
      const minY = Math.min(t.a.y, t.b.y, t.c.y, t.d.y);
      const minZ = Math.min(t.a.z, t.b.z, t.c.z, t.d.z);
      const maxX = Math.max(t.a.x, t.b.x, t.c.x, t.d.x);
      const maxY = Math.max(t.a.y, t.b.y, t.c.y, t.d.y);
      const maxZ = Math.max(t.a.z, t.b.z, t.c.z, t.d.z);
      return {
        min: { x: minX - config.smoothK, y: minY - config.smoothK, z: minZ - config.smoothK },
        max: { x: maxX + config.smoothK, y: maxY + config.smoothK, z: maxZ + config.smoothK },
      };
    });

    // 2. Build Traverse Connector Capsules & Splay Rays
    const traverseCapsules: { a: SplayPoint; b: SplayPoint; radius: number }[] = [];
    for (const st of stations) {
      if (config.includeTraverseCapsules && st.connectedTo) {
        for (const conn of st.connectedTo) {
          traverseCapsules.push({
            a: st.position,
            b: conn,
            radius: config.capsuleRadius,
          });
        }
      }
      if (st.splays && st.splays.length > 0) {
        for (const sp of st.splays) {
          traverseCapsules.push({
            a: st.position,
            b: sp,
            radius: config.capsuleRadius * 0.75,
          });
        }
      }
    }

    // 3. Compute Global Bounding Box & Grid Resolution
    const bbox = computeSplayBoundingBox(stations, config.padding);
    let voxelSize = Math.max(0.08, config.voxelSize || 0.22);

    const spanX = bbox.max.x - bbox.min.x;
    const spanY = bbox.max.y - bbox.min.y;
    const spanZ = bbox.max.z - bbox.min.z;

    // Desktop & Web guard: clamp max grid dimensions to avoid OOM
    const maxDim = 260;
    if (spanX / voxelSize > maxDim || spanY / voxelSize > maxDim || spanZ / voxelSize > maxDim) {
      const largestSpan = Math.max(spanX, spanY, spanZ);
      voxelSize = largestSpan / maxDim;
    }

    const dimX = Math.max(3, Math.ceil(spanX / voxelSize) + 1);
    const dimY = Math.max(3, Math.ceil(spanY / voxelSize) + 1);
    const dimZ = Math.max(3, Math.ceil(spanZ / voxelSize) + 1);

    const totalVoxels = dimX * dimY * dimZ;
    const gridBuffer = new Float32Array(totalVoxels);

    const gridConfig: SpatialGridConfig = {
      origin: bbox.min,
      voxelSize,
      dimX,
      dimY,
      dimZ,
    };

    // 4. Fill SDF Grid
    const sliceSize = dimX * dimY;
    const progressInterval = Math.max(1, Math.floor(dimZ / 15));

    for (let z = 0; z < dimZ; z++) {
      const pz = bbox.min.z + z * voxelSize;
      const zOffset = z * sliceSize;

      for (let y = 0; y < dimY; y++) {
        const py = bbox.min.y + y * voxelSize;
        const yOffset = y * dimX;

        for (let x = 0; x < dimX; x++) {
          const px = bbox.min.x + x * voxelSize;
          const idx = x + yOffset + zOffset;

          gridBuffer[idx] = evaluateSDF(
            { x: px, y: py, z: pz },
            tetrahedrons,
            tetBBoxes,
            traverseCapsules,
            config.smoothK
          );
        }
      }

      // Periodically report progress to main thread
      if (z % progressInterval === 0 || z === dimZ - 1) {
        const percent = Math.min(90, Math.round((z / dimZ) * 85) + 5);
        const progressMsg: SplayWorkerOutputMessage = {
          status: 'progress',
          progress: percent,
          message: `Generujem Splay SDF steny (${percent}%)...`,
        };
        self.postMessage(progressMsg);
      }
    }

    const durationMs = performance.now() - startTime;

    if (type === 'GENERATE_SDF_GRID') {
      const sdfGridPayload: SplaySdfGridData = {
        buffer: gridBuffer,
        dims: [dimX, dimY, dimZ],
        origin: [bbox.min.x, bbox.min.y, bbox.min.z],
        voxelSize,
      };

      const response: SplayWorkerOutputMessage = {
        status: 'success',
        sdfGrid: sdfGridPayload,
        durationMs,
      };

      // Zero-copy transfer of the grid buffer
      self.postMessage(response, { transfer: [gridBuffer.buffer] });
      return;
    }

    // 5. Extract Surface Mesh (Surface Nets)
    const extractProgressMsg: SplayWorkerOutputMessage = {
      status: 'progress',
      progress: 92,
      message: 'Extrahuje sa 3D povrch (Surface Nets)...',
    };
    self.postMessage(extractProgressMsg);

    const geometry = extractSurfaceNets(
      gridBuffer,
      gridConfig,
      config.isovalue,
      tetrahedrons,
      tetBBoxes,
      traverseCapsules,
      config.smoothK
    );

    const totalDuration = performance.now() - startTime;

    const successResponse: SplayWorkerOutputMessage = {
      status: 'success',
      geometry,
      durationMs: totalDuration,
    };

    // Zero-copy transfer of typed array buffers (positions, normals, indices)
    self.postMessage(successResponse, {
      transfer: [
        geometry.positions.buffer,
        geometry.normals.buffer,
        geometry.indices.buffer,
      ],
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorResponse: SplayWorkerOutputMessage = {
      status: 'error',
      error: errorMsg,
    };
    self.postMessage(errorResponse);
  }
};
