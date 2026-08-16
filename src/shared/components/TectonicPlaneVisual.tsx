import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { calculateTectonics, TectonicPoint } from '../utils/tectonics';
import { Vec3 } from '../types';

export interface TectonicPlaneVisualProps {
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
  lang?: string;
}

export const TectonicPlaneVisual: React.FC<TectonicPlaneVisualProps> = React.memo(({
  p1,
  p2,
  p3,
  lang = 'sk',
}) => {
  // Convert local/Three.js coordinates {x, y, z}
  // Remember: p.x = Easting_rel, p.y = Northing_rel, p.z = Altitude_rel
  // Three.js coordinates: (p.x, p.z, -p.y)
  const analysis = useMemo(() => {
    if (!p1 || !p2 || !p3) return null;
    const pt1: TectonicPoint = { x: p1.x, y: p1.y, z: p1.z };
    const pt2: TectonicPoint = { x: p2.x, y: p2.y, z: p2.z };
    const pt3: TectonicPoint = { x: p3.x, y: p3.y, z: p3.z };
    return calculateTectonics(pt1, pt2, pt3, lang);
  }, [p1, p2, p3, lang]);

  const v1 = useMemo(() => new THREE.Vector3(p1.x, p1.z, -p1.y), [p1]);
  const v2 = useMemo(() => new THREE.Vector3(p2.x, p2.z, -p2.y), [p2]);
  const v3 = useMemo(() => new THREE.Vector3(p3.x, p3.z, -p3.y), [p3]);

  // Centroid in Three.js coordinates
  const centroid = useMemo(() => {
    return new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);
  }, [v1, v2, v3]);

  // Scale of visual helpers based on triangle dimensions
  const scale = useMemo(() => {
    if (!analysis) return 2.0;
    const maxSide = Math.max(...analysis.sideLengths);
    return Math.max(1.0, Math.min(maxSide * 0.6, 15.0));
  }, [analysis]);

  // Three.js geometry for the filled plane
  const planeGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [v1, v2, v3]);

  // Triangle outline points
  const outlinePoints = useMemo(() => [
    v1, v2, v3, v1
  ], [v1, v2, v3]);

  // Normal vector in Three.js: (nx, nz, -ny)
  const normalEnd = useMemo(() => {
    if (!analysis || analysis.isCollinear) return null;
    const [nx, ny, nz] = analysis.normal;
    const dir = new THREE.Vector3(nx, nz, -ny).normalize().multiplyScalar(scale * 0.9);
    return centroid.clone().add(dir);
  }, [analysis, centroid, scale]);

  // Spádnica (Dip vector in plane pointing down) in Three.js: (dx, dz, -dy)
  const dipEnd = useMemo(() => {
    if (!analysis || analysis.isCollinear || analysis.dipAngle < 0.1) return null;
    const [dx, dy, dz] = analysis.dipVector;
    const dir = new THREE.Vector3(dx, dz, -dy).normalize().multiplyScalar(scale);
    return centroid.clone().add(dir);
  }, [analysis, centroid, scale]);

  // Horizontal projection of dip vector (Kolmica na priesečník v H-rovine) in Three.js: (hx, 0, -hy)
  const horizDipEnd = useMemo(() => {
    if (!analysis || analysis.isCollinear || analysis.dipAngle < 0.1) return null;
    const [hx, hy] = analysis.horizontalDipVector;
    const dir = new THREE.Vector3(hx, 0, -hy).normalize().multiplyScalar(scale);
    return centroid.clone().add(dir);
  }, [analysis, centroid, scale]);

  // Strike line (Priesečník s H-rovinou) through centroid: along (sx, 0, -sy)
  const strikePoints = useMemo(() => {
    if (!analysis || analysis.isCollinear || analysis.dipAngle < 0.1) return null;
    const [sx, sy] = analysis.strikeVector;
    const dir = new THREE.Vector3(sx, 0, -sy).normalize().multiplyScalar(scale * 1.1);
    const start = centroid.clone().sub(dir);
    const end = centroid.clone().add(dir);
    return [start, end];
  }, [analysis, centroid, scale]);

  if (!analysis) return null;

  return (
    <group>
      {/* 1. Vyplnený semi-transparentný polygón roviny */}
      <mesh geometry={planeGeometry}>
        <meshStandardMaterial
          color="#a855f7"
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Obrys trojuholníka (Wireframe outline) */}
      <Line
        points={outlinePoints}
        color="#c084fc"
        lineWidth={2.5}
      />

      {/* 3. Vrcholové body P1, P2, P3 */}
      {[
        { pt: v1, label: '1', name: 'P1' },
        { pt: v2, label: '2', name: 'P2' },
        { pt: v3, label: '3', name: 'P3' }
      ].map((item, i) => (
        <group key={i} position={item.pt}>
          <mesh>
            <sphereGeometry args={[Math.max(0.12, scale * 0.05), 16, 16]} />
            <meshBasicMaterial color="#e879f9" />
          </mesh>
          <Html position={[0, Math.max(0.2, scale * 0.08), 0]} center>
            <div style={{
              background: 'rgba(168, 85, 247, 0.85)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '11px',
              padding: '1px 5px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {item.name}
            </div>
          </Html>
        </group>
      ))}

      {/* 4. Normála na plochu (Červená/Ružová šípka) */}
      {normalEnd && (
        <group>
          <Line
            points={[centroid, normalEnd]}
            color="#f43f5e"
            lineWidth={3.5}
          />
          {/* Špička normály */}
          <mesh position={normalEnd}>
            <sphereGeometry args={[Math.max(0.1, scale * 0.04), 12, 12]} />
            <meshBasicMaterial color="#f43f5e" />
          </mesh>
          <Html position={[normalEnd.x, normalEnd.y + 0.15, normalEnd.z]} center>
            <div style={{
              background: 'rgba(244, 63, 94, 0.9)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '10px',
              padding: '1px 4px',
              borderRadius: '3px',
              pointerEvents: 'none',
            }}>
              N ({analysis.normal[0].toFixed(2)}, {analysis.normal[1].toFixed(2)}, {analysis.normal[2].toFixed(2)})
            </div>
          </Html>
        </group>
      )}

      {/* 5. Priesečník s horizontálnou rovinou (Žltá čiara) */}
      {strikePoints && (
        <group>
          <Line
            points={strikePoints}
            color="#fbbf24"
            lineWidth={2}
            dashed
            dashScale={2}
            dashSize={0.5}
            gapSize={0.25}
          />
        </group>
      )}

      {/* 6. Spádnica v rovine (Modrá/Fialová čiara nadol) */}
      {dipEnd && (
        <group>
          <Line
            points={[centroid, dipEnd]}
            color="#3b82f6"
            lineWidth={3.5}
          />
          <mesh position={dipEnd}>
            <sphereGeometry args={[Math.max(0.1, scale * 0.04), 12, 12]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        </group>
      )}

      {/* 7. Horizontálna kolmica na priesečník (Zelená čiara smeru spádnice) */}
      {horizDipEnd && (
        <group>
          <Line
            points={[centroid, horizDipEnd]}
            color="#22c55e"
            lineWidth={3}
          />
          <mesh position={horizDipEnd}>
            <sphereGeometry args={[Math.max(0.08, scale * 0.035), 12, 12]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      )}

      {/* 8. 3D Floating HUD info na ťažisku */}
      <Html position={[centroid.x, centroid.y + Math.max(0.3, scale * 0.1), centroid.z]} center>
        <div style={{
          background: 'linear-gradient(135deg, rgba(24, 16, 47, 0.95), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(192, 132, 252, 0.6)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.6), 0 0 12px rgba(168,85,247,0.3)',
          borderRadius: '8px',
          padding: '6px 10px',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '11px',
          lineHeight: '1.3',
          minWidth: '130px',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', fontWeight: 800, color: '#c084fc' }}>
            <span>🧭</span>
            <span>{analysis.notation}</span>
            <span style={{ fontSize: '9px', background: '#9333ea', padding: '1px 4px', borderRadius: '3px' }}>
              {analysis.cardinalDirection}
            </span>
          </div>
          <div style={{ color: '#93c5fd', fontSize: '10px' }}>
            {lang === 'sk' ? 'Sklon' : 'Dip'}: <strong>{analysis.dipAngle.toFixed(1)}°</strong>
          </div>
          <div style={{ color: '#86efac', fontSize: '10px' }}>
            {lang === 'sk' ? 'Azimut' : 'Dip Dir'}: <strong>{analysis.dipDirection.toFixed(1)}°</strong>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '9px', marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2px' }}>
            {lang === 'sk' ? 'Plocha' : 'Area'}: {analysis.area.toFixed(2)} m²
          </div>
        </div>
      </Html>
    </group>
  );
});
