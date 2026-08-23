import type { SplayPoint, SplayTetrahedron, StationWithSplays, BoundingBox3D } from '../types/splayTypes';

/**
 * 3D vector math utility functions for splay processing and SDF calculations.
 */

export function vec3Add(a: SplayPoint, b: SplayPoint): SplayPoint {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a: SplayPoint, b: SplayPoint): SplayPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v: SplayPoint, s: number): SplayPoint {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Dot(a: SplayPoint, b: SplayPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Cross(a: SplayPoint, b: SplayPoint): SplayPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3LengthSq(v: SplayPoint): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function vec3Length(v: SplayPoint): number {
  return Math.sqrt(vec3LengthSq(v));
}

export function vec3Normalize(v: SplayPoint): SplayPoint {
  const len = vec3Length(v);
  if (len < 1e-8) return { x: 0, y: 0, z: 0 };
  const inv = 1.0 / len;
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

export function vec3DistSq(a: SplayPoint, b: SplayPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function vec3Dist(a: SplayPoint, b: SplayPoint): number {
  return Math.sqrt(vec3DistSq(a, b));
}

/**
 * Polynomial smooth-minimum function (Inigo Quilez smin).
 * Smoothly blends two signed distance values with a blending radius k.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 1e-6) {
    return Math.min(a, b);
  }
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * Calculates the squared distance from point P to a 3D line segment (A, B).
 */
export function pointToSegmentDistSq(p: SplayPoint, a: SplayPoint, b: SplayPoint): number {
  const ab = vec3Sub(b, a);
  const ap = vec3Sub(p, a);
  const lenSq = vec3LengthSq(ab);
  if (lenSq < 1e-8) {
    return vec3DistSq(p, a);
  }
  const t = Math.max(0, Math.min(1, vec3Dot(ap, ab) / lenSq));
  const proj = vec3Add(a, vec3Scale(ab, t));
  return vec3DistSq(p, proj);
}

/**
 * Computes the minimum squared distance from point P to a 3D triangle (V0, V1, V2).
 * Standard Voronoi region classification.
 */
export function pointToTriangleDistSq(
  p: SplayPoint,
  v0: SplayPoint,
  v1: SplayPoint,
  v2: SplayPoint
): number {
  const ab = vec3Sub(v1, v0);
  const ac = vec3Sub(v2, v0);
  const ap = vec3Sub(p, v0);

  const d1 = vec3Dot(ab, ap);
  const d2 = vec3Dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return vec3DistSq(p, v0); // Vertex region V0

  const bp = vec3Sub(p, v1);
  const d3 = vec3Dot(ab, bp);
  const d4 = vec3Dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return vec3DistSq(p, v1); // Vertex region V1

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return vec3DistSq(p, vec3Add(v0, vec3Scale(ab, v))); // Edge region AB
  }

  const cp = vec3Sub(p, v2);
  const d5 = vec3Dot(ab, cp);
  const d6 = vec3Dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return vec3DistSq(p, v2); // Vertex region V2

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return vec3DistSq(p, vec3Add(v0, vec3Scale(ac, w))); // Edge region AC
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return vec3DistSq(p, vec3Add(v1, vec3Scale(vec3Sub(v2, v1), w))); // Edge region BC
  }

  // Inside triangle face region
  const denom = 1.0 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  const closest = vec3Add(v0, vec3Add(vec3Scale(ab, v), vec3Scale(ac, w)));
  return vec3DistSq(p, closest);
}

/**
 * Calculates the Signed Distance from point P to a 3D line segment (Capsule SDF core).
 */
export function pointToSegmentDist(p: SplayPoint, a: SplayPoint, b: SplayPoint): number {
  return Math.sqrt(pointToSegmentDistSq(p, a, b));
}

/**
 * Capsule SDF: negative inside (air), positive outside (rock).
 */
export function sdfCapsule(p: SplayPoint, a: SplayPoint, b: SplayPoint, radius: number): number {
  const dist = pointToSegmentDist(p, a, b);
  return dist - radius;
}

/**
 * Tests if point P is inside a 3D tetrahedron (A, B, C, D).
 */
function isPointInsideTetrahedron(
  p: SplayPoint,
  a: SplayPoint,
  b: SplayPoint,
  c: SplayPoint,
  d: SplayPoint
): boolean {
  // Compute scalar triple products (oriented volumes)
  const vol = (p1: SplayPoint, p2: SplayPoint, p3: SplayPoint, p4: SplayPoint): number => {
    const v12 = vec3Sub(p2, p1);
    const v13 = vec3Sub(p3, p1);
    const v14 = vec3Sub(p4, p1);
    return vec3Dot(vec3Cross(v12, v13), v14);
  };

  const v0 = vol(a, b, c, d);
  if (Math.abs(v0) < 1e-9) return false;

  const sign0 = v0 > 0;
  const v1 = vol(p, b, c, d);
  const v2 = vol(a, p, c, d);
  const v3 = vol(a, b, p, d);
  const v4 = vol(a, b, c, p);

  return (v1 > 0 === sign0) && (v2 > 0 === sign0) && (v3 > 0 === sign0) && (v4 > 0 === sign0);
}

/**
 * Computes exact Signed Distance Function (SDF) of a point to a 3D Tetrahedron.
 * Returns negative if inside empty air, positive if outside rock.
 */
export function sdfTetrahedron(p: SplayPoint, tet: SplayTetrahedron): number {
  const d0Sq = pointToTriangleDistSq(p, tet.a, tet.b, tet.c);
  const d1Sq = pointToTriangleDistSq(p, tet.a, tet.c, tet.d);
  const d2Sq = pointToTriangleDistSq(p, tet.a, tet.d, tet.b);
  const d3Sq = pointToTriangleDistSq(p, tet.b, tet.c, tet.d);

  const minDist = Math.sqrt(Math.min(d0Sq, d1Sq, d2Sq, d3Sq));
  const inside = isPointInsideTetrahedron(p, tet.a, tet.b, tet.c, tet.d);

  return inside ? -minDist : minDist;
}

/**
 * Spherical Delaunay Triangulation for splay endpoints originating from a station.
 * 
 * Projects splay directions onto the unit sphere and computes the 3D Convex Hull
 * of the spherical points. The resulting triangular faces correspond to the
 * spherical Delaunay triangles on the sphere surrounding the station.
 */
export function triangulateSplaysOnSphere(
  station: SplayPoint,
  splays: readonly SplayPoint[]
): readonly [number, number, number][] {
  const n = splays.length;
  if (n < 3) return [];

  // Compute unit directions on the unit sphere
  const unitDirs: SplayPoint[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    const dir = vec3Sub(splays[i], station);
    const len = vec3Length(dir);
    if (len > 1e-4) {
      unitDirs.push(vec3Scale(dir, 1.0 / len));
      validIndices.push(i);
    }
  }

  const pointCount = unitDirs.length;
  if (pointCount < 3) return [];

  if (pointCount === 3) {
    return [[validIndices[0], validIndices[1], validIndices[2]]];
  }

  // 3D convex hull for points on the unit sphere
  const triangles: [number, number, number][] = [];

  for (let i = 0; i < pointCount - 2; i++) {
    for (let j = i + 1; j < pointCount - 1; j++) {
      for (let k = j + 1; k < pointCount; k++) {
        const p1 = unitDirs[i];
        const p2 = unitDirs[j];
        const p3 = unitDirs[k];

        // Normal of the triangle plane
        const normal = vec3Cross(vec3Sub(p2, p1), vec3Sub(p3, p1));
        const normLen = vec3Length(normal);
        if (normLen < 1e-6) continue;

        const un = vec3Scale(normal, 1.0 / normLen);
        const planeD = vec3Dot(un, p1);

        let orientedNormal = un;
        let orientedD = planeD;
        if (orientedD < 0) {
          orientedNormal = vec3Scale(un, -1);
          orientedD = -planeD;
        }

        let isHullFace = true;
        for (let m = 0; m < pointCount; m++) {
          if (m === i || m === j || m === k) continue;
          const distToPlane = vec3Dot(orientedNormal, unitDirs[m]) - orientedD;
          if (distToPlane > 1e-4) {
            isHullFace = false;
            break;
          }
        }

        if (isHullFace) {
          triangles.push([validIndices[i], validIndices[j], validIndices[k]]);
        }
      }
    }
  }

  return triangles;
}

/**
 * Builds all empty-space tetrahedrons for a set of stations and their radial splays.
 */
export function buildSplayTetrahedrons(stations: readonly StationWithSplays[]): SplayTetrahedron[] {
  const tetrahedrons: SplayTetrahedron[] = [];

  for (const st of stations) {
    if (!st.splays || st.splays.length < 3) continue;

    const triIndices = triangulateSplaysOnSphere(st.position, st.splays);
    for (const [i1, i2, i3] of triIndices) {
      tetrahedrons.push({
        a: st.position,
        b: st.splays[i1],
        c: st.splays[i2],
        d: st.splays[i3],
      });
    }
  }

  return tetrahedrons;
}

/**
 * Computes 3D Bounding Box around all stations, splay endpoints, and padding.
 */
export function computeSplayBoundingBox(
  stations: readonly StationWithSplays[],
  padding: number = 1.0
): BoundingBox3D {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const update = (p: SplayPoint): void => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  };

  for (const st of stations) {
    update(st.position);
    for (const sp of st.splays) {
      update(sp);
    }
    if (st.connectedTo) {
      for (const ct of st.connectedTo) {
        update(ct);
      }
    }
  }

  if (!isFinite(minX)) {
    return {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    };
  }

  return {
    min: { x: minX - padding, y: minY - padding, z: minZ - padding },
    max: { x: maxX + padding, y: maxY + padding, z: maxZ + padding },
  };
}
