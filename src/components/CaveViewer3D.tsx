import { useMemo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { ParsedCave, CaveSurface } from '../parsers/caveParser'

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
  // Cave traverse
  showTraverse:        boolean
  traverseRadius:      number
  // Terrain surface
  showSurfaceMesh:     boolean
  showSurfaceMeshWire: boolean
  showSurfaceTexture:  boolean
  showSurfaceNetwork:  boolean
  surfaceOpacity:      number
}

// ─── Clickable stations (neviditelné gule, raycasting) ───────────────────────
function ClickableStations({ cave, onStationClick }: {
  cave: ParsedCave
  onStationClick: (idx: number, screenX: number, screenY: number) => void
}) {
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.7, 6, 4), [])
  const mat       = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])

  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(sphereGeo, mat, cave.stations.length)
    const dummy = new THREE.Object3D()
    cave.stations.forEach((s, i) => {
      dummy.position.set(s.x, s.z, -s.y)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
    })
    im.instanceMatrix.needsUpdate = true
    return im
  }, [cave, sphereGeo, mat])

  return (
    <primitive
      object={mesh}
      onClick={(e: any) => {
        e.stopPropagation()
        if (e.instanceId !== undefined)
          onStationClick(e.instanceId, e.nativeEvent.clientX, e.nativeEvent.clientY)
      }}
    />
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

// ─── Cave survey legs ─────────────────────────────────────────────────────────
const CYL_UP = new THREE.Vector3(0, 1, 0)

function CaveLegs({ cave, showSplay }: { cave: ParsedCave; showSplay: boolean }) {
  const caveSegs    = useMemo(() => cave.segments.filter(s => s.type === 'cave'),    [cave])
  const splaySegs   = useMemo(() => cave.segments.filter(s => s.type === 'splay'),   [cave])
  const surfaceSegs = useMemo(() => cave.segments.filter(s => s.type === 'surface'), [cave])
  const caveGeo     = useMemo(() => segsToGeo(caveSegs),    [caveSegs])
  const splayGeo    = useMemo(() => segsToGeo(splaySegs),   [splaySegs])
  const surfaceGeo  = useMemo(() => segsToGeo(surfaceSegs), [surfaceSegs])

  return (
    <group>
      <lineSegments geometry={caveGeo}>
        <lineBasicMaterial color="#4fc3f7" linewidth={1.5} />
      </lineSegments>
      {showSplay && splaySegs.length > 0 && (
        <lineSegments geometry={splayGeo}>
          <lineBasicMaterial color="#78909c" transparent opacity={0.45} />
        </lineSegments>
      )}
      {surfaceSegs.length > 0 && (
        <lineSegments geometry={surfaceGeo}>
          <lineBasicMaterial color="#81c784" />
        </lineSegments>
      )}
    </group>
  )
}

// ─── Cave traverse — polygonový ťah (InstancedMesh rúrky s altitude farbami) ──
function CaveTraverse({ cave, radius }: { cave: ParsedCave; radius: number }) {
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

      const midZ = (seg.from.z + seg.to.z) / 2
      im.setColorAt(i, elevColor(normZ(midZ, mnZ, mxZ)))
    })

    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    return im
  }, [caveLegs, zRange, cylGeo, radius])

  return <primitive object={mesh} renderOrder={6} />
}

// ─── Station dots ─────────────────────────────────────────────────────────────
function Stations({ cave }: { cave: ParsedCave }) {
  const geo = useMemo(() => {
    const p: number[] = []
    for (const s of cave.stations) p.push(s.x, s.z, -s.y)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    return g
  }, [cave])
  return <points geometry={geo}><pointsMaterial color="#ffffff" size={0.5} sizeAttenuation /></points>
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
            {showNames && (
              <span style={{ fontSize: '9px', fontFamily: 'Inter, monospace', color: '#fbbf24', fontWeight: 600, textShadow: '0 0 3px #000,0 0 6px #000', lineHeight: 1.2 }}>
                {sl.name}
              </span>
            )}
            {showAltitudes && (
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

// ─── Cave scraps geometry builder ────────────────────────────────────────────
function buildScrapsGeo(cave: ParsedCave, withColors: boolean): THREE.BufferGeometry | null {
  if (!cave.scraps?.length) return null

  let minZ = Infinity, maxZ = -Infinity
  if (withColors)
    for (const sc of cave.scraps)
      for (const v of sc.vertices) {
        if (v.z < minZ) minZ = v.z
        if (v.z > maxZ) maxZ = v.z
      }

  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  let base = 0

  for (const sc of cave.scraps) {
    for (const v of sc.vertices) {
      positions.push(v.x, v.z, -v.y)
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
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (withColors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

// ─── Cave wall scraps — solid + wireframe + altitude (independent) ─────────────
function CaveScraps({ cave, opacity, showSolid, showWire, showAltitude }: {
  cave: ParsedCave; opacity: number
  showSolid: boolean; showWire: boolean; showAltitude: boolean
}) {
  // Solid geometry (no colors)
  const solidGeo = useMemo(() => buildScrapsGeo(cave, false), [cave])
  // Altitude geometry (with vertex colors)
  const altGeo   = useMemo(() => buildScrapsGeo(cave, true),  [cave])

  return (
    <>
      {/* ── Tieňovaný solid mesh ── */}
      {showSolid && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={2}>
          <meshStandardMaterial color="#2a5585" side={THREE.DoubleSide} transparent opacity={opacity}
            roughness={0.7} metalness={0.1}
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
      )}

      {/* ── Farebné podel výšky ── */}
      {showAltitude && altGeo && (
        <mesh geometry={altGeo} renderOrder={3}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={opacity}
            roughness={0.65} metalness={0.05}
            polygonOffset polygonOffsetFactor={0} polygonOffsetUnits={0} />
        </mesh>
      )}

      {/* ── Drôtený model — vždy navrch ── */}
      {showWire && solidGeo && (
        <mesh geometry={solidGeo} renderOrder={10}>
          <meshBasicMaterial color="#6a9fd8" wireframe depthWrite={false} transparent
            opacity={showSolid || showAltitude ? 0.28 : 0.65} />
        </mesh>
      )}
    </>
  )
}

// ─── Terrain geometry builder ────────────────────────────────────────────────
function buildTerrainGeo(surface: CaveSurface, withColors: boolean): THREE.BufferGeometry {
  const { dtm, centerOffset: { x: cx, y: cy, z: cz } } = surface
  const { data, samples, lines, calib } = dtm

  let minZ = Infinity, maxZ = -Infinity
  if (withColors) for (let i = 0; i < data.length; i++) {
    if (data[i] < minZ) minZ = data[i]
    if (data[i] > maxZ) maxZ = data[i]
  }

  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = []

  const det = calib.xx * calib.yy - calib.xy * calib.yx

  for (let row = 0; row < lines; row++) {
    for (let col = 0; col < samples; col++) {
      const wx = calib.xOrigin + col * calib.xx + row * calib.xy
      const wy = calib.yOrigin + col * calib.yx + row * calib.yy
      const wz = data[row * samples + col]
      positions.push(wx - cx, wz - cz, -(wy - cy))

      // WebGL textúry majú UV počiatok vľavo dole (0, 0).
      // Ak calib.xx > 0, col rastie na Východ, inak je potrebné presadiť U zľava doprava.
      // Ak calib.yy > 0, row rastie na Sever (čiže row 0 je Juh a ukladá sa na V=0 - spodok obrázka).
      const u = calib.xx > 0 ? col / (samples - 1) : 1 - col / (samples - 1)
      const v = calib.yy > 0 ? row / (lines - 1) : 1 - row / (lines - 1)
      uvs.push(u, v)

      if (withColors) {
        const c = elevColor(normZ(wz, minZ, maxZ))
        colors.push(c.r, c.g, c.b)
      }
    }
  }

  for (let row = 0; row < lines - 1; row++) {
    for (let col = 0; col < samples - 1; col++) {
      const i0 = row * samples + col, i1 = i0 + 1, i2 = i0 + samples, i3 = i2 + 1
      if (det > 0) {
        // Kladný determinant (typicky z Juhu na Sever): pre smer normály nahor volíme (i0, i1, i2)
        indices.push(i0, i1, i2, i2, i1, i3)
      } else {
        // Pre záporný determinant (čo by indikovalo zhora nadol) zachovávame druhú orientáciu
        indices.push(i0, i2, i1, i1, i2, i3)
      }
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2))
  if (withColors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

// ─── Terrain surface mesh (všetky módy) ──────────────────────────────────────
function TerrainMesh({ surface, showMesh, showMeshWire, showTexture, showNetwork, opacity }: {
  surface: CaveSurface
  showMesh: boolean; showMeshWire: boolean; showTexture: boolean; showNetwork: boolean
  opacity: number
}) {
  const solidGeo   = useMemo(() => buildTerrainGeo(surface, false), [surface])
  const networkGeo = useMemo(() => buildTerrainGeo(surface, true),  [surface])

  const texture = useMemo(() => {
    if (!surface.bitmapUrl) return null
    return new THREE.TextureLoader().load(surface.bitmapUrl)
  }, [surface])

  if (!showMesh && !showMeshWire && !showTexture && !showNetwork) return null

  return (
    <group>
      {/* ── Tieňovaný solid (zelený) ── */}
      {showMesh && (
        <mesh geometry={solidGeo} renderOrder={0}>
          <meshStandardMaterial color="#3a6030" side={THREE.DoubleSide} transparent opacity={opacity}
            roughness={0.9}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={4} polygonOffsetUnits={4} />
        </mesh>
      )}

      {/* ── Sieťový model — farebné výšky ── */}
      {showNetwork && (
        <mesh geometry={networkGeo} renderOrder={1}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={opacity}
            roughness={0.85}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={3} polygonOffsetUnits={3} />
        </mesh>
      )}

      {/* ── Textura overlay ── */}
      {showTexture && texture && (
        <mesh geometry={solidGeo} renderOrder={2}>
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} transparent opacity={opacity}
            roughness={0.85}
            depthWrite={false}
            polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
        </mesh>
      )}

      {/* ── Drôtená sieť terénu — vždy navrch ── */}
      {showMeshWire && (
        <mesh geometry={solidGeo} renderOrder={9}>
          <meshBasicMaterial color="#6ab04c" wireframe depthWrite={false} transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  )
}

// ─── Auto-fit camera ──────────────────────────────────────────────────────────
function AutoFit({ cave }: { cave: ParsedCave }) {
  const { camera } = useThree() as any
  useEffect(() => {
    const b    = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const dist = Math.max(diag * 0.5, 20)
    camera.position.set(dist * 0.6, dist * 0.5, dist * 0.6)
    camera.near = 0.1; camera.far = diag * 15
    camera.updateProjectionMatrix()
  }, [cave])
  return null
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────
interface Props {
  cave: ParsedCave
  options: ViewerOptions
  onStationClick: (idx: number, screenX: number, screenY: number) => void
}

export default function CaveViewer3D({ cave, options: o, onStationClick }: Props) {
  const diag     = Math.sqrt(cave.bounds.size.x ** 2 + cave.bounds.size.y ** 2 + cave.bounds.size.z ** 2)
  const gridSize = Math.max(diag * 1.5, 200)

  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: 55, near: 0.1, far: Math.max(diag * 20, 10000) }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#050a18'))}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[1, 2, 1]}    intensity={0.70} />
      <directionalLight position={[-1, -1, -1]} intensity={0.25} />

      {/* ── Terrain ── */}
      {(o.showSurfaceMesh || o.showSurfaceMeshWire || o.showSurfaceTexture || o.showSurfaceNetwork) && cave.surfaces?.map((surf, i) => (
        <TerrainMesh
          key={i} surface={surf}
          showMesh={o.showSurfaceMesh}
          showMeshWire={o.showSurfaceMeshWire}
          showTexture={o.showSurfaceTexture}
          showNetwork={o.showSurfaceNetwork}
          opacity={o.surfaceOpacity}
        />
      ))}

      {/* ── Cave scraps ── */}
      {o.showScraps && cave.scraps?.length > 0 && (
        <CaveScraps
          cave={cave} opacity={o.scrapsOpacity}
          showSolid={o.scrapsSolid}
          showWire={o.scrapsWireframe}
          showAltitude={o.scrapsAltitude}
        />
      )}

      {/* ── Cave traverse (3D rúrky) ── */}
      {o.showTraverse && cave.segments?.length > 0 && (
        <CaveTraverse cave={cave} radius={o.traverseRadius} />
      )}

      {/* ── Survey legs ── */}
      <CaveLegs cave={cave} showSplay={o.showSplay} />

      {/* ── Station dots & labels & clickable targets ── */}
      {o.showStations && <Stations cave={cave} />}
      <ClickableStations cave={cave} onStationClick={onStationClick} />
      {(o.showStationNames || o.showStationAlt) && (
        <StationLabels cave={cave} showNames={o.showStationNames} showAltitudes={o.showStationAlt} />
      )}

      {/* ── Ground grid ── */}
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
        makeDefault enableDamping dampingFactor={0.08}
        rotateSpeed={0.6} zoomSpeed={0.8} panSpeed={0.8}
        minDistance={1} maxDistance={Math.max(diag * 8, 10000)}
      />
      <AutoFit cave={cave} />
    </Canvas>
  )
}
