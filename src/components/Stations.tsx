import { useMemo } from 'react';
import * as THREE from 'three';
import { Station } from '../types';

interface StationsProps {
  stations: Station[];
  visible?: boolean;
}

export const Stations = ({ stations, visible = true }: StationsProps) => {
  const geometry = useMemo(() => {
    const positions = new Float32Array(stations.length * 3);
    stations.forEach((s, i) => {
      if (s) {
        positions[i * 3] = s.coords.x;
        positions[i * 3 + 1] = s.coords.y;
        positions[i * 3 + 2] = s.coords.z;
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [stations]);

  if (!visible) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial size={2} color="#ffffff" sizeAttenuation={false} />
    </points>
  );
};
