import React, { useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import ThreeGeo from 'three-geo';

interface MapboxTerrainProps {
  lat: number;
  lng: number;
  radius: number;
  zoom?: number;
  opacity?: number;
  visible?: boolean;
  mapboxToken: string;
  position?: [number, number, number];
}

const MapboxTerrain: React.FC<MapboxTerrainProps> = ({
  lat,
  lng,
  radius,
  zoom = 13,
  opacity = 1,
  visible = true,
  mapboxToken,
  position = [0, 0, 0]
}) => {
  const [terrainGroup, setTerrainGroup] = useState<THREE.Group | null>(null);

  const tgeo = useMemo(() => {
    return new ThreeGeo({
      token: mapboxToken,
    });
  }, [mapboxToken]);

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const center = [lat, lng];

    const loadTerrain = async () => {
      try {
        const group = await tgeo.getTerrainRgb(center, radius, zoom);
        if (isMounted) {
          // Adjust materials to be transparent if needed
          group.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              child.material.transparent = opacity < 1;
              child.material.opacity = opacity;
              // Ensure we use MeshStandardMaterial as requested
              if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                const oldMat = child.material;
                child.material = new THREE.MeshStandardMaterial({
                  map: oldMat.map,
                  transparent: opacity < 1,
                  opacity: opacity,
                });
              }
            }
          });
          
          setTerrainGroup(group);
        }
      } catch (err) {
        console.error('Failed to load Mapbox terrain:', err);
      }
    };

    loadTerrain();

    return () => {
      isMounted = false;
    };
  }, [lat, lng, radius, zoom, tgeo, visible]);

  useEffect(() => {
    if (terrainGroup) {
      terrainGroup.visible = visible;
      terrainGroup.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          child.material.transparent = opacity < 1;
          child.material.opacity = opacity;
        }
      });
    }
  }, [visible, opacity, terrainGroup]);

  if (!terrainGroup || !visible) return null;

  return <primitive object={terrainGroup} position={position} />;
};

export default MapboxTerrain;
