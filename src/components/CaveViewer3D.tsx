import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Html, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { reconstructSurface } from '../utils/surfaceReconstruction'

import { downloadTiledXyz, downloadWmsImage } from '../utils/XyzTileDownloader'
import type { ParsedCave, CaveSurface, Segment } from '../parsers/caveParser'
import type { SelStation } from '../App'

// ─── BVH Initialization ───────────────────────────────────────────────────────
// @ts-ignore
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const _tri = new THREE.Triangle();
const _line = new THREE.Line3();

/**
 * Robust intersection between a triangle and a plane.
 * Returns 2 points if they intersect, forming a line segment.
 */
function intersectTrianglePlane(tri: THREE.Triangle, plane: THREE.Plane, outPoints: THREE.Vector3[]) {
  let count = 0;
  const vertices = [tri.a, tri.b, tri.c];
  
  for (let i = 0; i < 3; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % 3];
    _line.set(v1, v2);
    
    const intersection = plane.intersectLine(_line, new THREE.Vector3());
    if (intersection) {
      // Avoid duplicate points at vertices
      let exists = false;
      for (let j = 0; j < count; j++) {
        if (outPoints[j].distanceToSquared(intersection) < 1e-6) {
          exists = true;
          break;
        }
      }
      if (!exists && count < 2) {
        outPoints[count].copy(intersection);
        count++;
      }
    }
  }
  return count === 2;
}

// ─── Clipping Edges Highlight Component ───────────────────────────────────────
const ClippingEdges = React.memo(({ geo, planes, active, color = "#ff4444" }: { geo: THREE.BufferGeometry | null, planes: THREE.Plane[], active: boolean, color?: string }) => {
  const lineRef = useRef<THREE.LineSegments>(null!);
  const [lineGeo] = useState(() => new THREE.BufferGeometry());
  // Pre-allocate buffer for up to 5000 segments (10000 points)
  const [posAttr] = useState(() => new THREE.BufferAttribute(new Float32Array(30000), 3));
  const p1 = useMemo(() => new THREE.Vector3(), []);
  const p2 = useMemo(() => new THREE.Vector3(), []);
  const points = useMemo(() => [p1, p2], [p1, p2]);

  useEffect(() => {
    lineGeo.setAttribute('position', posAttr);
  }, [lineGeo, posAttr]);

  useEffect(() => {
    if (!active || planes.length === 0 || !geo || !geo.boundsTree || !lineRef.current) {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;
    let segmentCount = 0;
    const array = posAttr.array as Float32Array;

    planes.forEach(plane => {
      // @ts-ignore
      geo.boundsTree.shapecast({
        intersectsBounds: box => plane.intersectsBox(box),
        intersectsTriangle: (tri) => {
          if (intersectTrianglePlane(tri, plane, points)) {
            const idx = segmentCount * 6;
            if (idx + 5 < array.length) {
              array[idx]   = points[0].x; array[idx+1] = points[0].y; array[idx+2] = points[0].z;
              array[idx+3] = points[1].x; array[idx+4] = points[1].y; array[idx+5] = points[1].z;
              segmentCount++;
            }
          }
        }
      });
    });

    lineGeo.setDrawRange(0, segmentCount * 2);
    posAttr.needsUpdate = true;
  }, [geo, planes, active]);

  return (
    <lineSegments ref={lineRef} geometry={lineGeo} renderOrder={1000} frustumCulled={false}>
      <lineBasicMaterial color={color} linewidth={3} depthTest={false} transparent opacity={1.0} />
    </lineSegments>
  );
});

// ─── LiDAR Classification Colors ──────────────────────────────────────────────
const CLASSIFICATION_COLORS: Record<number, THREE.Color> = {
  1:  new THREE.Color(0x888888), // Unclassified
  2:  new THREE.Color(0xd2b48c), // Ground (Tan)
  3:  new THREE.Color(0x228b22), // Low Veg
  4:  new THREE.Color(0x006400), // Medium Veg
  5:  new THREE.Color(0x004d00), // High Veg
  6:  new THREE.Color(0xff0000), // Building
  10: new THREE.Color(0x4169e1), // Custom: Cave (Royal Blue)
};

// ─── Point Cloud (LiDAR) ──────────────────────────────────────────────────────
const PointCloud = React.memo(({ cave, options, clippingPlanes, onSurfaceClick, isMoving }: { cave: ParsedCave, options: ViewerOptions, clippingPlanes: any[], onSurfaceClick?: any, isMoving?: boolean }) => {
  // Ak je zapnuté vyhladenie (Organic), presný mesh (Accurate), drôtený model alebo Surface Nets, mračno bodov skryjeme
  if (options.smoothScraps || options.accurateScraps || options.scrapsWireframe || options.useSurfaceNet) return null;

  const pointsRef = useRef<THREE.Points>(null!);

  // ── Zostavenie geometrie + stride-based LOD indexov ──────────────────────
  // Stride = každý K-tý bod → ROVNOMERNÉ pokrytie celého modelu
  const { geo, lods } = useMemo(() => {
    const empty = { geo: null as THREE.BufferGeometry|null, lods: [] as Uint32Array[] };
    if (!cave.points || cave.pointCount === 0) return empty;
    
    const count  = cave.pointCount;
    const pos    = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const minZ   = cave.bounds.min.z;
    const maxZ   = cave.bounds.max.z;
    const hasClr = cave.pointColors && cave.pointColors.length >= count * 3;

    for (let i = 0; i < count; i++) {
      const p = i * 3;
      const x = cave.points[p], y = cave.points[p+1], z = cave.points[p+2];

      if (cave.pointClassification && cave.pointClassification.length > i) {
        const cls = cave.pointClassification[i];
        if (cls >= 3 && cls <= 5 && !options.showVegetation) continue;
        if (cls === 2  && !options.showGround)    continue;
        if (cls === 10 && !options.showCaveLiDAR) continue;
      }

      pos[p] = x; pos[p+1] = z; pos[p+2] = -y;

      if (options.scrapsAltitude) {
        const c = elevColor(normZ(z, minZ, maxZ));
        colors[p] = c.r; colors[p+1] = c.g; colors[p+2] = c.b;
      } else if (hasClr) {
        colors[p] = cave.pointColors![p]; colors[p+1] = cave.pointColors![p+1]; colors[p+2] = cave.pointColors![p+2];
      } else {
        colors[p] = 1; colors[p+1] = 1; colors[p+2] = 1;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const buildIdx = (stride: number) => {
      const n = Math.ceil(count / stride);
      const idx = new Uint32Array(n);
      for (let j = 0; j < n; j++) idx[j] = Math.min(j * stride, count - 1);
      return idx;
    };

    // 5 úrovní kvality: [0]=16x, [1]=8x, [2]=4x, [3]=2x, [4]=1x (plná)
    return {
      geo:  g,
      lods: [buildIdx(16), buildIdx(8), buildIdx(4), buildIdx(2), buildIdx(1)]
    };
  }, [cave.points, cave.pointCount, cave.bounds, options.scrapsAltitude, options.showVegetation, options.showGround, options.showCaveLiDAR]);

  // ── Progresívne zjemňovanie (Refinement) v useFrame ───────────────────────
  const lodState = useRef({ index: 0, lastUpdate: 0 });

  useFrame((state) => {
    if (!pointsRef.current || !geo || lods.length === 0) return;

    const now = state.clock.getElapsedTime() * 1000;
    const targetIdx = isMoving ? 0 : 4; // pri pohybe 16x, v kľude 1x (plná)

    // Ak sa pohybujeme, okamžite skočíme na najnižšiu kvalitu
    if (isMoving) {
      if (lodState.current.index !== 0) {
        lodState.current.index = 0;
        geo.setIndex(new THREE.BufferAttribute(lods[0], 1));
        geo.index!.needsUpdate = true;
      }
      return;
    }

    // Ak stojíme a ešte nie sme na plnej kvalite, postupne pridávame body
    if (lodState.current.index < 4 && now - lodState.current.lastUpdate > 150) {
      lodState.current.index++;
      lodState.current.lastUpdate = now;
      geo.setIndex(new THREE.BufferAttribute(lods[lodState.current.index], 1));
      geo.index!.needsUpdate = true;
    }
  });

  if (!geo) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geo}
      renderOrder={15}
      onPointerDown={(e) => {
        if (!onSurfaceClick) return;
        e.stopPropagation();
        const p = e.point;
        onSurfaceClick(p.x + cave.centerOffset.x, -p.z + cave.centerOffset.y, p.y + cave.centerOffset.z, e.clientX, e.clientY);
      }}
    >
      <pointsMaterial
        vertexColors
        size={0.15}
        sizeAttenuation={true}
        transparent={options.scrapsOpacity < 1}
        opacity={options.scrapsOpacity}
        clippingPlanes={clippingPlanes}
      />
    </points>
  );
});


const OrganicShell = React.memo(({ cave, options, clippingPlanes, onSurfaceClick, isMoving }: { cave: ParsedCave, options: ViewerOptions, clippingPlanes: any[], onSurfaceClick?: any, isMoving?: boolean }) => {
  // Organický voxelový model používame LEN pre LiDAR mračná bodov.
  // Pre LOX (bežné jaskyne) používame vyhladenie pôvodných stien (CaveScraps).
  if (!cave.isLiDAR) return null;
  if (!options.smoothScraps && !options.accurateScraps && !options.scrapsWireframe) return null;

  const geo = useMemo(() => {
    if (!cave.points || cave.points.length === 0) return null;
    
    const vSize = 0.3; 
    const dilation = 0.2; 

    // ── Filtrovanie bodov pre rekonštrukciu ──
    // PROBLÉM PRED OPRAVOU: classifyLiDAR() klasifikovala horné steny jaskyne
    //   ako Vegetation(4), čo spôsobilo orezanie stropu pri rekonštrukcii.
    //
    // PRAVIDLO: Filtrujeme LEN ak PLY súbor obsahuje NATÍVNU klasifikáciu
    //   (z externého softvéru ako CloudCompare/Leica/FARO).
    //   Natívna = aspoň jeden bod má triedu > 1.
    //   Ak nie je natívna, použijeme VŠETKY body (strop aj steny).
    let reconstructionPoints = cave.points;
    const hasNativeClasses = cave.pointClassification && 
      Array.from(cave.pointClassification).some(c => c > 1);
    
    if (hasNativeClasses && cave.pointClassification) {
      // Natívna klasifikácia: vylúč len jednoznačný vonkajší terén
      const filtered: number[] = [];
      for (let i = 0; i < cave.pointCount; i++) {
        const cls = cave.pointClassification[i];
        // Zachovaj všetko OKREM Ground(2) a Outdoor Vegetation(4)
        if (cls !== 2 && cls !== 4) { 
          filtered.push(cave.points![i*3], cave.points![i*3+1], cave.points![i*3+2]);
        }
      }
      reconstructionPoints = new Float32Array(filtered);
    }
    // Ak hasNativeClasses=false → reconstructionPoints = cave.points (VŠETKY body) ✓

    if (reconstructionPoints.length === 0) return null;

    const g = reconstructSurface(
      reconstructionPoints, 
      vSize, 
      options.accurateScraps, 
      options.organicLevel, 
      true, 
      undefined,
      dilation
    );
    
    if (!g.getAttribute('position')) return null;
    
    // @ts-ignore
    g.computeBoundsTree();
    
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const minZ = cave.bounds.min.z;
    const maxZ = cave.bounds.max.z;
    
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      pos.setXYZ(i, px, pz, -py);

      if (options.scrapsAltitude) {
        const alt = pos.getY(i); 
        const c = elevColor(normZ(alt, minZ, maxZ));
        colors[i * 3]     = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      } else {
        colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
      }
    }
    
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [cave.points, cave.pointClassification, cave.pointCount, cave.bounds, options.scrapsAltitude, options.smoothScraps, options.accurateScraps, options.organicLevel, options.colorScraps]);

  if (!geo) return null;
  const showSolid = options.smoothScraps || options.accurateScraps;

  return (
    <>
      {showSolid && (
        <mesh 
          geometry={geo} 
          renderOrder={10}
          onPointerDown={(e) => {
            if (!onSurfaceClick) return;
            e.stopPropagation();
            const p = e.point;
            onSurfaceClick(p.x + cave.centerOffset.x, -p.z + cave.centerOffset.y, p.y + cave.centerOffset.z, e.clientX, e.clientY);
          }}
        >
          <meshStandardMaterial 
            vertexColors={true}
            color={options.scrapsAltitude ? '#ffffff' : options.colorScraps} 
            side={THREE.DoubleSide}
            roughness={0.6}
            metalness={0.1}
            transparent={options.scrapsOpacity < 1}
            opacity={options.scrapsOpacity}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}
      
      {options.scrapsWireframe && (
        <mesh geometry={geo} renderOrder={11}>
          <meshBasicMaterial 
            vertexColors={true}
            color={options.scrapsAltitude ? '#ffffff' : options.colorScraps} 
            wireframe={true} 
            transparent={true} 
            opacity={showSolid ? 0.4 : 0.8} 
            clippingPlanes={clippingPlanes} 
          />
        </mesh>
      )}
      
      <ClippingEdges geo={geo} planes={clippingPlanes} active={options.showClippingEdges} color={options.colorClippingEdges} />
    </>
  );
})

// ─── ViewerOptions ────────────────────────────────────────────────────────────
export interface ViewerOptions {
  // Survey
  showSplay:           boolean
  // Stations
  showStations:        boolean
  showStationNames:    boolean
  showStationAlt:      boolean
  showEntrances:       boolean
  showEntranceLabels:  boolean
  // Grid
  showGrid:            boolean
  colorGrid:           string
  colorBoundingBox:    string
  showBoundingBox:     boolean
  // Cave scraps (walls)
  showScraps:          boolean
  scrapsOpacity:       number
  scrapsSolid:         boolean
  scrapsWireframe:     boolean
  scrapsAltitude:      boolean
  scrapsIntensity:     boolean
  scrapsClassification: boolean
  smoothScraps:        boolean
  accurateScraps:      boolean
  showRenderCave:      boolean
  caveTexture:         'limestone' | 'dolomite' | 'grey_limestone'
  renderOpacity:       number
  organicLevel:        number
  organicVoxelSize:     number   // Debug / Tuning: veľkosť voxlu
  organicDilation:      number   // Debug / Tuning: sila dilatácie (bulge)
  // Cave traverse
  showTraverse:        boolean
  traverseRadius:      number
  traverseAltitude:    boolean
  // Terrain surface
  showSurfaceMesh:     boolean
  showSurfaceMeshWire: boolean
  showSurfaceTexture:  boolean
  surfaceTextureSource: 'custom' | 'wms-orto' | 'wms-orto-freemap' | 'wms-geology' | 'wms-shadow' | 'none'
  surfaceTextureUrl?:  string | null
  showSurfaceNetwork:  boolean
  showContours:        boolean
  showContourLabels:  boolean
  contourColor:        string
  contourColor10:      string
  surfaceOpacity:      number
  surfaceColor:        string
  // LiDAR Layers
  showVegetation:      boolean
  showGround:          boolean
  showCaveLiDAR:       boolean
  surfaceTextureOpacity: number
  surfaceWmsResolution: number
  surfaceTextureOffset: { x: number, y: number }
  surfaceTextureScale:  { x: number, y: number }
  surfaceOffset:        { x: number, y: number, z: number }
  surfaceTextureCalibration?: {
    p1: { x: number, y: number, lat: number, lon: number },
    p2: { x: number, y: number, lat: number, lon: number }
  } | null
  placedCaver:         { pos: [number, number, number], pose: 'standing' | 'crawling' } | null
  // Colors
  colorBackground:   string
  colorBackground2?:  string
  colorSplay:          string
  colorTraverse:       string
  colorScraps:         string
  colorScrapsWire:     string
  colorStations:       string
  colorStationNames:   string
  colorStationAlt:     string
  colorTerrainWire:    string
  // Clipping
  showClipping:        boolean
  clippingHeight:      number
  showProfileClipping: boolean
  profileClipFlip:     boolean
  profileClipOffset:   number
  showClippingEdges:   boolean
  showSurfaceClippingEdges: boolean
  colorClippingEdges:  string
  colorSurfaceClippingEdges: string
  useSurfaceNet:       boolean
  clippingPlanes?:     any[]
  showGizmo:           boolean

  // Floor Map
  floorMapSvg:         string | null
  floorMapTh2:         any | null  // Parsed Th2Scrap[]
  floorMapOpacity:     number
  manualMatches:       { src: { x: number; y: number }; dst: { x: number; y: number } }[] | null
  
  // Cinematic
  autoRotate:          boolean
  autoRotateSpeed:     number
  cinematicMode:       boolean
  recordingDuration:   number
  excludeModelFromClipping: boolean
  caveCalibrationOffset: { x: number, y: number, z: number }
}

// ─── Modern Gizmo (Full circles, thin lines) ───
// ─── Modern Gizmo (Full circles, thin lines) ───
const ModernGizmo = ({ visible, modelScale }: { visible: boolean, modelScale: number }) => {
  if (!visible) return null;
  
  // Hrúbka čiar musí byť konzistentná vizuálne.
  // Použijeme vzorec, ktorý zabezpečí, že na veľkých modeloch nebudú čiary obrovské,
  // ale na malých ostanú dostatočne hrubé.
  const tubeWidth = 0.001 + 0.015 / Math.max(1, modelScale); 

  return (
    <group scale={modelScale} renderOrder={999}>
      {/* X Axis & Ring (Red) */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1, tubeWidth, 16, 100]} />
        <meshBasicMaterial color="#ff4d4d" transparent opacity={0.7} depthTest={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[tubeWidth, tubeWidth, 2.4, 8]} />
        <meshBasicMaterial color="#ff4d4d" transparent opacity={0.4} depthTest={false} />
      </mesh>

      {/* Y Axis & Ring (Green) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, tubeWidth, 16, 100]} />
        <meshBasicMaterial color="#4dff88" transparent opacity={0.7} depthTest={false} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[tubeWidth, tubeWidth, 2.4, 8]} />
        <meshBasicMaterial color="#4dff88" transparent opacity={0.4} depthTest={false} />
      </mesh>

      {/* Z Axis & Ring (Blue) */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[1, tubeWidth, 16, 100]} />
        <meshBasicMaterial color="#4d88ff" transparent opacity={0.7} depthTest={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[tubeWidth, tubeWidth, 2.4, 8]} />
        <meshBasicMaterial color="#4d88ff" transparent opacity={0.4} depthTest={false} />
      </mesh>

      {/* Outer White Ring */}
      <mesh>
        <torusGeometry args={[1.2, tubeWidth * 0.5, 16, 100]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} depthTest={false} />
      </mesh>
    </group>
  );
};

// ─── Clickable stations (neviditelné gule, raycasting) & Hover Highlight ───
function ClickableStations({ cave, onStationClick, isMeasuringMode }: {
  cave: ParsedCave
  onStationClick: (idx: number, screenX: number, screenY: number, ctrlKey: boolean) => void
  isMeasuringMode: boolean
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1.2, 8, 6), [])
  const mat       = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])

  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(sphereGeo, mat, cave.stations.length)
    const dummy = new THREE.Object3D()
    cave.stations.forEach((s, i) => {
      dummy.position.set(s.x, s.z, -s.y)
      
      const lbl = cave.stationLabels?.[i]
      const isPolygon = lbl && lbl.name !== ''
      const radiusScale = isPolygon ? 1.0 : 0.2
      dummy.scale.set(radiusScale, radiusScale, radiusScale)

      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
    })
    im.instanceMatrix.needsUpdate = true
    return im
  }, [cave, sphereGeo, mat])

  useEffect(() => {
    document.body.style.cursor = hoveredIdx !== null ? 'crosshair' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hoveredIdx])

  const hoveredObj = useMemo(() => {
    if (hoveredIdx === null) return null
    const s = cave.stations[hoveredIdx]
    return s ? [s.x, s.z, -s.y] as [number, number, number] : null
  }, [hoveredIdx, cave])

  return (
    <group>
      <primitive
        object={mesh}
        onPointerOver={(e: any) => {
          if (e.instanceId !== undefined) {
            const lbl = cave.stationLabels?.[e.instanceId]
            const isPolygon = lbl && lbl.name !== ''
            // Ak nie sme v móde merania, ignorujeme všetko okrem polygonových bodov
            if (!isMeasuringMode && !isPolygon) return
            
            e.stopPropagation()
            setHoveredIdx(e.instanceId)
          }
        }}
        onPointerOut={() => setHoveredIdx(null)}
        onClick={(e: any) => {
          if (e.instanceId !== undefined) {
            const lbl = cave.stationLabels?.[e.instanceId]
            const isPolygon = lbl && lbl.name !== ''
            const ctrl = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey
            
            // Ak nie sme v móde merania a nie je CTRL, ignorujeme všetko okrem polygonových bodov
            if (!isMeasuringMode && !ctrl && !isPolygon) return

            e.stopPropagation()
            onStationClick(e.instanceId, e.nativeEvent.clientX, e.nativeEvent.clientY, ctrl)
          }
        }}
      />
      {/* ── Highlight Sphere ── */}
      {hoveredObj && (
        <mesh position={hoveredObj} renderOrder={110}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
}

// ─── Elevation colormap ───────────────────────────────────────────────────────
// Hladký prechod: tmavá modrá → azúrová → zelená → žltá → oranžová → červená
const ELEV_STOPS: [number, [number, number, number]][] = [
  [0.00, [0.08, 0.18, 0.65]],
  [0.18, [0.10, 0.48, 0.85]],
  [0.35, [0.12, 0.78, 0.72]],
  [0.50, [0.18, 0.87, 0.38]],
  [0.65, [0.80, 0.94, 0.10]],
  [0.80, [0.97, 0.60, 0.05]],
  [1.00, [0.88, 0.10, 0.10]],
]

function elevColor(t: number): THREE.Color {
  const clampedT = Math.max(0, Math.min(1, t))
  for (let i = 0; i < ELEV_STOPS.length - 1; i++) {
    const [t0, c0] = ELEV_STOPS[i]
    const [t1, c1] = ELEV_STOPS[i + 1]
    if (clampedT >= t0 && clampedT <= t1) {
      const f = (clampedT - t0) / (t1 - t0)
      return new THREE.Color(
        c0[0] + f * (c1[0] - c0[0]),
        c0[1] + f * (c1[1] - c0[1]),
        c0[2] + f * (c1[2] - c0[2]),
      )
    }
  }
  return new THREE.Color(0.88, 0.10, 0.10)
}

function normZ(z: number, minZ: number, maxZ: number): number {
  return maxZ === minZ ? 0.5 : Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ)))
}

// ─── Dynamic Grid ─────────────────────────────────────────────────────────────
function DynamicGrid({ options, cameraData }: { options: ViewerOptions, cameraData: { dist: number, fov: number, height: number } | null }) {
  if (!options.showGrid) return null

  // Výpočet "peknej" veľkosti mriežky podobne ako ScaleBar
  const targetPx = 80 // chceme mriežku zhruba 80px veľkú
  const dist = cameraData?.dist || 100
  const height = cameraData?.height || 600
  const fov = cameraData?.fov || 45
  
  const vFov = (fov * Math.PI) / 180
  const visibleHeight = 2 * Math.tan(vFov / 2) * dist
  const pixelsPerUnit = height / visibleHeight
  
  const targetUnits = targetPx / pixelsPerUnit
  const niceUnits = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
  let best = niceUnits[0]
  for (const u of niceUnits) if (Math.abs(u - targetUnits) < Math.abs(best - targetUnits)) best = u

  return (
    <Grid 
      infiniteGrid 
      fadeDistance={best * 25} 
      fadeStrength={5} 
      sectionSize={best * 10} 
      sectionColor={options.colorGrid} 
      sectionThickness={1.2}
      cellSize={best} 
      cellColor={options.colorGrid} 
      cellThickness={0.5}
      position={[0, -0.05, 0]} 
    />
  )
}

// ─── Bounding Box ─────────────────────────────────────────────────────────────
function BoundingBox({ cave, show, options: o }: { cave: ParsedCave, show: boolean, options: ViewerOptions }) {
  if (!show) return null

  // Výpočet kombinovaných hraníc
  const box = useMemo(() => {
    const b = new THREE.Box3()
    // Základ: jaskynné merania
    b.min.set(cave.bounds.min.x, cave.bounds.min.z, -cave.bounds.max.y)
    b.max.set(cave.bounds.max.x, cave.bounds.max.z, -cave.bounds.min.y)

    const surfaceVisible = o.showSurfaceMesh || o.showSurfaceMeshWire || o.showSurfaceTexture || o.showSurfaceNetwork
    if (surfaceVisible && cave.surfaces) {
      cave.surfaces.forEach(s => {
        const { dtm, centerOffset: cx } = s
        const { calib, data } = dtm
        
        // Rozsah v rovine XZ (Three.js coords)
        const corners = [
          { c: 0, r: 0 },
          { c: dtm.samples - 1, r: 0 },
          { c: 0, r: dtm.lines - 1 },
          { c: dtm.samples - 1, r: dtm.lines - 1 }
        ]
        corners.forEach(p => {
          const wx = calib.xOrigin + p.c * calib.xx + p.r * calib.xy - (cx?.x || 0)
          const wy = calib.yOrigin + p.c * calib.yx + p.r * calib.yy - (cx?.y || 0)
          // Pridáme len rovinné súradnice (Y v Three.js je výška, tú nastavíme nižšie)
          b.expandByPoint(new THREE.Vector3(wx, b.min.y, -wy))
          b.expandByPoint(new THREE.Vector3(wx, b.max.y, -wy))
        })
        
        // Reálny výškový rozsah terénu
        let sMinZ = Infinity, sMaxZ = -Infinity
        for (let i = 0; i < data.length; i++) {
          if (data[i] < sMinZ) sMinZ = data[i]
          if (data[i] > sMaxZ) sMaxZ = data[i]
        }
        b.min.y = Math.min(b.min.y, sMinZ - (cx?.z || 0))
        b.max.y = Math.max(b.max.y, sMaxZ - (cx?.z || 0))
      })
    }

    // Pridáme 10% rezervu na výšku (Y os)
    const h = b.max.y - b.min.y
    const padding = h * 0.05 // 5% hore, 5% dole
    b.min.y -= padding
    b.max.y += padding

    return b
  }, [cave, o.showSurfaceMesh, o.showSurfaceMeshWire, o.showSurfaceTexture, o.showSurfaceNetwork])

  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)

  return (
    <mesh position={center}>
      <boxGeometry args={[size.x, size.y, size.z]} onUpdate={(g) => {
        // @ts-ignore
        g._needsCleanup = true
      }} />
      <meshBasicMaterial color={o.colorBoundingBox || "#990000"} wireframe transparent opacity={0.4} />
    </mesh>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function segsToGeo(segs: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[]) {
  const p = new Float32Array(segs.length * 6)
  let i = 0
  for (const s of segs) {
    p[i++] = s.from.x; p[i++] = s.from.z; p[i++] = -s.from.y;
    p[i++] = s.to.x;   p[i++] = s.to.z;   p[i++] = -s.to.y;
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  return g
}

function segsToGeoWithColors(segs: Segment[], mnZ: number, mxZ: number) {
  const p = new Float32Array(segs.length * 6)
  const colors = new Float32Array(segs.length * 6)
  let i = 0
  for (const s of segs) {
    p[i] = s.from.x; p[i+1] = s.from.z; p[i+2] = -s.from.y;
    p[i+3] = s.to.x; p[i+4] = s.to.z;   p[i+5] = -s.to.y;
    
    const c1 = elevColor(normZ(s.from.z, mnZ, mxZ))
    const c2 = elevColor(normZ(s.to.z,   mnZ, mxZ))
    
    colors[i] = c1.r; colors[i+1] = c1.g; colors[i+2] = c1.b;
    colors[i+3] = c2.r; colors[i+4] = c2.g; colors[i+5] = c2.b;
    i += 6
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

// ─── Cave survey legs ─────────────────────────────────────────────────────────
const CYL_UP = new THREE.Vector3(0, 1, 0)

function CaveLegs({ cave, showSplay, showAltitude, options: o, ...props }: { cave: ParsedCave; showSplay: boolean; showAltitude: boolean, options: ViewerOptions, clippingPlanes: any[] }) {
  const caveSegs    = useMemo(() => cave.segments.filter(s => s.type === 'cave'),    [cave])
  const splaySegs   = useMemo(() => cave.segments.filter(s => s.type === 'splay'),   [cave])
  const surfaceSegs = useMemo(() => cave.segments.filter(s => s.type === 'surface'), [cave])
  
  const zRange = useMemo(() => {
    let mn = Infinity, mx = -Infinity
    for (const s of caveSegs) {
      if (s.from.z < mn) mn = s.from.z; if (s.from.z > mx) mx = s.from.z
      if (s.to.z   < mn) mn = s.to.z;   if (s.to.z   > mx) mx = s.to.z
    }
    return [mn, mx] as [number, number]
  }, [caveSegs])

  const caveGeo = useMemo(() => {
    if (showAltitude) {
      return segsToGeoWithColors(caveSegs, zRange[0], zRange[1])
    }
    return segsToGeo(caveSegs)
  }, [caveSegs, showAltitude, zRange])

  const splayGeo    = useMemo(() => segsToGeo(splaySegs),   [splaySegs])
  const surfaceGeo  = useMemo(() => segsToGeo(surfaceSegs), [surfaceSegs])

  useEffect(() => {
    return () => {
      caveGeo.dispose()
      splayGeo.dispose()
      surfaceGeo.dispose()
    }
  }, [caveGeo, splayGeo, surfaceGeo])

  return (
    <group renderOrder={10}>
      <lineSegments geometry={caveGeo}>
        <lineBasicMaterial 
          color={o.colorTraverse} linewidth={2} vertexColors={showAltitude} 
          transparent={false} depthTest={true} 
          clippingPlanes={props.clippingPlanes}
        />
      </lineSegments>
      {showSplay && splaySegs.length > 0 && (
        <lineSegments geometry={splayGeo}>
          <lineBasicMaterial color={o.colorSplay} transparent opacity={0.45} depthTest={true} />
        </lineSegments>
      )}
      {surfaceSegs.length > 0 && (
        <lineSegments geometry={surfaceGeo}>
          <lineBasicMaterial color="#a0aec0" transparent opacity={0.6} depthTest={true} />
        </lineSegments>
      )}
    </group>
  )
}

// ─── Cave traverse — polygonový ťah (InstancedMesh rúrky s altitude farbami) ──
const CaveTraverse = React.memo(({ cave, radius, showAltitude, isMoving, ...props }: { cave: ParsedCave; radius: number; showAltitude: boolean, isMoving: boolean, clippingPlanes: any[] }) => {
  if (isMoving) return null 
  const caveLegs = useMemo(() => cave.segments.filter(s => s.type === 'cave'), [cave])

  const zRange = useMemo(() => {
    let mn = Infinity, mx = -Infinity
    for (const s of caveLegs) {
      if (s.from.z < mn) mn = s.from.z; if (s.from.z > mx) mx = s.from.z
      if (s.to.z   < mn) mn = s.to.z;   if (s.to.z   > mx) mx = s.to.z
    }
    return [mn, mx] as [number, number]
  }, [caveLegs])

  const cylGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), [])
  const [mesh, setMesh] = useState<THREE.InstancedMesh | null>(null)

  useEffect(() => {
    const count = caveLegs.length
    if (count === 0) return

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15 })
    const im  = new THREE.InstancedMesh(cylGeo, mat, count)
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)

    const dummy = new THREE.Object3D()
    const [mnZ, mxZ] = zRange

    caveLegs.forEach((seg, i) => {
      const from = new THREE.Vector3(seg.from.x, seg.from.z, -seg.from.y)
      const to   = new THREE.Vector3(seg.to.x,   seg.to.z,  -seg.to.y)
      const len  = from.distanceTo(to)
      if (len < 0.001) return

      const dir = to.clone().sub(from).normalize()
      dummy.position.copy(from.clone().add(to).multiplyScalar(0.5))

      const dot = dir.dot(CYL_UP)
      if (Math.abs(dot) > 0.9999) {
        dummy.quaternion.set(0, 0, 0, 1)
        if (dot < 0) dummy.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
      } else {
        dummy.quaternion.setFromUnitVectors(CYL_UP, dir)
      }

      dummy.scale.set(radius, len, radius)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)

      if (showAltitude) {
        const midZ = (seg.from.z + seg.to.z) / 2
        im.setColorAt(i, elevColor(normZ(midZ, mnZ, mxZ)))
      } else {
        im.setColorAt(i, new THREE.Color('#4fc3f7'))
      }
    })

    mat.clippingPlanes = props.clippingPlanes
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    
    setMesh(im)

    return () => {
      im.dispose()
      mat.dispose()
    }
  }, [caveLegs, zRange, cylGeo, radius, showAltitude, props.clippingPlanes])

  useEffect(() => {
    return () => cylGeo.dispose()
  }, [cylGeo])

  if (!mesh) return null
  return <primitive object={mesh} renderOrder={10} />
})

// ─── Station dots ─────────────────────────────────────────────────────────────
function Stations({ cave, options: o }: { cave: ParsedCave, options: ViewerOptions }) {
  const geos = useMemo(() => {
    let numPoly = 0, numSplay = 0
    for (let i = 0; i < cave.stations.length; i++) {
      const lbl = cave.stationLabels?.[i]
      if (lbl && lbl.name !== '') numPoly++
      else numSplay++
    }

    const pP = new Float32Array(numPoly * 3)
    const pS = new Float32Array(numSplay * 3)
    let idxP = 0, idxS = 0

    for (let i = 0; i < cave.stations.length; i++) {
      const s = cave.stations[i]
      const lbl = cave.stationLabels?.[i]
      if (lbl && lbl.name !== '') {
        pP[idxP++] = s.x; pP[idxP++] = s.z; pP[idxP++] = -s.y;
      } else {
        pS[idxS++] = s.x; pS[idxS++] = s.z; pS[idxS++] = -s.y;
      }
    }
    const gP = new THREE.BufferGeometry()
    gP.setAttribute('position', new THREE.BufferAttribute(pP, 3))
    const gS = new THREE.BufferGeometry()
    gS.setAttribute('position', new THREE.BufferAttribute(pS, 3))
    return { polyGeo: gP, splayGeo: gS }
  }, [cave])

  useEffect(() => {
    return () => {
      geos.polyGeo.dispose()
      geos.splayGeo.dispose()
    }
  }, [geos])

  return (
    <group renderOrder={12}>
      {/* Splay body */}
      <points geometry={geos.splayGeo}>
        <pointsMaterial color={o.colorStations} size={2} sizeAttenuation={false} depthTest={true} />
      </points>
      {/* Polygonové body */}
      <points geometry={geos.polyGeo}>
        <pointsMaterial color={o.colorStations} size={5} sizeAttenuation={false} depthTest={true} />
      </points>
    </group>
  )
}

// ─── Station labels ───────────────────────────────────────────────────────────
function StationLabels({ cave, showNames, showAltitudes, options: o }: { cave: ParsedCave; showNames: boolean; showAltitudes: boolean, options: ViewerOptions }) {
  if (!cave.stationLabels?.length) return null
  const labels = cave.stationLabels.length > 500
    ? cave.stationLabels.filter((_, i) => i % Math.ceil(cave.stationLabels.length / 400) === 0)
    : cave.stationLabels
  return (
    <>
      {labels.map((sl, i) => (
        <Html key={i} position={[sl.pos.x, sl.pos.z + 0.8, -sl.pos.y]}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }} occlude={false}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
            {showNames && sl.name !== '' && (
              <span style={{ fontSize: '9px', fontFamily: 'Inter, monospace', color: o.colorStationNames, fontWeight: 600, textShadow: '0 0 3px #000,0 0 6px #000', lineHeight: 1.2 }}>
                {sl.name}
              </span>
            )}
            {showAltitudes && sl.name !== '' && (
              <span style={{ fontSize: '8px', fontFamily: 'Inter, monospace', color: o.colorStationAlt, textShadow: '0 0 3px #000,0 0 5px #000', lineHeight: 1.2 }}>
                {sl.altitude.toFixed(1)} m
              </span>
            )}
          </div>
        </Html>
      ))}
    </>
  )
}

// ─── Contour Label Item (with dynamic scaling) ──────────────────────────────
const ContourLabelItem = ({ pos, val, color, opacity }: any) => {
  const ref = useRef<HTMLDivElement>(null)
  const vec = useMemo(() => new THREE.Vector3(pos[0], pos[1], pos[2]), [pos])

  useFrame(({ camera }) => {
    if (ref.current) {
      const dist = camera.position.distanceTo(vec)
      // Slightly larger when far away (min 0.7x), base distance 90m
      const scale = Math.max(0.7, Math.min(1.8, 90 / dist))
      ref.current.style.transform = `scale(${scale})`
    }
  })

  return (
    <Html position={pos} center occlude={false} style={{ pointerEvents: 'none' }}>
      <div ref={ref} style={{
        fontSize: '10px',
        fontFamily: 'Inter, monospace',
        color: color || '#ffffff',
        fontWeight: 800,
        textShadow: '0 0 3px #000, 0 0 5px #000',
        opacity: opacity || 0.9,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        padding: '1px 3px',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.2)',
        backdropFilter: 'blur(2px)',
        transformOrigin: 'center center',
        transition: 'transform 0.1s ease-out'
      }}>
        {val}
      </div>
    </Html>
  )
}

// ─── Contour Labels (Altitude markers for major contours) ────────────────────
const ContourLabels = React.memo(({ surface, majorInterval, color, opacity }: any) => {
  const { dtm, centerOffset } = surface;
  const { data, samples, lines, calib } = dtm;

  const labelPoints = useMemo(() => {
    const pts: { x: number; y: number; z: number; val: number }[] = [];
    if (!majorInterval || majorInterval <= 0) return pts;

    // Grid-based crossing edge detection for precision
    const stepR = Math.max(4, Math.floor(lines / 16));
    const stepC = Math.max(4, Math.floor(samples / 16));

    for (let r = 0; r < lines - stepR; r += stepR) {
      for (let c = 0; c < samples - stepC; c += stepC) {
        const idx = r * samples + c;
        const z = data[idx];
        const targetAlt = Math.round(z / majorInterval) * majorInterval;
        
        // Check horizontal edge crossing
        const idxRight = r * samples + (c + stepC);
        const zRight = data[idxRight];
        
        if ((z <= targetAlt && zRight >= targetAlt) || (z >= targetAlt && zRight <= targetAlt)) {
          if (Math.abs(zRight - z) > 0.001) {
            const t = (targetAlt - z) / (zRight - z);
            const col = c + t * stepC;
            const wx = calib.xOrigin + col * calib.xx + r * calib.xy;
            const wy = calib.yOrigin + col * calib.yx + r * calib.yy;
            
            pts.push({ 
              x: wx - centerOffset.x, 
              y: targetAlt - centerOffset.z, 
              z: -(wy - centerOffset.y), 
              val: targetAlt 
            });
          }
        }
      }
    }

    // Group by altitude and ensure at least 3 labels per level for visibility
    const grouped = new Map<number, typeof pts>();
    pts.forEach(p => {
      if (!grouped.has(p.val)) grouped.set(p.val, []);
      grouped.get(p.val)!.push(p);
    });

    const finalPts: typeof pts = [];
    grouped.forEach((levelPts) => {
      const count = Math.min(levelPts.length, 3);
      // Pick points spread out by X coordinate
      const sorted = levelPts.sort((a, b) => a.x - b.x);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(i * sorted.length / count);
        if (sorted[idx]) finalPts.push(sorted[idx]);
      }
    });

    return finalPts;
  }, [data, samples, lines, calib, majorInterval, centerOffset]);

  if (labelPoints.length === 0) return null;

  return (
    <group>
      {labelPoints.map((p, i) => (
        <ContourLabelItem 
          key={i} 
          pos={[p.x, p.y + 0.3, p.z]} 
          val={p.val} 
          color={color} 
          opacity={opacity} 
        />
      ))}
    </group>
  );
});

// --- Pokročilé Vyhladzovacie Algoritmy (Taubin Smoothing & Angle-Weighted Normals) ---

function applyTaubinSmoothing(geometry: THREE.BufferGeometry, iterations = 5): THREE.BufferGeometry {
  if (!geometry.index) return geometry;
  const pos = geometry.attributes.position;
  const posArr = pos.array as Float32Array;
  const idx = geometry.index.array;
  const vCount = pos.count;
  const adj = new Array(vCount);
  for (let i = 0; i < vCount; i++) adj[i] = new Set<number>();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i+1], c = idx[i+2];
    adj[a].add(b); adj[a].add(c);
    adj[b].add(a); adj[b].add(c);
    adj[c].add(a); adj[c].add(b);
  }
  const lambda = 0.5, mu = -0.53;
  const tempArr = new Float32Array(posArr.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < vCount; i++) {
      const neighbors = adj[i];
      if (neighbors.size <= 3) {
        tempArr[i*3]=posArr[i*3]; tempArr[i*3+1]=posArr[i*3+1]; tempArr[i*3+2]=posArr[i*3+2];
        continue;
      }
      let sx=0, sy=0, sz=0;
      for (const n of neighbors) { sx += posArr[n*3]; sy += posArr[n*3+1]; sz += posArr[n*3+2]; }
      const invSize = 1.0 / neighbors.size;
      tempArr[i*3]   = posArr[i*3]   + lambda * (sx * invSize - posArr[i*3]);
      tempArr[i*3+1] = posArr[i*3+1] + lambda * (sy * invSize - posArr[i*3+1]);
      tempArr[i*3+2] = posArr[i*3+2] + lambda * (sz * invSize - posArr[i*3+2]);
    }
    posArr.set(tempArr);
    for (let i = 0; i < vCount; i++) {
      const neighbors = adj[i];
      if (neighbors.size <= 3) {
        tempArr[i*3]=posArr[i*3]; tempArr[i*3+1]=posArr[i*3+1]; tempArr[i*3+2]=posArr[i*3+2];
        continue;
      }
      let sx=0, sy=0, sz=0;
      for (const n of neighbors) { sx += posArr[n*3]; sy += posArr[n*3+1]; sz += posArr[n*3+2]; }
      const invSize = 1.0 / neighbors.size;
      tempArr[i*3]   = posArr[i*3]   + mu * (sx * invSize - posArr[i*3]);
      tempArr[i*3+1] = posArr[i*3+1] + mu * (sy * invSize - posArr[i*3+1]);
      tempArr[i*3+2] = posArr[i*3+2] + mu * (sz * invSize - posArr[i*3+2]);
    }
    posArr.set(tempArr);
  }
  pos.needsUpdate = true;
  return geometry;
}

function computeAngleWeightedNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.index) { geometry.computeVertexNormals(); return geometry; }
  const posArr = geometry.attributes.position.array as Float32Array;
  const idx = geometry.index.array;
  const vCount = geometry.attributes.position.count;
  const normals = new Float32Array(vCount * 3);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), bc = new THREE.Vector3(), cb = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i], ib = idx[i+1], ic = idx[i+2];
    vA.fromArray(posArr, ia * 3); vB.fromArray(posArr, ib * 3); vC.fromArray(posArr, ic * 3);
    ab.subVectors(vB, vA); ac.subVectors(vC, vA); bc.subVectors(vC, vB);
    cb.crossVectors(ab, ac); cb.normalize();
    const aLSq = bc.lengthSq(), bLSq = ac.lengthSq(), cLSq = ab.lengthSq();
    const aLen = Math.sqrt(aLSq), bLen = Math.sqrt(bLSq), cLen = Math.sqrt(cLSq);
    let angleA = 0, angleB = 0, angleC = 0;
    if (bLen > 0 && cLen > 0) angleA = Math.acos(Math.max(-1, Math.min(1, (bLSq + cLSq - aLSq) / (2 * bLen * cLen))));
    if (aLen > 0 && cLen > 0) angleB = Math.acos(Math.max(-1, Math.min(1, (aLSq + cLSq - bLSq) / (2 * aLen * cLen))));
    if (aLen > 0 && bLen > 0) angleC = Math.PI - angleA - angleB;
    normals[ia*3] += cb.x * angleA; normals[ia*3+1] += cb.y * angleA; normals[ia*3+2] += cb.z * angleA;
    normals[ib*3] += cb.x * angleB; normals[ib*3+1] += cb.y * angleB; normals[ib*3+2] += cb.z * angleB;
    normals[ic*3] += cb.x * angleC; normals[ic*3+1] += cb.y * angleC; normals[ic*3+2] += cb.z * angleC;
  }
  for (let i = 0; i < vCount; i++) {
    const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len > 0) { normals[i*3] /= len; normals[i*3+1] /= len; normals[i*3+2] /= len; }
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

// ─── Cave scraps geometry builder ────────────────────────────────────────────
function buildScrapsGeo(cave: ParsedCave, withColors: boolean, smooth: boolean, organicLevel: number): THREE.BufferGeometry | null {
  if (!cave.scraps?.length) return null

  let minZ = Infinity, maxZ = -Infinity
  let numVertices = 0
  let numFaces = 0

  for (const sc of cave.scraps) {
    numVertices += sc.vertices.length
    numFaces += sc.faces.length
    if (withColors) {
      for (const v of sc.vertices) {
        if (v.z < minZ) minZ = v.z
        if (v.z > maxZ) maxZ = v.z
      }
    }
  }

  if (numVertices === 0 || numFaces === 0) return null
  const positions = new Float32Array(numVertices * 3)
  const uvs = new Float32Array(numVertices * 2)
  const colors = withColors ? new Float32Array(numVertices * 3) : null
  const indices = new Uint32Array(numFaces * 3)

  const isHuge = numVertices > 1000000
  if (isHuge) console.warn('Model is huge, disabling advanced smoothing to prevent crash');

  let base = 0
  let vIdx = 0
  let uvIdx = 0
  let cIdx = 0
  let iIdx = 0

  for (const sc of cave.scraps) {
    for (const v of sc.vertices) {
      positions[vIdx++] = v.x
      positions[vIdx++] = v.z
      positions[vIdx++] = -v.y

      uvs[uvIdx++] = v.x * 0.2
      uvs[uvIdx++] = (v.z + v.y) * 0.2

      if (withColors && colors) {
        const c = elevColor(normZ(v.z, minZ, maxZ))
        colors[cIdx++] = c.r
        colors[cIdx++] = c.g
        colors[cIdx++] = c.b
      }
    }

    for (const [a, b, c] of sc.faces) {
      if (a < sc.vertices.length && b < sc.vertices.length && c < sc.vertices.length) {
        indices[iIdx++] = base + a
        indices[iIdx++] = base + b
        indices[iIdx++] = base + c
      }
    }
    base += sc.vertices.length
  }

  // Ak by boli nejaké neplatné faxy (orezané), upravíme reálnu dĺžku indexov
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2))
  if (withColors && colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  
  // Use subarray to trim unused indices if some faces were invalid
  if (iIdx < indices.length) {
    g.setIndex(new THREE.BufferAttribute(indices.subarray(0, iIdx), 1))
  } else {
    g.setIndex(new THREE.BufferAttribute(indices, 1))
  }
  
  if (smooth && !isHuge) {
    // 1. Zvariť vrcholy aby sa plochy "dotkli" a zdieľali normály (a vyhladenie prešlo celou sieťou)
    g = mergeVertices(g, 1e-3)
    // 2. Taubin Smoothing pre odstránenie ostrých zubcov a zlých hrán (šetrnejší k objemu, pinned borders)
    g = applyTaubinSmoothing(g, Math.max(1, Math.min(20, Math.round(organicLevel))))
    // 3. Poctivé výpočty tieňov so zavážením uhlov pre top vizuál
    g = computeAngleWeightedNormals(g)
  } else {
    // Klastický neprerušovaný flatshading s computeVertexNormals default
    g.computeVertexNormals()
  }
  
  // Vypočítať BVH strom pre bleskový raycasting
  if (!isHuge) {
    // @ts-ignore
    g.computeBoundsTree()
  }
  
  return g
}

// ─── Cave wall scraps — solid + wireframe + altitude (independent) ─────────────
const CaveScraps = React.memo(({ cave, opacity, showSolid, showWire, showAltitude, smooth, showRender, caveTexture, renderOpacity, isMoving, options, ...props }: {
  cave: ParsedCave; opacity: number
  showSolid: boolean; showWire: boolean; showAltitude: boolean; smooth: boolean; showRender: boolean
  caveTexture: 'limestone' | 'dolomite' | 'grey_limestone'
  renderOpacity: number
  isMoving: boolean
  options: ViewerOptions
  clippingPlanes?: any[]
  onProcessingStart?: (i: string) => void
  onProcessingEnd?: () => void
}) => {
  const { onProcessingStart, onProcessingEnd } = props as any;
  const [geos, setGeos] = useState<{ solid: THREE.BufferGeometry | null, alt: THREE.BufferGeometry | null }>({ solid: null, alt: null })
  const [floorTex, setFloorTex] = useState<THREE.Texture | null>(null)
  const [floorAffine, setFloorAffine] = useState<{a:number,b:number,c:number,d:number,e:number,f:number} | null>(null)

  useEffect(() => {
    if (geos.solid) {
      // @ts-ignore
      geos.solid.computeBoundsTree();
    }
    if (geos.alt) {
      // @ts-ignore
      geos.alt.computeBoundsTree();
    }
  }, [geos]);

  useEffect(() => {
    if (!options.floorMapSvg && !options.floorMapTh2) { setFloorTex(null); return }
    
    if (options.floorMapSvg) {
      const isDataUrl = options.floorMapSvg.startsWith('data:image')
      let processedSvg = options.floorMapSvg
      
      if (!isDataUrl) {
        processedSvg = processedSvg.replace(/fill=["']#?ffffff["']/gi, 'fill="none" fill-opacity="0"')
        processedSvg = processedSvg.replace(/fill=["']white["']/gi, 'fill="none" fill-opacity="0"')
        processedSvg = processedSvg.replace(/fill=["']#?f2f4ea["']/gi, 'fill="none" fill-opacity="0"')
        processedSvg = processedSvg.replace(/fill=["']#?f9f9f7["']/gi, 'fill="none" fill-opacity="0"')
        processedSvg = processedSvg.replace(/stroke=["']#?ffffff["']/gi, 'stroke="none" stroke-opacity="0"')
        const styleInjection = `<style>svg { background: transparent !important; } rect[fill="#f2f4ea"], path[fill="#f2f4ea"], rect[fill="#f9f9f7"] { display: none !important; } [fill="white"], [fill="#ffffff"] { fill: none !important; fill-opacity: 0 !important; }</style>`
        processedSvg = processedSvg.replace(/(<svg[^>]*>)/i, `$1${styleInjection}`)
      }

      const img = new Image()
      const url = isDataUrl ? options.floorMapSvg : URL.createObjectURL(new Blob([processedSvg], { type: 'image/svg+xml;charset=utf-8' }))
      img.onload = () => {
        const tex = new THREE.Texture(img); tex.needsUpdate = true; setFloorTex(tex)
        if (!isDataUrl) URL.revokeObjectURL(url)
      }
      img.src = url

      if (options.manualMatches && options.manualMatches.length >= 2) {
        setFloorAffine(solveAffine(options.manualMatches))
      } else {
        const svgStations = parseSVGStations(options.floorMapSvg)
        const matches: any[] = []
        svgStations.forEach(ss => {
          const caveS = cave.stationLabels.find(l => l.name === ss.name)
          if (caveS) matches.push({ src: { x: caveS.pos.x, y: -caveS.pos.z }, dst: { x: ss.x, y: ss.y } })
        })
        if (matches.length >= 2) setFloorAffine(solveAffine(matches))
      }
    } else if (options.floorMapTh2) {
      const scraps = options.floorMapTh2 as any[]
      const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 2048
      const ctx = canvas.getContext('2d')
      if (ctx) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        scraps.forEach(s => {
          s.lines.forEach((l: any) => l.points.forEach((p: any) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }))
          s.points.forEach((p: any) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) })
        })
        const w = maxX - minX, h = maxY - minY, pad = 20
        const scale = Math.min((canvas.width-pad*2)/w, (canvas.height-pad*2)/h)
        const ox = (canvas.width - w*scale)/2 - minX*scale, oy = (canvas.height - h*scale)/2 - minY*scale
        ctx.clearRect(0,0,2048,2048); ctx.strokeStyle = 'white'; ctx.lineWidth = 2
        scraps.forEach(s => s.lines.forEach((l: any) => { ctx.beginPath(); l.points.forEach((p: any, i: number) => { if (i===0) ctx.moveTo(p.x*scale+ox, p.y*scale+oy); else ctx.lineTo(p.x*scale+ox, p.y*scale+oy) }); ctx.stroke() }))
        const tex = new THREE.CanvasTexture(canvas); setFloorTex(tex)
        const matches: any[] = []
        scraps.forEach(s => s.points.forEach((p: any) => { const caveS = cave.stationLabels.find(l => l.name === p.name); if (caveS) matches.push({ src: { x: caveS.pos.x, y: -caveS.pos.z }, dst: { x: p.x, y: p.y } }) }))
        if (matches.length >= 2) setFloorAffine(solveAffine(matches))
      }
    }
  }, [options.floorMapSvg, options.floorMapTh2, options.manualMatches, cave])

  useEffect(() => {
    if (onProcessingStart) onProcessingStart('Generujem steny jaskyne...')
    
    let currentSolid: THREE.BufferGeometry | null = null
    let currentAlt: THREE.BufferGeometry | null = null

    const timer = setTimeout(() => {
      currentSolid = buildScrapsGeo(cave, false, smooth, options.organicLevel)
      currentAlt = buildScrapsGeo(cave, true, smooth, options.organicLevel)
      setGeos({ solid: currentSolid, alt: currentAlt })
      if (onProcessingEnd) onProcessingEnd()
    }, 50)

    return () => {
      clearTimeout(timer)
      if (currentSolid) currentSolid.dispose()
      if (currentAlt) currentAlt.dispose()
      // Dispose state ones too if they changed
      if (geos.solid) geos.solid.dispose()
      if (geos.alt) geos.alt.dispose()
    }
  }, [cave, smooth, options.organicLevel])

  const solidGeo = geos.solid
  const altGeo = geos.alt
 
  const [rockTex, setRockTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let path = '/assets/cave_limestone.png'
    if (caveTexture === 'dolomite') path = '/assets/cave_rock.png'
    if (caveTexture === 'grey_limestone') path = '/assets/cave_granite.png'
    
    const tex = new THREE.TextureLoader().load(path)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(10, 10)
    setRockTex(tex)
    
    return () => tex.dispose()
  }, [caveTexture])

  return (
    <>
      {/* ── Tieňovaný solid mesh ── */}
      {showSolid && !showRender && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={5}>
          <meshStandardMaterial color={options.colorScraps} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.7} metalness={0.1}
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}

      {/* ── Realistický Render Mode (Textúra) ── */}
      {showRender && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={4}>
          <meshStandardMaterial 
            map={rockTex} 
            color={caveTexture === 'grey_limestone' ? '#f3f4f6' : (caveTexture === 'dolomite' ? '#ffffff' : '#ffffff')} 
            side={THREE.DoubleSide} 
            transparent={renderOpacity < 1} opacity={renderOpacity}
            roughness={0.6} 
            metalness={0.0}
            polygonOffset polygonOffsetFactor={0.5} polygonOffsetUnits={0.5}
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}

      {/* ── Farebné podel výšky ── */}
      {showAltitude && altGeo && (
        <mesh geometry={altGeo} renderOrder={3}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.65} metalness={0.05}
            polygonOffset polygonOffsetFactor={0} polygonOffsetUnits={0} 
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}

      {/* ── Pôdorysná Mapa (Projektovaná) ── */}
      {floorTex && floorAffine && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={6}>
          <meshBasicMaterial 
            map={floorTex} 
            transparent 
            opacity={options.floorMapOpacity} 
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
            clippingPlanes={props.clippingPlanes}
            onBeforeCompile={(shader) => {
              // Injikovať výpočet UV z affine transformácie priamo do shaderu
              shader.uniforms.uAffine = { value: [
                floorAffine.a, floorAffine.b, floorAffine.c,
                floorAffine.d, floorAffine.e, floorAffine.f
              ] };
              shader.vertexShader = `
                uniform float uAffine[6];
                varying vec2 vFloorUv;
                ${shader.vertexShader}
              `.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 // x = caveX, -z = caveY
                 float vx = position.x + ${cave.centerOffset?.x || 0.0};
                 float vy = -position.z + ${cave.centerOffset?.y || 0.0};
                 float svgX = uAffine[0] * vx + uAffine[1] * vy + uAffine[2];
                 float svgY = uAffine[3] * vx + uAffine[4] * vy + uAffine[5];
                 // Normalizácia na 0..1 (predpokladáme 2048x2048 canvas pre TH2 alebo natural size pre SVG)
                 // Ale lepšie je použiť premenné z texture.image
                 vFloorUv = vec2(svgX, svgY);
                `
              );
              shader.fragmentShader = `
                varying vec2 vFloorUv;
                ${shader.fragmentShader}
              `.replace(
                '#include <map_fragment>',
                `
                #ifdef USE_MAP
                  // Získaj rozmery textúry pre normalizáciu UV
                  vec2 texSize = vec2(textureSize(map, 0));
                  vec2 normUv = vFloorUv / texSize;
                  if (normUv.x < 0.0 || normUv.x > 1.0 || normUv.y < 0.0 || normUv.y > 1.0) {
                    diffuseColor.a = 0.0;
                  } else {
                    diffuseColor *= texture2D(map, normUv);
                  }
                #endif
                `
              );
            }}
          />
        </mesh>
      )}

      {/* ── Drôtený model ── */}
      {(showWire || isMoving) && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={10}>
          <meshBasicMaterial color={options.colorScrapsWire} wireframe depthWrite={false} transparent={true}
            opacity={isMoving ? 0.3 : (showSolid || showAltitude ? 0.28 : 0.65)} 
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}

      <ClippingEdges 
        geo={showAltitude ? altGeo : solidGeo} 
        planes={props.clippingPlanes || []} 
        active={options.showClippingEdges} 
        color={options.colorClippingEdges} 
      />
    </>
  )
})

// ─── Terrain geometry builder ────────────────────────────────────────────────
function buildTerrainGeo({ positions, uvs, bitmapUvs, colors, indices }: { positions: Float32Array, uvs: Float32Array, bitmapUvs?: Float32Array, colors: Float32Array, indices: number[] }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  if (bitmapUvs) {
    g.setAttribute('uv2', new THREE.BufferAttribute(bitmapUvs, 2));
  }
  g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();

  // Vypočítať BVH strom pre bleskový raycasting terénu
  // @ts-ignore
  g.computeBoundsTree();

  return g;
}

function buildTerrainTileData(surface: CaveSurface, colStart: number, rowStart: number, colCount: number, rowCount: number, imgSize?: [number, number], subsample = 1) {
  const { dtm, bitmapCalib, centerOffset: { x: cx, y: cy, z: cz } } = surface;
  const { data, samples: origSamples, lines: origLines, calib } = dtm;

  const samples = colCount;
  const lines = rowCount;

  let globalMinZ = Infinity, globalMaxZ = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < globalMinZ) globalMinZ = data[i];
    if (data[i] > globalMaxZ) globalMaxZ = data[i];
  }
  const positions = new Float32Array(lines * samples * 3);
  const uvs = new Float32Array(lines * samples * 2);
  const colors = new Float32Array(lines * samples * 3);
  const indices: number[] = [];

  // Pre LOX bitmap: vypočítame kalibrované UV priamo na CPU
  // Použijeme bitmapCalib ak existuje, inak DTM calib (pre custom upload)
  const texCalib = bitmapCalib || null;
  const bitmapUvs = texCalib ? new Float32Array(lines * samples * 2) : undefined;

  // Inverzná matica bitmapCalib pre prevod world → bitmap pixel
  let bDetInv = 0, bxx = 0, bxy = 0, byx = 0, byy = 0, bOx = 0, bOy = 0;
  if (texCalib) {
    const bDet = texCalib.xx * texCalib.yy - texCalib.xy * texCalib.yx;
    bDetInv = bDet !== 0 ? 1.0 / bDet : 0;
    bxx = texCalib.xx; bxy = texCalib.xy;
    byx = texCalib.yx; byy = texCalib.yy;
    bOx = texCalib.xOrigin; bOy = texCalib.yOrigin;
  }

  const det = calib.xx * calib.yy - calib.xy * calib.yx;
  let vIdx = 0, uIdx = 0, cIdx = 0, buIdx = 0;

  for (let r = 0; r < lines; r++) {
    const row = rowStart + r;
    for (let c = 0; c < samples; c++) {
      const col = colStart + c;
      
      const idx = row * origSamples + col;
      const wx = calib.xOrigin + col * calib.xx + row * calib.xy;
      const wy = calib.yOrigin + col * calib.yx + row * calib.yy;
      const wz = data[idx];

      positions[vIdx++] = wx - cx;
      positions[vIdx++] = wz - cz;
      positions[vIdx++] = -(wy - cy);

      // Štandardné UV normalizované podľa DTM mriežky (pre custom textúru)
      uvs[uIdx++] = col / (origSamples - 1);
      uvs[uIdx++] = row / (origLines - 1);

      // Kalibrované UV pre LOX bitmap: world → bitmap pixel
      // Vždy ukladáme surové pixelové súradnice, normalizáciu urobí shader podľa uImgSize
      if (bitmapUvs && texCalib) {
        const dx = wx - bOx;
        const dy = wy - bOy;
        const px = (dx * byy - dy * bxy) * bDetInv;
        const py = (dy * bxx - dx * byx) * bDetInv;
        bitmapUvs[buIdx++] = px;
        bitmapUvs[buIdx++] = py;
      }

      const colorVal = elevColor(normZ(wz, globalMinZ, globalMaxZ));
      colors[cIdx++] = colorVal.r; colors[cIdx++] = colorVal.g; colors[cIdx++] = colorVal.b;
    }
  }

  for (let r = 0; r < lines - 1; r++) {
    for (let c = 0; c < samples - 1; c++) {
      const i0 = r * samples + c, i1 = i0 + 1, i2 = i0 + samples, i3 = i2 + 1;
      if (det > 0) {
        indices.push(i0, i1, i2, i2, i1, i3);
      } else {
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }
  }
  
  return { positions, uvs, bitmapUvs, colors, indices };
}

// ─── Terrain surface mesh (všetky módy) ──────────────────────────────────────
const TILE_SIZE = 128; // Počet vrcholov na hranu dlaždice

const TerrainTile = React.memo(({ surface, colStart, rowStart, colCount, rowCount, imgSize, imgSizeUniformRef, xyzCalib, ...props }: any) => {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const data = buildTerrainTileData(surface, colStart, rowStart, colCount, rowCount, imgSize, 1);
    const g = buildTerrainGeo(data);
    setGeo(g);
    return () => g.dispose();
  }, [surface, colStart, rowStart, colCount, rowCount, imgSize]);

  const contourUniforms = useMemo(() => ({
    uMajorInterval: { value: props.contourInterval || 10.0 },
    uMinorInterval: { value: props.minorInterval || 2.5 },
    uContourColor: { value: new THREE.Color(props.contourColor) },
    uContourColorMajor: { value: new THREE.Color(props.contourColor10 || props.contourColor) },
    uOpacity: { value: props.opacity || 0.8 },
    uCenterZ: { value: surface.centerOffset.z }
  }), [surface.centerOffset.z, props.contourInterval, props.minorInterval, props.contourColor, props.contourColor10, props.opacity]);

  useEffect(() => {
    contourUniforms.uMajorInterval.value = props.contourInterval || 10.0;
    contourUniforms.uMinorInterval.value = props.minorInterval || 2.5;
    contourUniforms.uContourColor.value.set(props.contourColor);
    contourUniforms.uContourColorMajor.value.set(props.contourColor10 || props.contourColor);
    contourUniforms.uOpacity.value = props.opacity;
  }, [contourUniforms, props.contourInterval, props.minorInterval, props.contourColor, props.contourColor10, props.opacity]);

  const contourMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: props.opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -10,
      polygonOffsetUnits: -10,
      clippingPlanes: props.clippingPlanes,
      onBeforeCompile: (shader: any) => {
        shader.uniforms.uMajorInterval = contourUniforms.uMajorInterval;
        shader.uniforms.uMinorInterval = contourUniforms.uMinorInterval;
        shader.uniforms.uContourColor = contourUniforms.uContourColor;
        shader.uniforms.uContourColorMajor = contourUniforms.uContourColorMajor;
        shader.uniforms.uOpacity = contourUniforms.uOpacity;
        shader.uniforms.uCenterZ = contourUniforms.uCenterZ;

        shader.vertexShader = `
          varying float vWorldZ;
          uniform float uCenterZ;
          ${shader.vertexShader}
        `.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWorldZ = (modelMatrix * vec4(transformed, 1.0)).y + uCenterZ;
          `
        );

        shader.fragmentShader = `
          varying float vWorldZ;
          uniform float uMajorInterval;
          uniform float uMinorInterval;
          uniform vec3 uContourColor;
          uniform vec3 uContourColorMajor;
          uniform float uOpacity;
          ${shader.fragmentShader}
        `.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          
          float zMaj = vWorldZ / uMajorInterval;
          float zMin = vWorldZ / uMinorInterval;
          
          float fMaj = fract(zMaj + 0.5) - 0.5;
          float fMin = fract(zMin + 0.5) - 0.5;
          
          float dfMaj = fwidth(zMaj);
          float dfMin = fwidth(zMin);

          // Výrazne hrubšie čiary pre lepšiu viditeľnosť
          // Major ~ 2.2 (celková šírka cca 4.5px), Minor ~ 1.0 (celková šírka cca 2px)
          float wMaj = 2.2 * dfMaj; 
          float wMin = 1.0 * dfMin;

          // smoothstep s rozsahom df pre maximálnu ostrosť bez aliasingu
          float lineMaj = smoothstep(wMaj, wMaj - dfMaj, abs(fMaj));
          float lineMin = smoothstep(wMin, wMin - dfMin, abs(fMin));

          float finalLine = max(lineMaj, lineMin);
          if (finalLine < 0.1) discard;

          vec3 finalColor = mix(uContourColor, uContourColorMajor, lineMaj);
          gl_FragColor = vec4(finalColor, finalLine * uOpacity);
          `
        );
      }
    } as any);
  }, [surface.centerOffset.z, contourUniforms, props.opacity, props.clippingPlanes]);

  useEffect(() => {
    contourMat.opacity = props.opacity;
    contourMat.clippingPlanes = props.clippingPlanes;
  }, [contourMat, props.opacity, props.clippingPlanes]);

  const textureUniforms = useMemo(() => ({
    uIsLoxBitmap: { value: 0.0 },
    uHasCalib:    { value: 0.0 },
    uImgSize:     { value: (imgSize && imgSize[0] > 1) ? imgSize : [1.0, 1.0] },
    uTexOffset:   { value: [props.options.surfaceTextureOffset.x, props.options.surfaceTextureOffset.y] },
    uDtmDim:      { value: [1.0, 1.0] },
    uCalib0:      { value: new THREE.Vector4(0,0,0,0) },
    uCalib1:      { value: new THREE.Vector4(0,0,0,0) },
    uCenterOffset: { value: [surface.centerOffset.x, surface.centerOffset.y] },
    uTextureOpacity: { value: 1.0 }
  }), []);

  useEffect(() => {
    const hasBitmapCalib = !!surface.bitmapCalib;
    const calib = props.options.surfaceTextureCalibration;
    const dtmWidth = (surface.dtm.samples - 1) * Math.abs(surface.dtm.calib.xx || 1);
    const dtmHeight = (surface.dtm.lines - 1) * Math.abs(surface.dtm.calib.yy || 1);
    
    const source = props.options.surfaceTextureSource || 'custom';
    const isCustom = source === 'custom';
    const isWmsXyz = source === 'wms-orto' || source === 'wms-shadow' || source === 'wms-geology' || source === 'wms-orto-freemap';
    const canCalib = (isCustom && calib) || (isWmsXyz && !!surface.sjtskBbox && !!xyzCalib);

    textureUniforms.uIsLoxBitmap.value = (hasBitmapCalib && !isCustom) ? 1.0 : 0.0;
    
    // For XYZ, we set uHasCalib to 1.0 here, but uCalib0/1 are set async when texture is loaded.
    // For custom, we set it based on calib.
    textureUniforms.uHasCalib.value    = canCalib ? 1.0 : 0.0;
    
    textureUniforms.uImgSize.value     = (imgSize && imgSize[0] > 1) ? imgSize : [1.0, 1.0];
    textureUniforms.uTexOffset.value   = [props.options.surfaceTextureOffset.x, props.options.surfaceTextureOffset.y];
    textureUniforms.uDtmDim.value      = [dtmWidth, dtmHeight];
    
    if (isCustom && calib) {
      textureUniforms.uCalib0.value.set(calib.p1.mx, calib.p1.my, calib.p2.mx, calib.p2.my);
      textureUniforms.uCalib1.value.set(calib.p1.x, calib.p1.y, calib.p2.x, calib.p2.y);
    } else if (isWmsXyz && xyzCalib) {
      textureUniforms.uCalib0.value.set(xyzCalib[0], xyzCalib[1], xyzCalib[2], xyzCalib[3]);
      textureUniforms.uCalib1.value.set(0, 0, imgSize[0], imgSize[1]);
    }

    textureUniforms.uTextureOpacity.value = props.options.surfaceTextureOpacity ?? 1.0;
  }, [textureUniforms, surface, imgSize, xyzCalib, props.options.surfaceTextureOffset, props.options.surfaceTextureCalibration, props.surfaceTextureUrl, props.options.surfaceTextureOpacity, props.options.surfaceTextureSource, props.options.surfaceWmsResolution]);

  if (!geo) return null;

  return (
    <group renderOrder={1}>
      {props.showMesh && (
        <mesh geometry={geo}>
          <meshStandardMaterial color={props.surfaceColor} side={THREE.DoubleSide} 
            transparent={props.opacity < 1} opacity={props.opacity}
            roughness={0.9} metalness={0.1} flatShading={true} 
            depthWrite={props.opacity === 1}
            polygonOffset polygonOffsetFactor={4} polygonOffsetUnits={4}
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
      {props.showNetwork && (
        <mesh geometry={geo}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent={props.opacity < 1} opacity={props.opacity}
            roughness={0.9} metalness={0.1} flatShading={true} 
            depthWrite={props.opacity === 1}
            polygonOffset polygonOffsetFactor={3} polygonOffsetUnits={3} 
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
      {props.showTexture && props.texture && (
        <mesh geometry={geo}>
          <meshStandardMaterial
            map={props.texture}
            side={THREE.DoubleSide}
            transparent={props.opacity < 1}
            opacity={props.opacity}
            roughness={0.85}
            depthWrite={true}
            polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
            clippingPlanes={props.clippingPlanes}
            onBeforeCompile={(shader) => {
              shader.uniforms.uIsLoxBitmap = textureUniforms.uIsLoxBitmap;
              shader.uniforms.uHasCalib = textureUniforms.uHasCalib;
              shader.uniforms.uImgSize = textureUniforms.uImgSize;
              shader.uniforms.uTexOffset = textureUniforms.uTexOffset;
              shader.uniforms.uDtmDim = textureUniforms.uDtmDim;
              shader.uniforms.uCalib0 = textureUniforms.uCalib0;
              shader.uniforms.uCalib1 = textureUniforms.uCalib1;
              shader.uniforms.uCenterOffset = textureUniforms.uCenterOffset;
              shader.uniforms.uTextureOpacity = textureUniforms.uTextureOpacity;
              
              if (imgSizeUniformRef) {
                imgSizeUniformRef.current.push(shader.uniforms.uImgSize);
                imgSizeUniformRef.current.push(shader.uniforms.uTexOffset);
              }

              shader.vertexShader = `
                attribute vec2 uv2;
                uniform float uIsLoxBitmap;
                uniform float uHasCalib;
                uniform vec4 uCalib0; // mx1, my1, mx2, my2
                uniform vec4 uCalib1; // px1, py1, px2, py2
                uniform vec2 uImgSize;
                uniform vec2 uCenterOffset;
                varying vec2 vTexUv;
                varying vec2 vWorldPosXZ;
                ${shader.vertexShader}
              `.replace(
                '#include <project_vertex>',
                `#include <project_vertex>
                 vWorldPosXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
                 if (uIsLoxBitmap > 0.5) {
                   vTexUv = uv2;
                 } else if (uHasCalib > 0.5) {
                   float wx = vWorldPosXZ.x + uCenterOffset.x;
                   float wy = -(vWorldPosXZ.y - uCenterOffset.y); 
                   float u_px = uCalib1.x + (wx - uCalib0.x) * (uCalib1.z - uCalib1.x) / (uCalib0.z - uCalib0.x);
                   float v_py = uCalib1.y + (wy - uCalib0.y) * (uCalib1.w - uCalib1.y) / (uCalib0.w - uCalib0.y);
                   vTexUv = vec2(u_px, v_py);
                 } else {
                   vTexUv = uv;
                 }
                `
              );

              shader.fragmentShader = `
                varying vec2 vTexUv;
                varying vec2 vWorldPosXZ;
                uniform float uIsLoxBitmap;
                uniform vec2 uImgSize;
                uniform vec2 uTexOffset;
                uniform vec2 uDtmDim;
                uniform float uHasCalib;
                uniform float uTextureOpacity;
                ${shader.fragmentShader}
              `.replace(
                '#include <map_fragment>',
                `
                #ifdef USE_MAP
                  vec2 finalUv = vTexUv;
                  if (uIsLoxBitmap > 0.5 || uHasCalib > 0.5) {
                    finalUv = vTexUv / uImgSize;
                  } else {
                    finalUv = vTexUv + uTexOffset / uDtmDim;
                  }
                  
                  bool outOfBounds = false;
                  if (uIsLoxBitmap > 0.5 || uHasCalib > 0.5) {
                    if (finalUv.x < 0.0 || finalUv.x > 1.0 || finalUv.y < 0.0 || finalUv.y > 1.0) {
                      outOfBounds = true;
                    }
                  }
                  
                  if (outOfBounds) {
                    // Mimo orezania textúry — necháme pôvodnú diffuse farbu
                  } else {
                    vec4 texelColor = texture2D( map, finalUv );
                    texelColor.a *= uTextureOpacity;
                    diffuseColor *= texelColor;
                  }
                #endif
                `
              );
            }}
          />
        </mesh>
      )}
      {props.showContours && (
        <mesh geometry={geo} material={contourMat} renderOrder={2} />
      )}
      {props.showMeshWire && (
        <mesh geometry={geo}>
          <meshBasicMaterial color={props.colorTerrainWire} wireframe depthWrite={false} transparent={true} opacity={0.45} clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
      <ClippingEdges 
        geo={geo} 
        planes={props.clippingPlanes || []} 
        active={props.options.showSurfaceClippingEdges} 
        color={props.options.colorSurfaceClippingEdges} 
      />
    </group>
  );
});

const TerrainMesh = React.memo(({ surface, isMeasuringMode, onStatusChange, ...props }: any) => {
  const { samples, lines } = surface.dtm;
  
  const tiles = useMemo(() => {
    const t = [];
    for (let r = 0; r < lines - 1; r += TILE_SIZE - 1) {
      const rowCount = Math.min(TILE_SIZE, lines - r);
      for (let c = 0; c < samples - 1; c += TILE_SIZE - 1) {
        const colCount = Math.min(TILE_SIZE, samples - c);
        t.push({ colStart: c, rowStart: r, colCount, rowCount });
      }
    }
    return t;
  }, [samples, lines]);

  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [imgSize, setImgSize] = useState<[number, number]>([1, 1])
  const [wmsLoading, setWmsLoading] = useState(false);
  const [wmsProgress, setWmsProgress] = useState(0);
  const [xyzCalib, setXyzCalib] = useState<number[] | null>(null);
  const imgSizeUniformRef = useRef<{ value: [number, number] }[]>([])


  useEffect(() => {
    let isActive = true;
    setTexture(null);

    const source = props.options.surfaceTextureSource || 'custom';
    let url: string | null = null;

    if (source === 'custom') {
      url = props.surfaceTextureUrl || surface.bitmapUrl;
    } else {
      if (source === 'wms-orto') {
        url = `/xyz-proxy/zbgis/Ortofoto/MapServer/tile/{z}/{y}/{x}?blankTile=false`;
      } else if (source === 'wms-shadow') {
        url = `/xyz-proxy/zbgis/LLS_DMR5/MapServer/tile/{z}/{y}/{x}?blankTile=false`;
      } else if (source === 'wms-orto-freemap') {
        url = `/xyz-proxy/freemap-orto/{z}/{x}/{y}.jpg`;
      } else if (source === 'wms-geology') {
        url = `/wms-proxy/geology/arcgis/services/WebServices/GM50/MapServer/WMSServer?service=WMS&request=GetMap&layers=0%2C1%2C2&styles=&format=image%2Fjpeg&transparent=false&version=1.3.0&width={width}&height={height}&crs=EPSG%3A3857&bbox={bbox}`;
      }
    }

    if (!url) {
      return;
    }

    const isWmsXyz = source === 'wms-orto' || source === 'wms-shadow' || source === 'wms-geology' || source === 'wms-orto-freemap';

    if (isWmsXyz && surface.sjtskBbox) {
      setWmsLoading(true);
      setWmsProgress(0);
      onStatusChange?.({ msg: 'Sťahujem mapové podklady...', type: 'progress', progress: 0 });
      
      const format = source === 'wms-shadow' ? 'image/png' : 'image/jpeg';

      let downloadPromise;
      // Map WMS Resolution selection to ZBGIS/Freemap XYZ zoom levels
      let zoomLevel = 16;
      if (props.options.surfaceWmsResolution <= 512) zoomLevel = 15;
      else if (props.options.surfaceWmsResolution <= 1024) zoomLevel = 16;
      else if (props.options.surfaceWmsResolution <= 2048) zoomLevel = 17;
      else zoomLevel = 18;

      downloadPromise = downloadTiledXyz(url, surface.sjtskBbox, format, (p) => {
        if (!isActive) return;
        const progress = Math.round((p.current / p.total) * 100);
        setWmsProgress(progress);
        
        let provider = 'ZBGIS';
        if (source.includes('freemap')) provider = 'Freemap';
        if (source.includes('geology')) provider = 'ŠGÚDŠ';
        
        onStatusChange?.({ msg: `Sťahujem mapové podklady (${provider})...`, type: 'progress', progress });
      }, zoomLevel);

      downloadPromise.then(result => {
        if (!isActive) return;
        
        const loader = new THREE.TextureLoader();
        loader.load(result.dataUrl, (t) => {
          if (!isActive) return;
          t.colorSpace = THREE.SRGBColorSpace;
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.needsUpdate = true;
          setTexture(t);
          
          const img = t.image;
          if (img) {
            const newSize: [number, number] = [img.width, img.height];
            setImgSize(newSize);
            for (const u of imgSizeUniformRef.current) u.value = newSize;
          }
          
          // CRITICAL: Update the UV calibration using the EXACT BBOX from the downloaded image!
          const [ex0, ey0, ex1, ey1] = result.sjtskBbox.split(',').map(Number);
          setXyzCalib([ex0, ey0, ex1, ey1]);
          
          setWmsLoading(false);
          onStatusChange?.({ msg: 'Mapové podklady úspešne načítané', type: 'success' });
          if (props.onTextureReady) props.onTextureReady(result.dataUrl, result.sjtskBbox);
          setTimeout(() => { if (isActive) onStatusChange?.(null); }, 3000);
        });
      }).catch(err => {
        if (!isActive) return;
        console.error("XYZ Scraping failed:", err);
        setWmsLoading(false);
        onStatusChange?.({ msg: 'Chyba: Nepodarilo sa stiahnuť mapové podklady', type: 'error' });
      });
    } else {
      const loader = new THREE.TextureLoader()
      loader.load(url, (t) => {
        if (!isActive) return;
        t.colorSpace = THREE.SRGBColorSpace
        t.flipY = true 
        t.needsUpdate = true
        if (t.image && t.image.width && t.image.height) {
          const newSize: [number, number] = [t.image.width, t.image.height]
          setImgSize(newSize)
          for (const u of imgSizeUniformRef.current) u.value = newSize
        }
        setTexture(t)
      })
    }
    return () => {
      isActive = false;
    }
  }, [surface.bitmapUrl, props.surfaceTextureUrl, props.options.surfaceTextureSource, props.options.surfaceWmsResolution, surface.sjtskBbox])

  const hoverGeo = useMemo(() => new THREE.SphereGeometry(0.25, 8, 8), [])
  const hoverMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ef4444", depthTest: false }), [])

  useEffect(() => {
    return () => {
      hoverGeo.dispose()
      hoverMat.dispose()
    }
  }, [hoverGeo, hoverMat])
  const [hoveredSurf, setHoveredSurf] = useState<[number, number, number] | null>(null)

  if (!props.showMesh && !props.showMeshWire && !props.showTexture && !props.showNetwork && !props.showContours) return null

  return (
    <group 
      position={[props.options.surfaceOffset?.x || 0, props.options.surfaceOffset?.z || 0, -(props.options.surfaceOffset?.y || 0)]}
      onClick={(e: any) => {
        if (props.onSurfaceClick && e.point) {
          e.stopPropagation()
          const { x, y, z } = e.point
          const origX = x + surface.centerOffset.x
          const origY = -z + surface.centerOffset.y
          const altitude = y + surface.centerOffset.z
          const ctrl = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey
          props.onSurfaceClick(origX, origY, altitude, e.nativeEvent.clientX, e.nativeEvent.clientY, ctrl)
        }
      }}
      onPointerMove={(e: any) => {
        if (props.onSurfaceClick && e.point) {
          e.stopPropagation()
          setHoveredSurf([e.point.x, e.point.y, e.point.z])
        }
      }}
      onPointerOut={() => setHoveredSurf(null)}
    >
      {tiles.map((tile, i) => (
        <TerrainTile 
          key={`${tile.colStart}-${tile.rowStart}-${imgSize[0]}x${imgSize[1]}`} 
          surface={surface} {...tile} {...props} 
          texture={texture} imgSize={imgSize} 
          xyzCalib={xyzCalib}
          imgSizeUniformRef={imgSizeUniformRef}
        />
      ))}
      
      {hoveredSurf && props.onSurfaceClick && (
        <mesh position={hoveredSurf} renderOrder={100} geometry={hoverGeo} material={hoverMat} />
      )}

      {props.showContours && props.options.showContourLabels && (
        <ContourLabels 
          surface={surface} 
          majorInterval={props.contourInterval || 10.0} 
          color={props.contourColor10 || props.contourColor}
          opacity={props.opacity}
        />
      )}
    </group>
  )
})

// ─── Manual Connection Line (Ctrl+Click measuring) ────────────────────────────
function ManualConnection({ p1, p2 }: { p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number} }) {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector3(p1.x, p1.z, -p1.y),
      new THREE.Vector3(p2.x, p2.z, -p2.y)
    ]
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    // Aby fungoval dashed material, treba vypočítať vzdialenosti v geometrii
    const line = new THREE.Line(g)
    line.computeLineDistances()
    return g
  }, [p1, p2])

  useEffect(() => {
    return () => geo.dispose()
  }, [geo])

  return (
    // @ts-ignore R3F line extends correctly but conflicts with SVG line locally 
    <line renderOrder={100} geometry={geo}>
      <lineDashedMaterial color="#ef4444" dashSize={1} gapSize={0.5} linewidth={2} depthTest={false} />
    </line>
  )
}

// ─── 3D Jaskyniar (Mierka presne 1.8m) ──────────────────────────────────────
function Character3D({ pos, pose, clippingPlanes }: { pos: [number, number, number], pose: 'standing' | 'crawling', clippingPlanes?: THREE.Plane[] }) {
  const isStanding = pose === 'standing'
  
  return (
    <group position={pos}>
      {/* Svetlo jaskyniara - aby bol viditeľný v tme */}
      <pointLight position={isStanding ? [0, 1.6, 0.2] : [0, 0.4, 0.4]} intensity={0.6} distance={10} color="#fffec8" />
      
      {/* Telo / Kombinéza */}
      <mesh position={isStanding ? [0, 1.2, 0] : [0, 0.15, -0.4]}>
        <boxGeometry args={isStanding ? [0.38, 0.6, 0.2] : [0.35, 0.3, 1.1]} />
        <meshStandardMaterial color="#ef4444" emissive="#220000" clippingPlanes={clippingPlanes} />
      </mesh>
      
      {/* Nohy */}
      {isStanding && (
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.3, 0.9, 0.18]} />
          <meshStandardMaterial color="#ef4444" emissive="#220000" clippingPlanes={clippingPlanes} />
        </mesh>
      )}

      {/* Hlava */}
      <mesh position={isStanding ? [0, 1.65, 0] : [0, 0.45, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#ffdbac" clippingPlanes={clippingPlanes} />
      </mesh>
      
      {/* Prilba */}
      <mesh position={isStanding ? [0, 1.7, 0] : [0, 0.5, 0]}>
        <sphereGeometry args={[0.12, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f59e0b" side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
      </mesh>
      
      {/* Čelovka */}
      <mesh position={isStanding ? [0, 1.68, 0.1] : [0, 0.48, 0.1]}>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} clippingPlanes={clippingPlanes} />
      </mesh>
      
      {/* Topánky */}
      {isStanding ? (
        <>
          <mesh position={[-0.08, 0.05, 0.02]}><boxGeometry args={[0.12, 0.1, 0.22]} /><meshStandardMaterial color="#111111" clippingPlanes={clippingPlanes} /></mesh>
          <mesh position={[0.08, 0.05, 0.02]}><boxGeometry args={[0.12, 0.1, 0.22]} /><meshStandardMaterial color="#111111" clippingPlanes={clippingPlanes} /></mesh>
        </>
      ) : (
        <mesh position={[0, 0.05, -0.9]}><boxGeometry args={[0.3, 0.1, 0.15]} /><meshStandardMaterial color="#111111" clippingPlanes={clippingPlanes} /></mesh>
      )}
    </group>
  )
}

function SceneBackground({ texture, color }: { texture: THREE.Texture | null, color: string }) {
  const { scene } = useThree()
  
  useEffect(() => {
    if (texture) {
      scene.background = texture
    } else {
      scene.background = new THREE.Color(color)
    }
  }, [scene, texture, color])
  
  return null
}

function RaycasterManager() {
  const { raycaster } = useThree()
  useEffect(() => {
    if (raycaster.params.Points) {
      raycaster.params.Points.threshold = 0.5;
    }
  }, [raycaster]);
  return null
}

function CameraMonitor({ onUpdate }: { onUpdate: (data: { dist: number, fov: number, height: number }) => void }) {
  const { camera, size } = useThree()
  
  useEffect(() => {
    const update = () => {
      // @ts-ignore
      const ctrl = camera.controls || (window as any)._orbitControls || (camera as any).controls
      const target = ctrl?.target || new THREE.Vector3(0, 0, 0)
      const dist = camera.position.distanceTo(target)
      // @ts-ignore
      const fov = camera.fov || 55
      onUpdate({ dist, fov, height: size.height })
    }
    const timer = setInterval(update, 200)
    return () => clearInterval(timer)
  }, [camera, size, onUpdate])
  
  return null
}
function AutoFit({ cave, trigger }: { cave: ParsedCave, trigger?: number }) {
  const { camera, controls } = useThree() as any
  useEffect(() => {
    const b    = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const dist = Math.max(diag * 2.0, 50)
    
    // Target the actual center of the model (in Three.js space: x=x, y=z, z=-y)
    const targetX = b.center.x;
    const targetY = b.center.z;
    const targetZ = -b.center.y;
    
    camera.position.set(targetX + dist, targetY + dist * 0.8, targetZ + dist)
    camera.near = 0.1; camera.far = Math.max(diag * 25, 5000)
    camera.updateProjectionMatrix()
    if (controls && controls.target) {
      controls.target.set(targetX, targetY, targetZ)
      controls.update()
    }
  }, [cave, trigger, camera, controls])
  return null
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────
interface Props {
  cave: ParsedCave
  options: ViewerOptions
  onStationClick: (idx: number, screenX: number, screenY: number, ctrlKey: boolean) => void
  onSurfaceClick?: (origX: number, origY: number, altitude: number, screenX: number, screenY: number) => void
  onBackgroundClick?: () => void
  onMoveStateChange?: (moving: boolean) => void
  onCameraUpdate?: (data: { dist: number, fov: number, height: number }) => void
  onProcessingStart?: (info: string) => void
  onProcessingEnd?: () => void
  onStatusChange?: (status: { msg: string; type: 'info' | 'error' | 'success' | 'progress'; progress?: number } | null) => void
  onTextureReady?: (dataUrl: string, bbox: string) => void
  manualConnection?: { p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number} } | null
  placedCaver?: { pos: [number, number, number], pose: 'standing' | 'crawling' } | null
  fitTrigger?: number
  contourInterval?: number
  minorInterval?: number
  selectedStations?: SelStation[]
  activeProfilePoints?: SelStation[] | null
  isMeasuringMode: boolean
}

function EntranceMarkerItem({ ent, options }: { ent: any, options: ViewerOptions }) {
  const ref = useRef<HTMLDivElement>(null)
  const vec = useMemo(() => new THREE.Vector3(ent.pos.x, ent.pos.z, -ent.pos.y), [ent])

  useFrame(({ camera }) => {
    if (ref.current) {
      const dist = camera.position.distanceTo(vec)
      // Dynamické škálovanie podľa vzdialenosti kamery, ale s limitmi pre ideálnu čitateľnosť
      const scale = Math.max(0.5, Math.min(2.5, 40 / dist))
      ref.current.style.transform = `translateY(-50%) scale(${scale})`
    }
  })

  return (
    <group position={[ent.pos.x, ent.pos.z, -ent.pos.y]}>
      {/* Vertical pin line */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 4]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      {/* Entrance Symbol and Label */}
      <Html center zIndexRange={[100, 0]} position={[0, 4, 0]}>
        <div ref={ref} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
          transformOrigin: 'bottom center',
          transition: 'transform 0.1s ease-out'
        }}>
          {/* SVG Mountain Icon */}
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            padding: '5px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            border: '2px solid white',
            width: '28px',
            height: '28px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M8 3l4 8 5-5 5 15H2L8 3z" />
            </svg>
          </div>
          
          {options.showEntranceLabels && (
            <div style={{
              marginTop: '6px',
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#fbbf24',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              border: '1.5px solid rgba(251, 191, 36, 0.5)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)'
            }}>
              {ent.fullLabel || ent.name}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

function EntranceMarkers({ cave, options }: { cave: ParsedCave, options: ViewerOptions }) {
  if (!options.showEntrances) return null
  
  const entrances = cave.stationLabels.filter(l => l.isEntrance)
  if (entrances.length === 0) return null

  return (
    <group>
      {entrances.map((ent, i) => (
        <EntranceMarkerItem key={ent.name + i} ent={ent} options={options} />
      ))}
    </group>
  )
}

const CaveViewer3D = ({ 
  cave, options: o, onStationClick, onSurfaceClick, onBackgroundClick, onMoveStateChange, onCameraUpdate, 
  onProcessingStart, onProcessingEnd, onStatusChange, manualConnection, placedCaver, fitTrigger, selectedStations, activeProfilePoints,
  contourInterval, minorInterval, isMeasuringMode
}: Props) => {
  const [isMoving, setIsMoving] = useState(false)
  const [camData, setCamData] = useState<{ dist: number, fov: number, height: number } | null>(null)
  const movingTimeout = useRef<any>(null)
  const startStopTimeout = useCallback(() => {
    if (movingTimeout.current) clearTimeout(movingTimeout.current)
    movingTimeout.current = setTimeout(() => {
      setIsMoving(false)
      movingTimeout.current = null
    }, 800) // Návrat do stable po 0.8s od uvoľnenia
  }, [])

  const handleCameraChange = useCallback(() => {
    if (!isMoving) setIsMoving(true)
    // Ak sa hýbe kamerou, predlžujeme draft stav
    startStopTimeout()
  }, [isMoving, startStopTimeout])

  useEffect(() => {
    onMoveStateChange?.(isMoving)
  }, [isMoving, onMoveStateChange])

  useEffect(() => {
    // Globálna a agresívna detekcia
    const onStart = () => { if (!isMoving) setIsMoving(true) }
    const onEnd = () => { startStopTimeout() }
    
    window.addEventListener('mousedown', onStart, { capture: true })
    window.addEventListener('mouseup', onEnd, { capture: true })
    window.addEventListener('wheel', handleCameraChange, { capture: true, passive: true })
    window.addEventListener('touchstart', onStart, { capture: true })
    window.addEventListener('touchend', onEnd, { capture: true })

    return () => {
      if (movingTimeout.current) clearTimeout(movingTimeout.current)
      window.removeEventListener('mousedown', onStart, { capture: true })
      window.removeEventListener('mouseup', onEnd, { capture: true })
      window.removeEventListener('wheel', handleCameraChange, { capture: true })
      window.removeEventListener('touchstart', onStart, { capture: true })
      window.removeEventListener('touchend', onEnd, { capture: true })
    }
  }, [isMoving, handleCameraChange, startStopTimeout])

  const diag     = Math.sqrt(cave.bounds.size.x ** 2 + cave.bounds.size.y ** 2 + cave.bounds.size.z ** 2)
  const gridSize = Math.max(diag * 1.5, 200)

  // ─── Gradient background creation (CATIA style) ──────────────────────────────
  const bgTexture = useMemo(() => {
    if (!o.colorBackground2) return null
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const grad = ctx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, o.colorBackground)
    grad.addColorStop(1, o.colorBackground2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 2, 512)
    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }, [o.colorBackground, o.colorBackground2])

  // ─── Clipping Planes ───
  const compositeClippingPlanes = useMemo(() => {
    const planes: THREE.Plane[] = []
    
    // 1. Horizontálny rez
    if (o.showClipping) {
      planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), o.clippingHeight - cave.centerOffset.z))
    }
    
    // 2. Vertikálny (profilový) rez
    if (o.showProfileClipping && activeProfilePoints && activeProfilePoints.length === 2) {
      const s1 = activeProfilePoints[0]
      const s2 = activeProfilePoints[1]
      
      const p1 = new THREE.Vector3(s1.origX - (s1.centerX||0), 0, -(s1.origY - (s1.centerY||0)))
      const p2 = new THREE.Vector3(s2.origX - (s1.centerX||0), 0, -(s2.origY - (s1.centerY||0)))
      
      const v = new THREE.Vector3().subVectors(p2, p1).normalize()
      if (v.lengthSq() > 0.0001) {
        let normal = new THREE.Vector3(-v.z, 0, v.x)
        if (o.profileClipFlip) normal.multiplyScalar(-1)
        planes.push(new THREE.Plane(normal, -normal.dot(p1) - o.profileClipOffset))
      }
    }
    
    return planes
  }, [o.showClipping, o.clippingHeight, o.showProfileClipping, o.profileClipFlip, o.profileClipOffset, activeProfilePoints, cave.centerOffset.z])

  const caveClippingPlanes = useMemo(() => {
    if (o.excludeModelFromClipping) return []
    return compositeClippingPlanes
  }, [o.excludeModelFromClipping, compositeClippingPlanes])

  return (
    <Canvas
      id="main-cave-canvas"
      gl={{ 
        antialias: true, 
        alpha: false, 
        preserveDrawingBuffer: true, 
        powerPreference: 'high-performance',
        localClippingEnabled: true // Aktivácia rezov
      }}
      raycaster={{ params: { Points: { threshold: 0.1 } } } as any}
      camera={{ fov: 55, near: 0.1, far: Math.max(diag * 20, 10000) }}
      onCreated={({ gl }) => {
        // Optimalizácia pre veľké modely – ak GPU nestíha
        gl.debug.checkShaderErrors = false 
      }}
      onPointerMissed={() => onBackgroundClick?.()}
      onPointerDown={() => setIsMoving(true)}
      onPointerMove={(e) => { if (e.buttons > 0) handleCameraChange() }}
      onWheel={() => handleCameraChange()}
    >
      <SceneBackground texture={bgTexture} color={o.colorBackground} />
      <RaycasterManager />
      <ambientLight intensity={0.25} /> {/* Znížené pre lepší kontrast tieňov */}
      <directionalLight position={[1, 3, 1]}    intensity={0.6} />
      <directionalLight position={[-2, 1, -2]} intensity={0.3} />
      
      {/* ── Svetlo pre zvýraznenie reliéfu (Hillshading) ── */}
      <directionalLight 
        position={[5, 1, 5]} 
        intensity={1.2} 
        color="#ffffff" 
      />
      
      <directionalLight position={[0, -2, 0]}   intensity={0.05} />
 
      {/* ── Terrain (Fixed in world space) ── */}
      {(o.showSurfaceMesh || o.showSurfaceMeshWire || o.showSurfaceTexture || o.showSurfaceNetwork || o.showContours) && cave.surfaces?.map((surf, i) => (
        <TerrainMesh
          key={i} surface={surf}
          showMesh={o.showSurfaceMesh}
          showMeshWire={o.showSurfaceMeshWire}
          showTexture={o.showSurfaceTexture}
          surfaceTextureUrl={o.surfaceTextureUrl}
          showNetwork={o.showSurfaceNetwork}
          showContours={o.showContours}
          contourColor={o.contourColor}
          contourColor10={o.contourColor10}
          contourInterval={contourInterval}
          minorInterval={minorInterval}
          opacity={o.surfaceOpacity}
          surfaceColor={o.surfaceColor}
          colorTerrainWire={o.colorTerrainWire}
          onSurfaceClick={onSurfaceClick}
          onStatusChange={onStatusChange}
          isMoving={isMoving}
          options={o}
          clippingPlanes={compositeClippingPlanes}
        />
      ))}

      {/* ─── CAVE MODEL (Movable for calibration) ─── */}
      <ModernGizmo visible={o.showGizmo && isMoving} modelScale={diag * 0.45} />
      <group position={[
        o.caveCalibrationOffset?.x || 0, 
        o.caveCalibrationOffset?.z || 0, 
        -(o.caveCalibrationOffset?.y || 0)
      ]}>
        {/* ── Entrances ── */}
        <EntranceMarkers cave={cave} options={o} />
        
        {/* ── Jaskyniar (Mierka) ── */}
        {o.placedCaver && (
          <Character3D 
            pos={o.placedCaver.pos} 
            pose={o.placedCaver.pose} 
            clippingPlanes={compositeClippingPlanes}
          />
        )}

        {/* ── Cave scraps ── */}
        {o.showScraps && cave.scraps?.length > 0 && (
          <CaveScraps
            cave={cave} opacity={o.scrapsOpacity}
            // Ak beží Surface Nets, vypneme "Solid" v tomto komponente, aby sa neprekrývali
            showSolid={o.scrapsSolid && !o.useSurfaceNet}
            showWire={o.scrapsWireframe}
            showAltitude={o.scrapsAltitude}
            smooth={o.smoothScraps}
            showRender={o.showRenderCave}
            caveTexture={o.caveTexture}
            renderOpacity={o.renderOpacity}
            isMoving={isMoving}
            options={o}
            clippingPlanes={caveClippingPlanes}
          />
        )}
        
        {/* ── LiDAR Point Cloud ── */}
        {o.showScraps && cave.pointCount > 0 && (
          <>
            <PointCloud 
              key={`pointcloud-${o.scrapsAltitude}-${o.showCaveLiDAR}`}
              cave={cave} 
              options={o} 
              clippingPlanes={caveClippingPlanes} 
              onSurfaceClick={onSurfaceClick} 
              isMoving={isMoving} 
            />
            <OrganicShell 
              key={`organic-${o.organicLevel}-${o.organicVoxelSize}-${o.organicDilation}-${o.smoothScraps}-${o.accurateScraps}`}
              cave={cave} 
              options={o} 
              clippingPlanes={caveClippingPlanes} 
              onSurfaceClick={onSurfaceClick} 
              isMoving={isMoving} 
            />
          </>
        )}

        {/* ── Cave traverse (3D rúrky) ── */}
        {o.showTraverse && cave.segments?.length > 0 && (
          <CaveTraverse 
            cave={cave} 
            radius={o.traverseRadius} 
            showAltitude={o.traverseAltitude} 
            isMoving={isMoving} 
            clippingPlanes={caveClippingPlanes}
          />
        )}

        {/* ── Survey legs ── */}
        <CaveLegs 
          cave={cave} 
          showSplay={o.showSplay} 
          showAltitude={o.traverseAltitude} 
          options={o} 
          clippingPlanes={compositeClippingPlanes}
        />

        {/* ── Station dots & labels & clickable targets ── */}
        {o.showStations && <Stations cave={cave} options={o} />}
        <ClickableStations cave={cave} onStationClick={onStationClick} isMeasuringMode={isMeasuringMode} />
        <group visible={!isMoving}>
          {(o.showStationNames || o.showStationAlt) && (
            <StationLabels cave={cave} showNames={o.showStationNames} showAltitudes={o.showStationAlt} options={o} />
          )}
        </group>

        {manualConnection && <ManualConnection p1={manualConnection.p1} p2={manualConnection.p2} />}
      </group>
 
      {/* ── Auto-fit pri zmene jaskyne alebo aktivácii triggera ── */}
      <AutoFit cave={cave} trigger={fitTrigger} />
 
      {/* ── Kompas / Gizmo v rohu ── */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#84cc16', '#3b82f6']} labelColor="white" labels={['V', 'H', 'J']} />
      </GizmoHelper>

      {/* ── Ground grid ── */}
      {manualConnection && <ManualConnection p1={manualConnection.p1} p2={manualConnection.p2} />}
      {o.placedCaver && <Character3D pos={o.placedCaver.pos} pose={o.placedCaver.pose} />}

      <DynamicGrid options={o} cameraData={camData} />
      {o.showBoundingBox && <BoundingBox cave={cave} show={o.showBoundingBox} options={o} />}

      <OrbitControls
        makeDefault
        enableDamping={true}
        dampingFactor={0.05}
        onStart={() => setIsMoving(true)}
        onChange={handleCameraChange}
        rotateSpeed={0.6} zoomSpeed={0.8} panSpeed={0.8}
        minDistance={1} maxDistance={Math.max(diag * 25, 10000)}
        autoRotate={o.autoRotate}
        autoRotateSpeed={o.autoRotateSpeed}
      />

      <CameraMonitor onUpdate={(data) => {
        setCamData(data)
        if (onCameraUpdate) onCameraUpdate(data)
      }} />
    </Canvas>
  )
}

export default React.memo(CaveViewer3D)

// ─── Map Georeferencing Utilities ─────────────────────────────────────────────

function solveAffine(matches: { src: {x:number, y:number}, dst: {x:number, y:number} }[]) {
  if (!matches || matches.length < 2) return { a:1, b:0, c:0, d:0, e:1, f:0 }
  
  let srcX = 0, srcY = 0, dstX = 0, dstY = 0
  let count = 0
  matches.forEach(m => {
    if (m && m.src && m.dst && isFinite(m.src.x) && isFinite(m.src.y)) {
      srcX += m.src.x; srcY += m.src.y; dstX += m.dst.x; dstY += m.dst.y
      count++
    }
  })
  if (count < 2) return { a:1, b:0, c:0, d:0, e:1, f:0 }
  
  srcX /= count; srcY /= count; dstX /= count; dstY /= count
  
  let sxx=0, sxy=0, syy=0, sxdx=0, sxdy=0, sydx=0, sydy=0
  matches.forEach(m => {
    if (m && m.src && m.dst && isFinite(m.src.x) && isFinite(m.src.y)) {
      const dx = m.src.x - srcX, dy = m.src.y - srcY
      const dDx = m.dst.x - dstX, dDy = m.dst.y - dstY
      sxx += dx*dx; sxy += dx*dy; syy += dy*dy
      sxdx += dx*dDx; sxdy += dx*dDy; sydx += dy*dDx; sydy += dy*dDy
    }
  })
  
  const det = sxx * syy - sxy * sxy
  if (!isFinite(det) || Math.abs(det) < 1e-12) return { a:1, b:0, c:0, d:0, e:1, f:0 }
  
  const a = (sxdx * syy - sydx * sxy) / det
  const b = (sydx * sxx - sxdx * sxy) / det
  const d = (sxdy * syy - sydy * sxy) / det
  const e = (sydy * sxx - sxdy * sxy) / det
  const c = dstX - a * srcX - b * srcY
  const f = dstY - d * srcX - e * srcY
  
  // Final check for validity
  if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d) || !isFinite(e) || !isFinite(f)) {
    return { a:1, b:0, c:0, d:0, e:1, f:0 }
  }
  
  return { a, b, c, d, e, f }
}

function parseSVGStations(svgText: string): { name: string, x: number, y: number }[] {
  const stations: { name: string, x: number, y: number }[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const texts = doc.querySelectorAll('text')
  texts.forEach(t => {
    const name = t.textContent?.trim() || ''
    const x = parseFloat(t.getAttribute('x') || '0')
    const y = parseFloat(t.getAttribute('y') || '0')
    if (name && !isNaN(x) && !isNaN(y)) stations.push({ name, x, y })
  })
  return stations
}
