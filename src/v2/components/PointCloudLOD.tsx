import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

const vertexShader = `
#include <clipping_planes_pars_vertex>

attribute vec3 color;
attribute float intensity;

varying vec3 vColor;
varying float vIntensity;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float pointSize;

void main() {
    vColor = color;
    vIntensity = intensity;
    
    // Transform normal to view space
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size attenuation
    gl_PointSize = pointSize * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 32.0);

    vViewPosition = - mvPosition.xyz;
    #include <clipping_planes_vertex>
}
`;

const fragmentShader = `
#include <clipping_planes_pars_fragment>

varying vec3 vColor;
varying float vIntensity;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float brightness;

void main() {
    #include <clipping_planes_fragment>

    // Square tiles
    
    // 1. Lighting calculation (Headlight effect)
    vec3 lightDir = normalize(vec3(0.2, 0.2, 1.0));
    float dotNL = dot(vNormal, lightDir);
    
    float diffuse = (length(vNormal) > 0.01) ? max(dotNL, 0.0) : 0.6;
    
    // 2. Intensity normalization
    float brightIntensity = 0.5 + vIntensity * 0.5;
    
    // 3. Final Shading with dynamic brightness control
    float ambient = 0.4 * brightness;
    float light = ambient + diffuse * 0.6 * brightness;
    
    vec3 baseColor = (length(vColor) < 0.1 || length(vColor) > 1.8) ? vec3(0.85) : vColor;
    
    vec3 finalColor = baseColor * light * brightIntensity;
    
    // 4. Gamma correction influenced by brightness
    finalColor = pow(finalColor, vec3(0.85 / clamp(brightness, 0.5, 2.0)));

    gl_FragColor = vec4(finalColor, 1.0);
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

export const PointCloudLOD: React.FC<{ 
  url: string; 
  pointSize?: number; 
  brightness?: number;
  clippingPlanes?: THREE.Plane[] 
}> = ({ url, pointSize = 1.0, brightness = 1.0, clippingPlanes = [] }) => {
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
        geometry.setAttribute('normal', new THREE.BufferAttribute(chunk.normals, 3));
        geometry.setAttribute('intensity', new THREE.BufferAttribute(chunk.intensity, 1));
        geometry.computeBoundingSphere();

        const material = new THREE.ShaderMaterial({
          uniforms: {
            pointSize: { value: pointSize },
            brightness: { value: brightness }
          },
          vertexShader,
          fragmentShader,
          transparent: false,
          depthWrite: true,
          depthTest: true,
          clipping: true,
          clippingPlanes: clippingPlanes,
          side: THREE.DoubleSide
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;

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
  }, [url]);

  useEffect(() => {
    chunks.forEach(chunk => {
      const material = chunk.points.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        if (material.uniforms.pointSize) material.uniforms.pointSize.value = pointSize;
        if (material.uniforms.brightness) material.uniforms.brightness.value = brightness;
      }
      material.clippingPlanes = clippingPlanes;
      material.needsUpdate = true;
    });
  }, [pointSize, brightness, clippingPlanes, chunks]);

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
      {Array.from(chunks.values()).map((chunk, idx) => (
        <primitive key={idx} object={chunk.points} />
      ))}
    </group>
  );
};
