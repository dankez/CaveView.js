import { describe, it, expect } from 'vitest';
import {
  vec3Add,
  vec3Sub,
  vec3Scale,
  vec3Dot,
  vec3Cross,
  vec3Length,
  smin,
  pointToTriangleDistSq,
  pointToSegmentDist,
  sdfCapsule,
  sdfTetrahedron,
  triangulateSplaysOnSphere,
  buildSplayTetrahedrons,
  computeSplayBoundingBox,
} from '../splayMath';
import type { StationWithSplays } from '../../types/splayTypes';

describe('splayMath utilities', () => {
  it('performs basic vector operations correctly', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };

    expect(vec3Add(a, b)).toEqual({ x: 5, y: 7, z: 9 });
    expect(vec3Sub(b, a)).toEqual({ x: 3, y: 3, z: 3 });
    expect(vec3Scale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(vec3Dot(a, b)).toBe(1 * 4 + 2 * 5 + 3 * 6);
    expect(vec3Cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(vec3Length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5);
  });

  it('evaluates smooth-minimum (smin) correctly', () => {
    const a = 1.0;
    const b = 1.0;
    const smooth = smin(a, b, 0.4);
    // At equal values, smin(a, a, k) = a - k/4
    expect(smooth).toBeCloseTo(0.9);

    // When far apart, smin approximates min(a, b)
    expect(smin(1.0, 10.0, 0.4)).toBeCloseTo(1.0);
  });

  it('calculates point to triangle squared distance', () => {
    const v0 = { x: 0, y: 0, z: 0 };
    const v1 = { x: 2, y: 0, z: 0 };
    const v2 = { x: 0, y: 2, z: 0 };

    // Point directly above the center of triangle
    const pAbove = { x: 0.5, y: 0.5, z: 3.0 };
    expect(pointToTriangleDistSq(pAbove, v0, v1, v2)).toBeCloseTo(9.0);

    // Point outside along an edge
    const pOutside = { x: 3.0, y: 0, z: 0 };
    expect(pointToTriangleDistSq(pOutside, v0, v1, v2)).toBeCloseTo(1.0);
  });

  it('calculates point to segment distance and capsule SDF', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 0, z: 0 };

    const pMid = { x: 5, y: 2, z: 0 };
    expect(pointToSegmentDist(pMid, a, b)).toBeCloseTo(2.0);

    // Capsule with radius 2.5: distance is 2.0 - 2.5 = -0.5 (inside air)
    expect(sdfCapsule(pMid, a, b, 2.5)).toBeCloseTo(-0.5);

    // Capsule with radius 1.0: distance is 2.0 - 1.0 = +1.0 (outside rock)
    expect(sdfCapsule(pMid, a, b, 1.0)).toBeCloseTo(1.0);
  });

  it('evaluates signed distance to a 3D tetrahedron', () => {
    const tet = {
      a: { x: 0, y: 0, z: 0 },
      b: { x: 4, y: 0, z: 0 },
      c: { x: 0, y: 4, z: 0 },
      d: { x: 0, y: 0, z: 4 },
    };

    // Center point inside the tetrahedron
    const pInside = { x: 0.5, y: 0.5, z: 0.5 };
    const sdfIn = sdfTetrahedron(pInside, tet);
    expect(sdfIn).toBeLessThan(0); // Inside is negative

    // Point outside the tetrahedron
    const pOutside = { x: 5, y: 5, z: 5 };
    const sdfOut = sdfTetrahedron(pOutside, tet);
    expect(sdfOut).toBeGreaterThan(0); // Outside is positive
  });

  it('triangulates splay endpoints on a sphere', () => {
    const station = { x: 0, y: 0, z: 0 };
    const splays = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];

    const triangles = triangulateSplaysOnSphere(station, splays);
    // An octahedron on 6 orthogonal points has 8 triangular faces
    expect(triangles.length).toBe(8);
  });

  it('computes bounding box of stations and splays with padding', () => {
    const stations: StationWithSplays[] = [
      {
        position: { x: 10, y: 20, z: 30 },
        splays: [
          { x: 15, y: 22, z: 28 },
          { x: 5, y: 18, z: 35 },
        ],
      },
    ];

    const bbox = computeSplayBoundingBox(stations, 2.0);
    expect(bbox.min).toEqual({ x: 3, y: 16, z: 26 });
    expect(bbox.max).toEqual({ x: 17, y: 24, z: 37 });
  });
});
