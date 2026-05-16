import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

const vertexShader = `
attribute vec3 color;
attribute float intensity;

varying vec3 vColor;
varying float vIntensity;

uniform float pointSize;

void main() {
    vColor = color;
    vIntensity = intensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation
    gl_PointSize = pointSize * (1000.0 / -mvPosition.z);
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vIntensity;

void main() {
    vec2 pc = gl_PointCoord - 0.5;
    if (dot(pc, pc) > 0.25) discard; // Circular points

    gl_FragColor = vec4(vColor * vIntensity, 1.0);
}
`;

interface ChunkData {
  id: string;
  points: Float32Array;
  colors: Float32Array;
  normals: Float32Array;
  intensity: Float32Array;
  vertexCount: number;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

export const PointCloudLOD: React.FC<{ url: string; pointSize?: number }> = ({ url, pointSize = 1.0 }) => {
  const [chunks, setChunks] = useState<Map<string, { points: THREE.Points; bounds: THREE.Box3 }>>(new Map());
  const { camera } = useThree();
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../parsers/pointcloud.worker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'POINTCLOUD_CHUNK') {
        const chunk = data as ChunkData;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(chunk.points, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(chunk.colors, 3));
        geometry.setAttribute('intensity', new THREE.BufferAttribute(chunk.intensity, 1));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            pointSize: { value: pointSize }
          },
          vertexShader,
          fragmentShader,
          vertexColors: true,
          transparent: true,
          depthWrite: true,
          depthTest: true
        });

        const points = new THREE.Points(geometry, material);
        const box = new THREE.Box3(
          new THREE.Vector3(chunk.bounds.min.x, chunk.bounds.min.y, chunk.bounds.min.z),
          new THREE.Vector3(chunk.bounds.max.x, chunk.bounds.max.y, chunk.bounds.max.z)
        );

        setChunks(prev => {
          const next = new Map(prev);
          next.set(chunk.id, { points, bounds: box });
          return next;
        });
      }
    };

    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        worker.postMessage({ buffer }, [buffer]);
      })
      .catch(err => console.error('Failed to fetch pointcloud:', err));

    return () => {
      worker.terminate();
    };
  }, [url, pointSize]);

  useFrame(() => {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);

    chunks.forEach(chunk => {
      chunk.points.visible = frustum.intersectsBox(chunk.bounds);
    });
  });

  return (
    <group>
      {Array.from(chunks.values()).map((chunk) => (
        <primitive key={chunk.points.uuid} object={chunk.points} />
      ))}
    </group>
  );
};
