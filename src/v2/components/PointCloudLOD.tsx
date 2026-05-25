import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

const vertexShader = `
#include <clipping_planes_pars_vertex>

attribute vec3 color;
attribute float intensity;
attribute float relHeight; // NEW

varying vec3 vColor;
varying float vIntensity;
varying vec3 vNormal;
varying vec3 vModelNormal; // NEW (model space normála pre segmenter)
varying vec3 vViewPosition;
varying float vWorldZ;
varying float vRelHeight; // NEW

uniform float pointSize;

void main() {
    vColor = color;
    vIntensity = intensity;
    vRelHeight = relHeight; // NEW
    vWorldZ = position.y; // In v2, Y is altitude
    vModelNormal = normal; // NEW
    
    // Transform normal to view space (pre headlight lighting)
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
varying vec3 vModelNormal; // NEW (model space normála)
varying vec3 vViewPosition;
varying float vWorldZ;
varying float vRelHeight; // NEW

uniform float brightness;
uniform float plasticity;
uniform int colorMode; // 0: original, 1: elevation, 2: natural
uniform vec3 customColor;
uniform vec3 highlightColor;
uniform float minZ;
uniform float maxZ;

// Real-time GPU segmenter uniforms
uniform int uViewMode; // 0: All, 1: Floor, 2: Ceiling, 3: Contour Floor, 4: Heatmap Floor
uniform float uHeightThreshold; // threshold for relHeight (0.0 to 1.0)
uniform float uAngleThreshold;  // threshold for normal.y (0.0 to 1.0)

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
    // 0. Manual Clipping with Highlight Logic
    float minClipDist = 10000.0;
    bool hasClip = false;

    #if NUM_CLIPPING_PLANES > 0
    for ( int i = 0; i < NUM_CLIPPING_PLANES; i ++ ) {
        vec4 plane = clippingPlanes[ i ];
        // Standard Three.js distance calculation in view space
        float dist = dot(vViewPosition, plane.xyz) - plane.w;
        
        if ( dist > 0.0 ) discard; // Standard clipping discard
        
        minClipDist = min(minClipDist, abs(dist));
        hasClip = true;
    }
    #endif

    // ─── Speleo Segmenter: Autonómny Floor & Ceiling Discard ──────────────────
    // Zistíme, či LiDAR model má vypočítané normály. 
    bool hasNormals = (length(vModelNormal) > 0.1);
    vec3 mNormal = hasNormals ? normalize(vModelNormal) : vec3(0.0);

    // Podlaha: body ležiace v spodnej/strednej časti profilu jaskyne (pod uHeightThreshold)
    // ktoré majú smer sklonu nahor (mNormal.y > uAngleThreshold) pre zahojenie balvanov a stupňov.
    bool isFloor = (vRelHeight < uHeightThreshold) && (!hasNormals || mNormal.y > uAngleThreshold);
    
    // Strop: body ležiace v hornej/strednej časti profilu jaskyne (nad -uHeightThreshold)
    // ktoré majú smer sklonu nadol (mNormal.y < -uAngleThreshold) pre zachovanie najvrchnejšej klenby.
    bool isCeiling = (vRelHeight > -uHeightThreshold) && (!hasNormals || mNormal.y < -uAngleThreshold);

    if (uViewMode == 1) { // Floor only
        if (!isFloor) discard;
    } else if (uViewMode == 2) { // Ceiling only
        if (!isCeiling) discard;
    } else if (uViewMode == 3 || uViewMode == 4) { // Contour/Heatmap floor modes
        if (!isFloor) discard;
    }

    // 1. Base color selection
    vec3 baseColor;
    if (uViewMode == 4) {
        // Heatmap floor: height elevation coloring
        baseColor = getElevationColor(vWorldZ);
    } else if (uViewMode == 3) {
        // Contour floor: Draw elegant 1m contours on dark slate floor
        vec3 terrainColor = vec3(0.15, 0.20, 0.25); // Slate background
        
        float fractZ = fract(vWorldZ + 0.5) - 0.5;
        float distToContour = abs(fractZ);
        float contourWidth = 0.03; // sharp 3cm lines
        
        // Anti-aliased lines using smoothstep
        float contourIntensity = 1.0 - smoothstep(0.0, contourWidth, distToContour);
        
        // Highlight every 5th meter contour
        float isIndexContour = 1.0 - smoothstep(0.0, contourWidth * 1.5, abs(fract(vWorldZ / 5.0 + 0.5) - 0.5) * 5.0);
        
        vec3 mainContourCol = vec3(0.95, 0.75, 0.15); // Golden main contours
        vec3 subContourCol = vec3(0.65, 0.70, 0.75);  // Light silver sub-contours
        vec3 finalContourColor = mix(subContourCol, mainContourCol, isIndexContour);
        
        baseColor = mix(terrainColor, finalContourColor, contourIntensity);
    } else if (colorMode == 1) {
        baseColor = getElevationColor(vWorldZ);
    } else if (colorMode == 2) {
        baseColor = customColor; 
    } else {
        // Original mode: use vertex color with a safe fallback for pure white/black
        baseColor = vColor;
        if (length(vColor) < 0.05 || length(vColor) > 1.7) {
            baseColor = vec3(0.85);
        }
    }
    
    // 2. Lighting calculation (Headlight effect)
    vec3 lightDir = normalize(vec3(0.2, 0.2, 1.0));
    float dotNL = dot(vNormal, lightDir);
    float diffuse = (length(vNormal) > 0.01) ? max(dotNL, 0.0) : 0.6;
    
    // 3. Intensity influence
    float baseIntensityEffect = 0.4 + vIntensity * 0.6;
    float brightIntensity = mix(1.0, baseIntensityEffect, plasticity);
    
    // 4. Final Shading
    float ambient = 0.4;
    float light = (ambient + (diffuse * 0.6 * plasticity)) * brightness;
    
    vec3 finalColor = baseColor * light * brightIntensity;
    
    // 5. Gamma correction
    finalColor = pow(finalColor, vec3(0.8 / clamp(brightness, 0.5, 2.0)));

    // 6. Highlight for Clipping Edges
    if (hasClip && minClipDist < 0.15) {
        float highlightStrength = 1.0 - (minClipDist / 0.15);
        finalColor = mix(finalColor, highlightColor, highlightStrength * 0.9);
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface ChunkData {
  id: string;
  points: Float32Array;
  colors: Float32Array;
  normals: Float32Array;
  intensity: Float32Array;
  relHeight: Float32Array; // NEW
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
  highlightColor?: string;
  minZ?: number;
  maxZ?: number;
  clippingPlanes?: THREE.Plane[];
  viewMode?: 'all' | 'floor' | 'ceiling' | 'contour' | 'heatmap'; // NEW
  heightThreshold?: number; // NEW
  angleThreshold?: number;  // NEW
}> = ({ 
  url, 
  pointSize = 1.0, 
  brightness = 1.0, 
  plasticity = 1.0,
  colorMode = 'original',
  customColor = '#ffffff',
  highlightColor = '#ff4444',
  minZ = -100,
  maxZ = 100,
  clippingPlanes = [],
  viewMode = 'all', // NEW
  heightThreshold = 0.4, // NEW
  angleThreshold = 0.5, // NEW
}) => {
  const [chunks, setChunks] = useState<Map<string, { points: THREE.Points; bounds: THREE.Box3 }>>(new Map());
  const { camera } = useThree();
  const workerRef = useRef<Worker | null>(null);
  
  // Keep track of loaded chunks for reliable GPU cleanup on unmount
  const chunksRef = useRef<Map<string, { points: THREE.Points; bounds: THREE.Box3 }>>(new Map());

  // Reuse Frustum and Matrix4 instances to prevent Garbage Collection stuttering/FPS drops
  const frustumRef = useRef(new THREE.Frustum());
  const matrixRef = useRef(new THREE.Matrix4());

  const modeInt = colorMode === 'elevation' ? 1 : colorMode === 'natural' ? 2 : 0;
  const viewModeInt = viewMode === 'floor' ? 1 : viewMode === 'ceiling' ? 2 : viewMode === 'contour' ? 3 : viewMode === 'heatmap' ? 4 : 0; // NEW
  const threeColor = useMemo(() => new THREE.Color(customColor), [customColor]);
  const threeHighlightColor = useMemo(() => new THREE.Color(highlightColor), [highlightColor]);

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
        geometry.setAttribute('relHeight', new THREE.BufferAttribute(chunk.relHeight, 1)); // NEW
        geometry.computeBoundingSphere();

        const material = new THREE.ShaderMaterial({
          uniforms: {
            pointSize: { value: pointSize },
            brightness: { value: brightness },
            plasticity: { value: plasticity },
            colorMode: { value: modeInt },
            customColor: { value: threeColor },
            highlightColor: { value: threeHighlightColor },
            minZ: { value: minZ },
            maxZ: { value: maxZ },
            uViewMode: { value: viewModeInt }, // NEW
            uHeightThreshold: { value: heightThreshold }, // NEW
            uAngleThreshold: { value: angleThreshold }  // NEW
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

        const chunkObj = { points, bounds: box };
        chunksRef.current.set(chunk.id, chunkObj);

        setChunks(prev => {
          const next = new Map(prev);
          next.set(chunk.id, chunkObj);
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
      
      // CRITICAL: 100% reliable GPU VRAM resource cleanup to prevent memory leaks!
      chunksRef.current.forEach(chunk => {
        chunk.points.geometry.dispose();
        if (Array.isArray(chunk.points.material)) {
          chunk.points.material.forEach(m => m.dispose());
        } else {
          chunk.points.material.dispose();
        }
      });
      chunksRef.current.clear();
      setChunks(new Map());
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
        if (material.uniforms.highlightColor) material.uniforms.highlightColor.value = threeHighlightColor;
        if (material.uniforms.minZ) material.uniforms.minZ.value = minZ;
        if (material.uniforms.maxZ) material.uniforms.maxZ.value = maxZ;
        if (material.uniforms.uViewMode) material.uniforms.uViewMode.value = viewModeInt; // NEW
        if (material.uniforms.uHeightThreshold) material.uniforms.uHeightThreshold.value = heightThreshold; // NEW
        if (material.uniforms.uAngleThreshold) material.uniforms.uAngleThreshold.value = angleThreshold; // NEW
      }
      material.clippingPlanes = clippingPlanes;
      material.needsUpdate = true;
    });
  }, [pointSize, brightness, plasticity, colorMode, customColor, highlightColor, threeColor, threeHighlightColor, minZ, maxZ, clippingPlanes, chunks, viewMode, heightThreshold, angleThreshold]); // NEW dependencies

  useFrame(() => {
    const frustum = frustumRef.current;
    const matrix = matrixRef.current;
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
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
