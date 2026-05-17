import React, { useState, useEffect, useRef, useMemo } from 'react';
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
varying float vWorldZ;

uniform float pointSize;

void main() {
    vColor = color;
    vIntensity = intensity;
    vWorldZ = position.y; // In v2, Y is altitude
    
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
varying float vWorldZ;

uniform float brightness;
uniform float plasticity;
uniform int colorMode; // 0: original, 1: elevation, 2: natural
uniform vec3 customColor;
uniform float minZ;
uniform float maxZ;

vec3 getElevationColor(float z) {
    float t = clamp((z - minZ) / (maxZ - minZ), 0.0, 1.0);
    
    // Gradient stops (Blue -> Cyan -> Green -> Yellow -> Red)
    vec3 c0 = vec3(0.08, 0.18, 0.65);
    vec3 c1 = vec3(0.10, 0.48, 0.85);
    vec3 c2 = vec3(0.12, 0.78, 0.72);
    vec3 c3 = vec3(0.18, 0.87, 0.38);
    vec3 c4 = vec3(0.80, 0.94, 0.10);
    vec3 c5 = vec3(0.97, 0.60, 0.05);
    vec3 c6 = vec3(0.88, 0.10, 0.10);
    
    if (t < 0.18) return mix(c0, c1, t / 0.18);
    if (t < 0.35) return mix(c1, c2, (t - 0.18) / (0.35 - 0.18));
    if (t < 0.50) return mix(c2, c3, (t - 0.35) / (0.50 - 0.35));
    if (t < 0.65) return mix(c3, c4, (t - 0.50) / (0.65 - 0.50));
    if (t < 0.80) return mix(c4, c5, (t - 0.65) / (0.80 - 0.65));
    return mix(c5, c6, (t - 0.80) / (1.0 - 0.80));
}

void main() {
    #include <clipping_planes_fragment>

    // 1. Base color selection
    vec3 baseColor;
    if (colorMode == 1) {
        baseColor = getElevationColor(vWorldZ);
    } else if (colorMode == 2) {
        // Use user-selected custom color - EXACT SAME LOGIC AS ORIGINAL
        baseColor = customColor; 
    } else {
        // Original mode: use vertex color with a safe fallback for pure white/black
        baseColor = vColor;
        if (length(vColor) < 0.05 || length(vColor) > 1.7) {
            baseColor = vec3(0.85);
        }
    }
    
    // 2. Lighting calculation (Headlight effect) - THE PERFECT ORIGINAL FORMULA
    vec3 lightDir = normalize(vec3(0.2, 0.2, 1.0));
    float dotNL = dot(vNormal, lightDir);
    float diffuse = (length(vNormal) > 0.01) ? max(dotNL, 0.0) : 0.6;
    
    // 3. Intensity influence - THE PERFECT ORIGINAL FORMULA
    // Base intensity effect (0.4 floor, 0.6 scale)
    float baseIntensityEffect = 0.4 + vIntensity * 0.6;
    // Plasticity only scales the contrast of this effect
    float brightIntensity = mix(1.0, baseIntensityEffect, plasticity);
    
    // 4. Final Shading
    // Reverting to the high-contrast 0.4/0.6 split
    float ambient = 0.4;
    float light = (ambient + (diffuse * 0.6 * plasticity)) * brightness;
    
    vec3 finalColor = baseColor * light * brightIntensity;
    
    // 5. Gamma correction (The perfect 0.8)
    finalColor = pow(finalColor, vec3(0.8 / clamp(brightness, 0.5, 2.0)));

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
  plasticity?: number;
  colorMode?: 'original' | 'elevation' | 'natural';
  customColor?: string;
  minZ?: number;
  maxZ?: number;
  clippingPlanes?: THREE.Plane[] 
}> = ({ 
  url, 
  pointSize = 1.0, 
  brightness = 1.0, 
  plasticity = 1.0,
  colorMode = 'original',
  customColor = '#ffffff',
  minZ = -100,
  maxZ = 100,
  clippingPlanes = [] 
}) => {
  const [chunks, setChunks] = useState<Map<string, { points: THREE.Points; bounds: THREE.Box3 }>>(new Map());
  const { camera } = useThree();
  const workerRef = useRef<Worker | null>(null);

  const modeInt = colorMode === 'elevation' ? 1 : colorMode === 'natural' ? 2 : 0;
  const threeColor = useMemo(() => new THREE.Color(customColor), [customColor]);

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
            brightness: { value: brightness },
            plasticity: { value: plasticity },
            colorMode: { value: modeInt },
            customColor: { value: threeColor },
            minZ: { value: minZ },
            maxZ: { value: maxZ }
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
        if (material.uniforms.plasticity) material.uniforms.plasticity.value = plasticity;
        if (material.uniforms.colorMode) material.uniforms.colorMode.value = modeInt;
        if (material.uniforms.customColor) material.uniforms.customColor.value = threeColor;
        if (material.uniforms.minZ) material.uniforms.minZ.value = minZ;
        if (material.uniforms.maxZ) material.uniforms.maxZ.value = maxZ;
      }
      material.clippingPlanes = clippingPlanes;
      material.needsUpdate = true;
    });
  }, [pointSize, brightness, plasticity, colorMode, customColor, threeColor, minZ, maxZ, clippingPlanes, chunks]);

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
