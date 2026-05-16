import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const EDLShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    size: { value: new THREE.Vector2() },
    edlStrength: { value: 1.0 },
    radius: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 size;
    uniform float edlStrength;
    uniform float radius;
    varying vec2 vUv;

    float getDepth(vec2 uv) {
      return texture2D(tDepth, uv).r;
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float d = getDepth(vUv);
      
      if (d == 1.0) {
        gl_FragColor = color;
        return;
      }

      float res = 0.0;
      vec2 pixelSize = 1.0 / size;

      // Sample 8 neighbors
      res += max(0.0, d - getDepth(vUv + vec2(1, 0) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(-1, 0) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(0, 1) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(0, -1) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(1, 1) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(-1, -1) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(1, -1) * pixelSize * radius));
      res += max(0.0, d - getDepth(vUv + vec2(-1, 1) * pixelSize * radius));

      float shading = clamp(1.0 - res * edlStrength * 100.0, 0.0, 1.0);
      gl_FragColor = vec4(color.rgb * shading, color.a);
    }
  `
};

export const EDLPass: React.FC<{ strength?: number; radius?: number }> = ({ strength = 1.0, radius = 1.0 }) => {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height);
    renderTarget.depthTexture = new THREE.DepthTexture(size.width, size.height);
    
    const composer = new EffectComposer(gl, renderTarget);
    composer.addPass(new RenderPass(scene, camera));
    
    const edlPass = new ShaderPass(EDLShader);
    edlPass.uniforms.tDepth.value = renderTarget.depthTexture;
    edlPass.uniforms.size.value.set(size.width, size.height);
    edlPass.uniforms.edlStrength.value = strength;
    edlPass.uniforms.radius.value = radius;
    
    composer.addPass(edlPass);
    return composer;
  }, [gl, scene, camera, size.width, size.height]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};
