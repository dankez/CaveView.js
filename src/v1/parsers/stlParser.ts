import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import type { ParsedCave, Vec3, Scrap, StationLabel } from '@shared/types';

/**
 * STL Parser for LochViewer.
 * Treats the STL mesh as a single large 'Scrap' in the v1 Engine.
 */
export function parseStl(buffer: ArrayBuffer): ParsedCave {
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  
  if (!geometry.attributes.position) {
    throw new Error('STL file has no position data');
  }

  const positions = geometry.attributes.position.array as Float32Array;
  const vertexCount = positions.length / 3;
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const vertices: Vec3[] = [];
  
  // Extract vertices and compute bounds
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;

    vertices.push({ x, y, z });
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  // Center the vertices for v1 coordinate system
  const centeredVertices = vertices.map(v => ({
    x: v.x - cx,
    y: v.y - cy,
    z: v.z - cz
  }));

  // STL is usually unindexed (flat triangles), but we can create a simple face array
  const faces: number[][] = [];
  for (let i = 0; i < vertexCount; i += 3) {
    faces.push([i, i + 1, i + 2]);
  }

  const mainScrap: Scrap = {
    vertices: centeredVertices,
    faces: faces,
    survey: 1
  };

  // v1 Engine expects at least one station to center the view
  const centerStation: Vec3 = { x: 0, y: 0, z: 0 };
  const label: StationLabel = {
    pos: centerStation,
    name: 'MODEL_CENTER',
    altitude: cz
  };

  return {
    segments: [],
    stations: [centerStation],
    stationLabels: [label],
    scraps: [mainScrap],
    surfaces: [],
    bounds: {
      min: { x: minX - cx, y: minY - cy, z: minZ - cz },
      max: { x: maxX - cx, y: maxY - cy, z: maxZ - cz },
      center: { x: 0, y: 0, z: 0 },
      size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    },
    centerOffset: { x: cx, y: cy, z: cz },
    stationCount: 1,
    segmentCount: 0,
    scrapCount: 1,
    pointCount: 0,
    hasSurface: false,
    isLiDAR: false
  };
}
