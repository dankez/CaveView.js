import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import type { ParsedCave, CaveSurface, Segment } from '../parsers/caveParser'
import type { SelStation } from '../App'

// ─── BVH Initialization ───────────────────────────────────────────────────────
// @ts-ignore
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

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
  smoothScraps:        boolean
  showRenderCave:      boolean
  caveTexture:         'limestone' | 'dolomite' | 'grey_limestone'
  renderOpacity:       number
  // Cave traverse
  showTraverse:        boolean
  traverseRadius:      number
  traverseAltitude:    boolean
  // Terrain surface
  showSurfaceMesh:     boolean
  showSurfaceMeshWire: boolean
  showSurfaceTexture:  boolean
  showSurfaceNetwork:  boolean
  surfaceOpacity:      number
  surfaceColor:        string
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
  clippingPlanes?:     any[]

  // Floor Map
  floorMapSvg:         string | null
  floorMapTh2:         any | null  // Parsed Th2Scrap[]
  floorMapOpacity:     number
  manualMatches:       { src: { x: number; y: number }; dst: { x: number; y: number } }[] | null
}

// ─── Clickable stations (neviditelné gule, raycasting) & Hover Highlight ───
function ClickableStations({ cave, onStationClick }: {
  cave: ParsedCave
  onStationClick: (idx: number, screenX: number, screenY: number, ctrlKey: boolean) => void
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
          e.stopPropagation()
          if (e.instanceId !== undefined) setHoveredIdx(e.instanceId)
        }}
        onPointerOut={() => setHoveredIdx(null)}
        onClick={(e: any) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) {
            const ctrl = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey
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
          const wx = calib.xOrigin + p.c * calib.xx + p.r * calib.xy - cx.x
          const wy = calib.yOrigin + p.c * calib.yx + p.r * calib.yy - cx.y
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
        b.min.y = Math.min(b.min.y, sMinZ - cx.z)
        b.max.y = Math.max(b.max.y, sMaxZ - cx.z)
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
  const p: number[] = []
  for (const s of segs) {
    p.push(s.from.x, s.from.z, -s.from.y)
    p.push(s.to.x,   s.to.z,   -s.to.y)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  return g
}

function segsToGeoWithColors(segs: Segment[], mnZ: number, mxZ: number) {
  const p: number[] = []
  const colors: number[] = []
  for (const s of segs) {
    p.push(s.from.x, s.from.z, -s.from.y)
    p.push(s.to.x,   s.to.z,   -s.to.y)
    const c1 = elevColor(normZ(s.from.z, mnZ, mxZ))
    const c2 = elevColor(normZ(s.to.z,   mnZ, mxZ))
    colors.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
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
    const pP: number[] = [], pS: number[] = []
    for (let i = 0; i < cave.stations.length; i++) {
      const s = cave.stations[i]
      const lbl = cave.stationLabels?.[i]
      const isPolygon = lbl && lbl.name !== ''
      if (isPolygon) pP.push(s.x, s.z, -s.y)
      else           pS.push(s.x, s.z, -s.y)
    }
    const gP = new THREE.BufferGeometry()
    gP.setAttribute('position', new THREE.Float32BufferAttribute(pP, 3))
    const gS = new THREE.BufferGeometry()
    gS.setAttribute('position', new THREE.Float32BufferAttribute(pS, 3))
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
function buildScrapsGeo(cave: ParsedCave, withColors: boolean, smooth: boolean): THREE.BufferGeometry | null {
  if (!cave.scraps?.length) return null

  let minZ = Infinity, maxZ = -Infinity
  if (withColors)
    for (const sc of cave.scraps)
      for (const v of sc.vertices) {
        if (v.z < minZ) minZ = v.z
        if (v.z > maxZ) maxZ = v.z
      }

  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = []
  let base = 0

  for (const sc of cave.scraps) {
    for (const v of sc.vertices) {
      positions.push(v.x, v.z, -v.y)
      // Generovať UV (jednoduchá projekcia pre jaskynné steny)
      uvs.push(v.x * 0.2, (v.z + v.y) * 0.2)
      if (withColors) {
        const c = elevColor(normZ(v.z, minZ, maxZ))
        colors.push(c.r, c.g, c.b)
      }
    }
    for (const [a, b, c] of sc.faces)
      if (a < sc.vertices.length && b < sc.vertices.length && c < sc.vertices.length)
        indices.push(base + a, base + b, base + c)
    base += sc.vertices.length
  }

  if (!positions.length || !indices.length) return null
  if (!positions.length || !indices.length) return null
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2))
  if (withColors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  
  if (smooth) {
    // 1. Zvariť vrcholy aby sa plochy "dotkli" a zdieľali normály (a vyhladenie prešlo celou sieťou)
    g = mergeVertices(g, 1e-3)
    // 2. Taubin Smoothing pre odstránenie ostrých zubcov a zlých hrán (šetrnejší k objemu, pinned borders)
    g = applyTaubinSmoothing(g, 3)
    // 3. Poctivé výpočty tieňov so zavážením uhlov pre top vizuál
    g = computeAngleWeightedNormals(g)
  } else {
    // Klastický neprerušovaný flatshading s computeVertexNormals default
    g.computeVertexNormals()
  }
  
  // Vypočítať BVH strom pre bleskový raycasting
  // @ts-ignore
  g.computeBoundsTree()
  
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
      currentSolid = buildScrapsGeo(cave, false, smooth)
      currentAlt = buildScrapsGeo(cave, true, smooth)
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
  }, [cave, smooth])

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
      {showSolid && !showRender && !isMoving && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={5}>
          <meshStandardMaterial color={options.colorScraps} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.7} metalness={0.1}
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}

      {/* ── Realistický Render Mode (Textúra) ── */}
      {showRender && !isMoving && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={4}>
          <meshStandardMaterial 
            map={rockTex} 
            color={caveTexture === 'grey_limestone' ? '#d1d5db' : (caveTexture === 'dolomite' ? '#f1f5f9' : '#ffffff')} 
            side={THREE.DoubleSide} 
            transparent={renderOpacity < 1} opacity={renderOpacity}
            roughness={0.8} 
            metalness={0.05}
            polygonOffset polygonOffsetFactor={0.5} polygonOffsetUnits={0.5} />
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

      {/* ── Drôtený model ── */}
      {(showWire || isMoving) && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={10}>
          <meshBasicMaterial color={options.colorScrapsWire} wireframe depthWrite={false} transparent={true}
            opacity={isMoving ? 0.4 : (showSolid || showAltitude ? 0.28 : 0.65)} 
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
    </>
  )
})

// ─── Terrain geometry builder ────────────────────────────────────────────────
function buildTerrainGeo({ positions, uvs, colors, indices }: { positions: Float32Array, uvs: Float32Array, colors: Float32Array, indices: number[] }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();

  // Vypočítať BVH strom pre bleskový raycasting terénu
  // @ts-ignore
  g.computeBoundsTree();

  return g;
}

function buildTerrainTileData(surface: CaveSurface, colStart: number, rowStart: number, colCount: number, rowCount: number, subsample = 1) {
  const { dtm, centerOffset: { x: cx, y: cy, z: cz } } = surface;
  const { data, samples: origSamples, lines: origLines, calib } = dtm;

  const samples = colCount;
  const lines = rowCount;

  // Lokálny výškový rozsah pre tento tile (kvôli farbám)
  // Poznámka: pre konzistentné farby cez celú jaskyňu by sme mali použiť globálny min/max
  // Alebo aspoň odovzdať globálne minZ/maxZ
  let globalMinZ = Infinity, globalMaxZ = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < globalMinZ) globalMinZ = data[i];
    if (data[i] > globalMaxZ) globalMaxZ = data[i];
  }

  const positions = new Float32Array(lines * samples * 3);
  const uvs = new Float32Array(lines * samples * 2);
  const colors = new Float32Array(lines * samples * 3);
  const indices: number[] = [];

  const det = calib.xx * calib.yy - calib.xy * calib.yx;
  let vIdx = 0, uIdx = 0, cIdx = 0;

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

      uvs[uIdx++] = col / (origSamples - 1);
      uvs[uIdx++] = row / (origLines - 1);

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
  
  return { positions, uvs, colors, indices };
}

// ─── Terrain surface mesh (všetky módy) ──────────────────────────────────────
const TILE_SIZE = 128; // Počet vrcholov na hranu dlaždice

const TerrainTile = React.memo(({ surface, colStart, rowStart, colCount, rowCount, ...props }: any) => {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const data = buildTerrainTileData(surface, colStart, rowStart, colCount, rowCount, 1);
    const g = buildTerrainGeo(data);
    setGeo(g);
    return () => g.dispose();
  }, [surface, colStart, rowStart, colCount, rowCount]);

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
          <meshStandardMaterial map={props.texture} side={THREE.DoubleSide} transparent={props.opacity < 1} opacity={props.opacity}
            roughness={0.85} depthWrite={props.opacity === 1}
            polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2}
            clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
      {props.showMeshWire && (
        <mesh geometry={geo}>
          <meshBasicMaterial color={props.colorTerrainWire} wireframe depthWrite={false} transparent={true} opacity={0.45} clippingPlanes={props.clippingPlanes} />
        </mesh>
      )}
    </group>
  );
});

const TerrainMesh = React.memo(({ surface, ...props }: any) => {
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

  useEffect(() => {
    if (!surface.bitmapUrl) {
      setTexture(null)
      return
    }
    const tex = new THREE.TextureLoader().load(surface.bitmapUrl)
    setTexture(tex)
    return () => tex.dispose()
  }, [surface.bitmapUrl])

  const hoverGeo = useMemo(() => new THREE.SphereGeometry(0.25, 8, 8), [])
  const hoverMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ef4444", depthTest: false }), [])

  useEffect(() => {
    return () => {
      hoverGeo.dispose()
      hoverMat.dispose()
    }
  }, [hoverGeo, hoverMat])
  const [hoveredSurf, setHoveredSurf] = useState<[number, number, number] | null>(null)

  if (!props.showMesh && !props.showMeshWire && !props.showTexture && !props.showNetwork) return null

  return (
    <group
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
        <TerrainTile key={`${tile.colStart}-${tile.rowStart}`} surface={surface} {...tile} {...props} texture={texture} />
      ))}
      
      {hoveredSurf && props.onSurfaceClick && (
        <mesh position={hoveredSurf} renderOrder={100} geometry={hoverGeo} material={hoverMat} />
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
function Character3D({ pos, pose }: { pos: [number, number, number], pose: 'standing' | 'crawling' }) {
  const isStanding = pose === 'standing'
  
  return (
    <group position={pos}>
      {/* Telo / Kombinéza (červená) */}
      <mesh position={isStanding ? [0, 1.2, 0] : [0, 0.15, -0.4]}>
        <boxGeometry args={isStanding ? [0.38, 0.6, 0.2] : [0.35, 0.3, 1.1]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      
      {/* Nohy (červená) */}
      {isStanding && (
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.3, 0.9, 0.18]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      )}

      {/* Hlava (pleťová / ružová) */}
      <mesh position={isStanding ? [0, 1.65, 0] : [0, 0.45, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      
      {/* Prilba (červená) */}
      <mesh position={isStanding ? [0, 1.7, 0] : [0, 0.5, 0]}>
        <sphereGeometry args={[0.12, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ef4444" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Čelovka (čierna/biela) */}
      <mesh position={isStanding ? [0, 1.68, 0.1] : [0, 0.48, 0.1]}>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      
      {/* Topánky (čierne) */}
      {isStanding ? (
        <>
          <mesh position={[-0.08, 0.05, 0.02]}><boxGeometry args={[0.12, 0.1, 0.22]} /><meshStandardMaterial color="#111111" /></mesh>
          <mesh position={[0.08, 0.05, 0.02]}><boxGeometry args={[0.12, 0.1, 0.22]} /><meshStandardMaterial color="#111111" /></mesh>
        </>
      ) : (
        <mesh position={[0, 0.05, -0.9]}><boxGeometry args={[0.3, 0.1, 0.15]} /><meshStandardMaterial color="#111111" /></mesh>
      )}

      {/* Svetelný kužeľ z čelovky */}
      <mesh position={isStanding ? [0, 1.68, 0.3] : [0, 0.48, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 1.5, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
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
    // Zvýšená vzdialenosť (2.0 * diag) pre skutočný "Fit to screen"
    const dist = Math.max(diag * 2.0, 50)
    camera.position.set(dist, dist * 0.8, dist)
    camera.near = 0.1; camera.far = diag * 25
    camera.updateProjectionMatrix()
    if (controls && controls.target) {
      controls.target.set(0, 0, 0)
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
  manualConnection?: { p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number} } | null
  placedCaver?: { pos: [number, number, number], pose: 'standing' | 'crawling' } | null
  fitTrigger?: number
  selectedStations?: SelStation[]
  activeProfilePoints?: SelStation[] | null
}

// ─── Entrance Markers ─────────────────────────────────────────────────────────
function EntranceMarkers({ cave, options }: { cave: ParsedCave, options: ViewerOptions }) {
  if (!options.showEntrances) return null
  
  const entrances = cave.stationLabels.filter(l => l.isEntrance)
  if (entrances.length === 0) return null

  return (
    <group>
      {entrances.map((ent, i) => (
        <group key={ent.name + i} position={[ent.pos.x, ent.pos.z, -ent.pos.y]}>
          {/* Vertical pin line */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 4]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>

          {/* Entrance Symbol and Label */}
          <Html center distanceFactor={20} zIndexRange={[100, 0]} position={[0, 4, 0]}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
              transform: 'translateY(-50%)'
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
                  fontSize: '11px',
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
      ))}
    </group>
  )
}

const CaveViewer3D = ({ 
  cave, options: o, onStationClick, onSurfaceClick, onBackgroundClick, onMoveStateChange, onCameraUpdate, 
  onProcessingStart, onProcessingEnd, manualConnection, placedCaver, fitTrigger, selectedStations, activeProfilePoints 
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

  return (
    <Canvas
      gl={{ 
        antialias: true, 
        alpha: false, 
        preserveDrawingBuffer: false, 
        powerPreference: 'high-performance',
        localClippingEnabled: true // Aktivácia rezov
      }}
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

      {/* ── Entrances ── */}
      <EntranceMarkers cave={cave} options={o} />

      {/* ── Terrain ── */}
      {(o.showSurfaceMesh || o.showSurfaceMeshWire || o.showSurfaceTexture || o.showSurfaceNetwork) && cave.surfaces?.map((surf, i) => (
        <TerrainMesh
          key={i} surface={surf}
          showMesh={o.showSurfaceMesh}
          showMeshWire={o.showSurfaceMeshWire}
          showTexture={o.showSurfaceTexture}
          showNetwork={o.showSurfaceNetwork}
          opacity={o.surfaceOpacity}
          surfaceColor={o.surfaceColor}
          colorTerrainWire={o.colorTerrainWire}
          onSurfaceClick={onSurfaceClick}
          isMoving={isMoving}
          options={o}
          clippingPlanes={compositeClippingPlanes}
        />
      ))}

      {/* ── Cave scraps ── */}
      {o.showScraps && cave.scraps?.length > 0 && (
        <CaveScraps
          cave={cave} opacity={o.scrapsOpacity}
          showSolid={o.scrapsSolid}
          showWire={o.scrapsWireframe}
          showAltitude={o.scrapsAltitude}
          smooth={o.smoothScraps}
          showRender={o.showRenderCave}
          caveTexture={o.caveTexture}
          renderOpacity={o.renderOpacity}
          isMoving={isMoving}
          options={o}
          clippingPlanes={compositeClippingPlanes}
        />
      )}

      {/* ── Cave traverse (3D rúrky) ── */}
      {o.showTraverse && cave.segments?.length > 0 && (
        <CaveTraverse 
          cave={cave} 
          radius={o.traverseRadius} 
          showAltitude={o.traverseAltitude} 
          isMoving={isMoving} 
          clippingPlanes={compositeClippingPlanes}
        />
      )}

      {/* ── Auto-fit pri zmene jaskyne alebo aktivácii triggera ── */}
      <AutoFit cave={cave} trigger={fitTrigger} />

      {/* ── Kompas / Gizmo v rohu ── */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#84cc16', '#3b82f6']} labelColor="white" labels={['V', 'H', 'J']} />
      </GizmoHelper>

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
      <ClickableStations cave={cave} onStationClick={onStationClick} />
      <group visible={!isMoving}>
        {(o.showStationNames || o.showStationAlt) && (
          <StationLabels cave={cave} showNames={o.showStationNames} showAltitudes={o.showStationAlt} options={o} />
        )}
      </group>

      {/* ── Ground grid ── */}
      {manualConnection && <ManualConnection p1={manualConnection.p1} p2={manualConnection.p2} />}
      {o.placedCaver && <Character3D pos={o.placedCaver.pos} pose={o.placedCaver.pose} />}

      <DynamicGrid options={o} cameraData={camData} />
      {o.showBoundingBox && <BoundingBox cave={cave} show={o.showBoundingBox} options={o} />}

      <OrbitControls
        makeDefault
        enableDamping={false}
        onStart={() => setIsMoving(true)}
        onChange={handleCameraChange}
        rotateSpeed={0.6} zoomSpeed={0.8} panSpeed={0.8}
        minDistance={1} maxDistance={Math.max(diag * 25, 10000)}
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
  if (matches.length < 2) return { a:1, b:0, c:0, d:0, e:1, f:0 }
  
  let srcX = 0, srcY = 0, dstX = 0, dstY = 0
  matches.forEach(m => { srcX += m.src.x; srcY += m.src.y; dstX += m.dst.x; dstY += m.dst.y })
  srcX /= matches.length; srcY /= matches.length; dstX /= matches.length; dstY /= matches.length
  
  let sxx=0, sxy=0, syy=0, sxdx=0, sxdy=0, sydx=0, sydy=0
  matches.forEach(m => {
    const dx = m.src.x - srcX, dy = m.src.y - srcY
    const dDx = m.dst.x - dstX, dDy = m.dst.y - dstY
    sxx += dx*dx; sxy += dx*dy; syy += dy*dy
    sxdx += dx*dDx; sxdy += dx*dDy; sydx += dy*dDx; sydy += dy*dDy
  })
  
  const det = sxx * syy - sxy * sxy
  if (Math.abs(det) < 1e-10) return { a:1, b:0, c:0, d:0, e:1, f:0 }
  
  const a = (sxdx * syy - sydx * sxy) / det
  const b = (sydx * sxx - sxdx * sxy) / det
  const d = (sxdy * syy - sydy * sxy) / det
  const e = (sydy * sxx - sxdy * sxy) / det
  const c = dstX - a * srcX - b * srcY
  const f = dstY - d * srcX - e * srcY
  
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
