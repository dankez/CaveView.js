import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ParsedCave, CaveSurface, Segment } from '../parsers/caveParser'

// ─── ViewerOptions ────────────────────────────────────────────────────────────
export interface ViewerOptions {
  // Survey
  showSplay:           boolean
  // Stations
  showStations:        boolean
  showStationNames:    boolean
  showStationAlt:      boolean
  // Grid
  showGrid:            boolean
  // Cave scraps (walls)
  showScraps:          boolean
  scrapsOpacity:       number
  scrapsSolid:         boolean
  scrapsWireframe:     boolean
  scrapsAltitude:      boolean
  smoothScraps:        boolean
  showRenderCave:      boolean
  caveTexture:         'rock' | 'limestone' | 'granite'
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

function CaveLegs({ cave, showSplay, showAltitude }: { cave: ParsedCave; showSplay: boolean; showAltitude: boolean }) {
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

  return (
    <group>
      <lineSegments geometry={caveGeo}>
        <lineBasicMaterial color="#ffffff" linewidth={2} vertexColors={showAltitude} transparent={false} />
      </lineSegments>
      {showSplay && splaySegs.length > 0 && (
        <lineSegments geometry={splayGeo}>
          <lineBasicMaterial color="#78909c" transparent opacity={0.45} />
        </lineSegments>
      )}
      {surfaceSegs.length > 0 && (
        <lineSegments geometry={surfaceGeo}>
          <lineBasicMaterial color="#a0aec0" transparent opacity={0.6} />
        </lineSegments>
      )}
    </group>
  )
}

// ─── Cave traverse — polygonový ťah (InstancedMesh rúrky s altitude farbami) ──
const CaveTraverse = React.memo(({ cave, radius, showAltitude, isMoving }: { cave: ParsedCave; radius: number; showAltitude: boolean, isMoving: boolean }) => {
  if (isMoving) return null // Skryť ťažké rúry pri pohybe (zostanú viditeľné tenké čiary z CaveLegs)
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

  const mesh = useMemo(() => {
    const count = caveLegs.length
    const mat   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15 })
    const im    = new THREE.InstancedMesh(cylGeo, mat, count)
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)

    const dummy  = new THREE.Object3D()
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

    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    return im
  }, [caveLegs, zRange, cylGeo, radius, showAltitude])

  return <primitive object={mesh} renderOrder={6} />
})

// ─── Station dots ─────────────────────────────────────────────────────────────
function Stations({ cave }: { cave: ParsedCave }) {
  const { polyGeo, splayGeo } = useMemo(() => {
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

  return (
    <group renderOrder={7}>
      {/* Splay body - menšie žlté */}
      <points geometry={splayGeo}>
        <pointsMaterial color="#fbbf24" size={2} sizeAttenuation={false} depthTest={false} />
      </points>
      {/* Polygonové body - väčšie červené a výrazné */}
      <points geometry={polyGeo}>
        <pointsMaterial color="#ef4444" size={5} sizeAttenuation={false} depthTest={false} />
      </points>
    </group>
  )
}

// ─── Station labels ───────────────────────────────────────────────────────────
function StationLabels({ cave, showNames, showAltitudes }: { cave: ParsedCave; showNames: boolean; showAltitudes: boolean }) {
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
              <span style={{ fontSize: '9px', fontFamily: 'Inter, monospace', color: '#fbbf24', fontWeight: 600, textShadow: '0 0 3px #000,0 0 6px #000', lineHeight: 1.2 }}>
                {sl.name}
              </span>
            )}
            {showAltitudes && sl.name !== '' && (
              <span style={{ fontSize: '8px', fontFamily: 'Inter, monospace', color: '#a5f3fc', textShadow: '0 0 3px #000,0 0 5px #000', lineHeight: 1.2 }}>
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
  
  return g
}

// ─── Cave wall scraps — solid + wireframe + altitude (independent) ─────────────
const CaveScraps = React.memo(({ cave, opacity, showSolid, showWire, showAltitude, smooth, showRender, caveTexture, renderOpacity, isMoving }: {
  cave: ParsedCave; opacity: number
  showSolid: boolean; showWire: boolean; showAltitude: boolean; smooth: boolean; showRender: boolean
  caveTexture: 'rock' | 'limestone' | 'granite'
  renderOpacity: number
  isMoving: boolean
}) => {
  // Solid geometry (no colors)
  const solidGeo = useMemo(() => buildScrapsGeo(cave, false, smooth), [cave, smooth])
  // Altitude geometry (with vertex colors)
  const altGeo   = useMemo(() => buildScrapsGeo(cave, true, smooth),  [cave, smooth])
 
  const rockTex = useMemo(() => {
    let path = '/assets/cave_rock.png'
    if (caveTexture === 'limestone') path = '/assets/cave_limestone.png'
    if (caveTexture === 'granite')   path = '/assets/cave_granite.png'
    
    const tex = new THREE.TextureLoader().load(path)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(10, 10)
    return tex
  }, [caveTexture])

  return (
    <>
      {/* ── Tieňovaný solid mesh ── */}
      {showSolid && !showRender && !isMoving && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={2}>
          <meshStandardMaterial color="#2a5585" side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.7} metalness={0.1}
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
      )}

      {/* ── Realistický Render Mode (Textúra) ── */}
      {showRender && !isMoving && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={4}>
          <meshStandardMaterial map={rockTex} color="#ffffff" side={THREE.DoubleSide} 
            transparent={renderOpacity < 1} opacity={renderOpacity}
            roughness={0.9} 
            metalness={0.1}
            polygonOffset polygonOffsetFactor={0.5} polygonOffsetUnits={0.5} />
        </mesh>
      )}

      {/* ── Farebné podel výšky ── */}
      {showAltitude && altGeo && (
        <mesh geometry={altGeo} renderOrder={3}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.65} metalness={0.05}
            polygonOffset polygonOffsetFactor={0} polygonOffsetUnits={0} />
        </mesh>
      )}

      {/* ── Drôtený model — vždy navrch, alebo ako draft pri pohybe ── */}
      {(showWire || isMoving) && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={10}>
          <meshBasicMaterial color="#6a9fd8" wireframe depthWrite={false} transparent={true}
            opacity={isMoving ? 0.4 : (showSolid || showAltitude ? 0.28 : 0.65)} />
        </mesh>
      )}
    </>
  )
})

// ─── Terrain geometry builder ────────────────────────────────────────────────
function buildTerrainBaseData(surface: CaveSurface, subsample = 1) {
  const { dtm, centerOffset: { x: cx, y: cy, z: cz } } = surface;
  const { data, samples: origSamples, lines: origLines, calib } = dtm;

  const samples = Math.ceil(origSamples / subsample);
  const lines = Math.ceil(origLines / subsample);

  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < minZ) minZ = data[i];
    if (data[i] > maxZ) maxZ = data[i];
  }

  const positions = new Float32Array(lines * samples * 3);
  const uvs = new Float32Array(lines * samples * 2);
  const colors = new Float32Array(lines * samples * 3);
  const indices: number[] = [];

  const det = calib.xx * calib.yy - calib.xy * calib.yx;
  let vIdx = 0, uIdx = 0, cIdx = 0;

  for (let r = 0; r < lines; r++) {
    const row = Math.min(r * subsample, origLines - 1);
    for (let c = 0; c < samples; c++) {
      const col = Math.min(c * subsample, origSamples - 1);
      
      const idx = row * origSamples + col;
      const wx = calib.xOrigin + col * calib.xx + row * calib.xy;
      const wy = calib.yOrigin + col * calib.yx + row * calib.yy;
      const wz = data[idx];

      positions[vIdx++] = wx - cx;
      positions[vIdx++] = wz - cz;
      positions[vIdx++] = -(wy - cy);

      uvs[uIdx++] = calib.xx > 0 ? col / (origSamples - 1) : 1 - col / (origSamples - 1);
      uvs[uIdx++] = calib.yy > 0 ? row / (origLines - 1) : 1 - row / (origLines - 1);

      const colorVal = elevColor(normZ(wz, minZ, maxZ));
      colors[cIdx++] = colorVal.r; colors[cIdx++] = colorVal.g; colors[cIdx++] = colorVal.b;
    }
  }

  for (let row = 0; row < lines - 1; row++) {
    for (let col = 0; col < samples - 1; col++) {
      const i0 = row * samples + col, i1 = i0 + 1, i2 = i0 + samples, i3 = i2 + 1;
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
const TerrainMesh = React.memo(({ surface, showMesh, showMeshWire, showTexture, showNetwork, opacity, surfaceColor, onSurfaceClick, isMoving }: {
  surface: CaveSurface
  showMesh: boolean; showMeshWire: boolean; showTexture: boolean; showNetwork: boolean
  opacity: number
  surfaceColor: string
  onSurfaceClick?: (origX: number, origY: number, altitude: number, screenX: number, screenY: number) => void
  isMoving: boolean
}) => {
  const baseBase = useMemo(() => buildTerrainBaseData(surface, 1), [surface])
  const draftBase = useMemo(() => buildTerrainBaseData(surface, 20), [surface]) // 20x subsampling for huge models
  
  const solidGeoBase = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(baseBase.positions, 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(baseBase.uvs, 2))
    g.setIndex(baseBase.indices)
    g.computeVertexNormals()
    return g
  }, [baseBase])

  const solidGeoDraft = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(draftBase.positions, 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(draftBase.uvs, 2))
    g.setIndex(draftBase.indices)
    g.computeVertexNormals()
    return g
  }, [draftBase])

  const networkGeoBase = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(baseBase.positions, 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(baseBase.uvs, 2))
    g.setAttribute('color',    new THREE.BufferAttribute(baseBase.colors, 3))
    g.setIndex(baseBase.indices)
    g.computeVertexNormals()
    return g
  }, [baseBase])

  const networkGeoDraft = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(draftBase.positions, 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(draftBase.uvs, 2))
    g.setAttribute('color',    new THREE.BufferAttribute(draftBase.colors, 3))
    g.setIndex(draftBase.indices)
    g.computeVertexNormals()
    return g
  }, [draftBase])

  const texture = useMemo(() => {
    if (!surface.bitmapUrl) return null
    return new THREE.TextureLoader().load(surface.bitmapUrl)
  }, [surface])

  const hoverGeo = useMemo(() => new THREE.SphereGeometry(0.25, 8, 8), [])
  const hoverMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ef4444", depthTest: false }), [])

  const [hoveredSurf, setHoveredSurf] = useState<[number, number, number] | null>(null)

  if (!showMesh && !showMeshWire && !showTexture && !showNetwork) return null

  const solidGeo = isMoving ? solidGeoDraft : solidGeoBase
  const networkGeo = isMoving ? networkGeoDraft : networkGeoBase

  return (
    <group
      onClick={(e: any) => {
        if (onSurfaceClick && e.point) {
          e.stopPropagation()
          const { x, y, z } = e.point
          const origX = x + surface.centerOffset.x
          const origY = -z + surface.centerOffset.y
          const altitude = y + surface.centerOffset.z
          onSurfaceClick(origX, origY, altitude, e.nativeEvent.clientX, e.nativeEvent.clientY)
        }
      }}
      onPointerMove={(e: any) => {
        if (onSurfaceClick && e.point) {
          e.stopPropagation()
          setHoveredSurf([e.point.x, e.point.y, e.point.z])
        }
      }}
      onPointerOut={() => setHoveredSurf(null)}
    >
      {/* ── Tieňovaný solid (voliteľná farba) ── */}
      {showMesh && (
        <mesh geometry={solidGeo} renderOrder={0}>
          <meshStandardMaterial color={surfaceColor} side={THREE.DoubleSide} 
            transparent={opacity < 1} opacity={opacity}
            roughness={0.65} 
            metalness={0.25}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={4} polygonOffsetUnits={4} />
        </mesh>
      )}

      {/* ── Sieťový model — farebné výšky ── */}
      {showNetwork && (
        <mesh geometry={networkGeo} renderOrder={1}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.85}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={3} polygonOffsetUnits={3} />
        </mesh>
      )}

      {/* ── Textura overlay ── */}
      {showTexture && texture && (
        <mesh geometry={solidGeo} renderOrder={2}>
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity}
            roughness={0.85}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
        </mesh>
      )}

      {/* ── Drôtená sieť terénu — vždy navrch ── */}
      {showMeshWire && (
        <mesh geometry={solidGeo} renderOrder={9}>
          <meshBasicMaterial color="#6ab04c" wireframe depthWrite={false} transparent={true} opacity={0.45} />
        </mesh>
      )}

      {/* ── Hover Surface Point ── */}
      {hoveredSurf && onSurfaceClick && (
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

// ─── Dynamická mierka (Scale Bar) ───────────────────────────────────────────
function DynamicScaleBar() {
  const { camera, size } = useThree()
  const [scaleData, setScaleData] = useState({ label: '', width: 0 })

  useEffect(() => {
    let lastDist = -1
    const update = () => {
      // @ts-ignore
      const ctrl = camera.controls || (window as any)._orbitControls || (camera as any).controls
      const target = ctrl?.target || new THREE.Vector3(0, 0, 0)
      const dist = camera.position.distanceTo(target)
      
      if (Math.abs(dist - lastDist) < dist * 0.01) return
      lastDist = dist

      // @ts-ignore
      const currentFov = camera.fov || 55
      const fovRad = currentFov * Math.PI / 180
      const visibleHeight = 2 * Math.tan(fovRad / 2) * dist
      const pixelsPerUnit = size.height / visibleHeight
      
      const targetPx = 100
      const targetUnits = targetPx / pixelsPerUnit
      
      const niceUnits = [
        0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000
      ]
      let best = niceUnits[0]
      for (const u of niceUnits) {
        if (Math.abs(u - targetUnits) < Math.abs(best - targetUnits)) best = u
      }
      
      setScaleData({
        label: best < 1 ? `${best * 100} cm` : `${best} m`,
        width: best * pixelsPerUnit
      })
    }

    const timer = setInterval(update, 200)
    return () => clearInterval(timer)
  }, [camera, size])

  if (!scaleData.width) return null

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        bottom: 74,
        right: 135, // Presne vedľa Gizma vpravo dole
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: 'translateX(50%)',
        opacity: 0.8
      }}>
        <div style={{ 
          fontSize: 10, color: 'white', fontWeight: 700, marginBottom: 4, 
          textShadow: '0 1px 3px rgba(0,0,0,0.8)', fontFamily: 'Inter, sans-serif' 
        }}>
          {scaleData.label}
        </div>
        <div style={{ 
          width: scaleData.width, height: 5, 
          borderLeft: '2px solid white', borderRight: '2px solid white', borderBottom: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }} />
      </div>
    </Html>
  )
}
function AutoFit({ cave, trigger }: { cave: ParsedCave, trigger?: number }) {
  const { camera, controls } = useThree() as any
  useEffect(() => {
    const b    = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const dist = Math.max(diag * 0.5, 20)
    camera.position.set(dist * 0.6, dist * 0.5, dist * 0.6)
    camera.near = 0.1; camera.far = diag * 15
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
  manualConnection?: { p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number} } | null
  placedCaver?: { pos: [number, number, number], pose: 'standing' | 'crawling' } | null
  fitTrigger?: number
}

export default function CaveViewer3D({ cave, options: o, onStationClick, onSurfaceClick, onBackgroundClick, onMoveStateChange, manualConnection, placedCaver, fitTrigger }: Props) {
  const [isMoving, setIsMoving] = useState(false)
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

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
      camera={{ fov: 55, near: 0.1, far: Math.max(diag * 20, 10000) }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#050a18'))
        // Optimalizácia pre veľké modely – ak GPU nestíha
        gl.debug.checkShaderErrors = false 
      }}
      onPointerMissed={() => onBackgroundClick?.()}
      onPointerDown={() => setIsMoving(true)}
      onPointerMove={(e) => { if (e.buttons > 0) handleCameraChange() }}
      onWheel={() => handleCameraChange()}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[1, 3, 1]}    intensity={0.8} />
      <directionalLight position={[-2, 1, -2]} intensity={0.4} />
      <directionalLight position={[0, -2, 0]}   intensity={0.1} /> {/* Mierne svetlo odspodu kvôli čitateľnosti stien */}

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
          onSurfaceClick={onSurfaceClick}
          isMoving={isMoving}
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
        />
      )}

      {/* ── Cave traverse (3D rúrky) ── */}
      {o.showTraverse && cave.segments?.length > 0 && (
        <CaveTraverse cave={cave} radius={o.traverseRadius} showAltitude={o.traverseAltitude} isMoving={isMoving} />
      )}

      {/* ── Auto-fit pri zmene jaskyne alebo aktivácii triggera ── */}
      <AutoFit cave={cave} trigger={fitTrigger} />

      {/* ── Kompas / Gizmo v rohu ── */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#84cc16', '#3b82f6']} labelColor="white" labels={['V', 'H', 'J']} />
      </GizmoHelper>

      {/* ── Survey legs ── */}
      <CaveLegs cave={cave} showSplay={o.showSplay} showAltitude={o.traverseAltitude} />

      {/* ── Station dots & labels & clickable targets ── */}
      {o.showStations && <Stations cave={cave} />}
      <ClickableStations cave={cave} onStationClick={onStationClick} />
      <group visible={!isMoving}>
        {(o.showStationNames || o.showStationAlt) && (
          <StationLabels cave={cave} showNames={o.showStationNames} showAltitudes={o.showStationAlt} />
        )}
      </group>

      {/* ── Ground grid ── */}
      {manualConnection && <ManualConnection p1={manualConnection.p1} p2={manualConnection.p2} />}
      {o.placedCaver && <Character3D pos={o.placedCaver.pos} pose={o.placedCaver.pose} />}

      {o.showGrid && (
        <Grid
          args={[gridSize, gridSize]}
          cellSize={10} cellThickness={0.3} cellColor="#1a2744"
          sectionSize={50} sectionThickness={0.8} sectionColor="#1e3a6e"
          fadeDistance={diag * 2}
          position={[0, cave.bounds.min.z, 0]}
        />
      )}

      <OrbitControls
        makeDefault
        enableDamping={false}
        onStart={() => setIsMoving(true)}
        onChange={handleCameraChange}
        rotateSpeed={0.6} zoomSpeed={0.8} panSpeed={0.8}
        minDistance={1} maxDistance={Math.max(diag * 8, 10000)}
      />

      <DynamicScaleBar />
    </Canvas>
  )
}
