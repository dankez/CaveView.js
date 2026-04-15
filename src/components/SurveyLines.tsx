import { useMemo } from 'react';
import * as THREE from 'three';
import { Shot } from '../types';
import { LEG_CAVE, LEG_SPLAY, LEG_SURFACE } from '../core/constants';

interface SurveyLinesProps {
  shots: Shot[];
  showSplays?: boolean;
  showSurface?: boolean;
}

export const SurveyLines = ({ shots, showSplays = true, showSurface = true }: SurveyLinesProps) => {
  const { caveGeometry, splayGeometry, surfaceGeometry } = useMemo(() => {
    const cavePositions: number[] = [];
    const splayPositions: number[] = [];
    const surfacePositions: number[] = [];

    shots.forEach(shot => {
      const { from, to, type } = shot;
      if (!from || !to) return;

      const pushCoords = (arr: number[]) => {
        arr.push(from.coords.x, from.coords.y, from.coords.z);
        arr.push(to.coords.x, to.coords.y, to.coords.z);
      };

      if (type === LEG_CAVE) pushCoords(cavePositions);
      else if (type === LEG_SPLAY && showSplays) pushCoords(splayPositions);
      else if (type === LEG_SURFACE && showSurface) pushCoords(surfacePositions);
    });

    const createGeo = (pos: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return geo;
    };

    return {
      caveGeometry: createGeo(cavePositions),
      splayGeometry: createGeo(splayPositions),
      surfaceGeometry: createGeo(surfacePositions),
    };
  }, [shots, showSplays, showSurface]);

  return (
    <group>
      <lineSegments geometry={caveGeometry}>
        <lineBasicMaterial attach="material" color="#00ff00" linewidth={2} />
      </lineSegments>

      {showSplays && (
        <lineSegments geometry={splayGeometry}>
          <lineBasicMaterial attach="material" color="#555555" transparent opacity={0.5} />
        </lineSegments>
      )}

      {showSurface && (
        <lineSegments geometry={surfaceGeometry}>
          <lineBasicMaterial attach="material" color="#ffff00" transparent opacity={0.5} />
        </lineSegments>
      )}
    </group>
  );
};
