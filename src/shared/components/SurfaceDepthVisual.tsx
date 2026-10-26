import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Line, Html } from '@react-three/drei'
import type { SelStation } from '../../App'

export interface SurfaceDepthVisualProps {
  station: SelStation
  lang?: string
}

export const SurfaceDepthVisual: React.FC<SurfaceDepthVisualProps> = React.memo(({ station, lang = 'sk' }) => {
  const { distToSurf, surfaceZ, pos } = station

  if (distToSurf === null || distToSurf === undefined || !Number.isFinite(distToSurf) || !pos) {
    return null
  }

  const p1 = useMemo(() => new THREE.Vector3(pos.x, pos.z, -pos.y), [pos])
  const p2 = useMemo(() => new THREE.Vector3(pos.x, pos.z + distToSurf, -pos.y), [pos, distToSurf])
  const mid = useMemo(() => new THREE.Vector3(pos.x, pos.z + distToSurf / 2, -pos.y), [pos, distToSurf])

  const isBelow = distToSurf >= 0
  const depthText = `${Math.abs(distToSurf).toFixed(1)} m`
  const subText = isBelow
    ? (lang === 'sk' ? 'pod povrchom' : lang === 'de' ? 'unter Oberfläche' : lang === 'fr' ? 'sous surface' : 'below surface')
    : (lang === 'sk' ? 'nad povrchom' : lang === 'de' ? 'über Oberfläche' : lang === 'fr' ? 'sur surface' : 'above surface')

  return (
    <group>
      {/* ── Zvislá čiarkovaná čiara od bodu jaskyne k povrchu ── */}
      <Line
        points={[p1, p2]}
        color="#38bdf8"
        lineWidth={2.5}
        dashed={true}
        dashScale={1}
        dashSize={0.8}
        gapSize={0.4}
        depthTest={false}
        transparent
        opacity={0.9}
        renderOrder={150}
      />

      {/* ── Zvýraznenie stanice v jaskyni ── */}
      <mesh position={p1} renderOrder={160}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#38bdf8" depthTest={false} />
      </mesh>

      {/* ── Terč na povrchu terénu ── */}
      <group position={p2} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh renderOrder={160}>
          <ringGeometry args={[0.35, 0.75, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.85} depthTest={false} />
        </mesh>
        <mesh renderOrder={160}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} transparent opacity={0.95} depthTest={false} />
        </mesh>
      </group>

      {/* ── Kóta s hĺbkou na polceste ── */}
      <Html position={mid} center distanceFactor={14}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(56, 189, 248, 0.6)',
          borderRadius: '6px',
          padding: '3px 7px',
          color: '#f8fafc',
          fontSize: '11px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
          textAlign: 'center',
          userSelect: 'none'
        }}>
          <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '12px' }}>
            {isBelow ? '▼' : '▲'} {depthText}
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {subText}
          </div>
        </div>
      </Html>

      {/* ── Štítok na povrchu s nadmorskou výškou ── */}
      {surfaceZ !== null && surfaceZ !== undefined && (
        <Html position={[p2.x, p2.y + 0.4, p2.z]} center distanceFactor={14}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '4px',
            padding: '2px 6px',
            color: '#94a3b8',
            fontSize: '10px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            {lang === 'sk' ? 'Povrch' : 'Surface'}: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{surfaceZ.toFixed(1)} m n.m.</span>
          </div>
        </Html>
      )}
    </group>
  )
})
