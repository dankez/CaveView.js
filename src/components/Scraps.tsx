import { useMemo } from 'react';
import * as THREE from 'three';
import { Scrap } from '../types';

interface ScrapsProps {
  scraps: Scrap[];
  visible?: boolean;
}

export const Scraps = ({ scraps, visible = true }: ScrapsProps) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    scraps.forEach(scrap => {
      scrap.vertices.forEach(v => {
        positions.push(v.x, v.y, v.z);
      });
      scrap.faces.forEach(f => {
        indices.push(f[0] + vertexOffset, f[1] + vertexOffset, f[2] + vertexOffset);
      });
      vertexOffset += scrap.vertices.length;
    });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [scraps]);

  if (!visible) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#888888" side={THREE.DoubleSide} />
    </mesh>
  );
};
