import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const SSAOShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    size: { value: new THREE.Vector2() },
    aoIntensity: { value: 1.5 },
    aoRadius: { value: 3.0 },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000.0 }
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
    uniform float aoIntensity;
    uniform float aoRadius;
    uniform float cameraNear;
    uniform float cameraFar;
    varying vec2 vUv;

    float readLinearDepth(vec2 uv) {
      float z_b = texture2D(tDepth, uv).r;
      float z_n = 2.0 * z_b - 1.0;
      return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z_n * (cameraFar - cameraNear));
    }

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);
      float depthRaw = texture2D(tDepth, vUv).r;
      
      // Skybox / background background bypass
      if (depthRaw >= 0.9999) {
        gl_FragColor = sceneColor;
        return;
      }

      float centerDepth = readLinearDepth(vUv);
      vec2 texel = 1.0 / size;
      float occlusion = 0.0;
      float samplesCount = 0.0;

      // Poisson-disk style sample pattern for organic cave crevices
      const int NUM_SAMPLES = 12;
      vec2 sampleKernel[12];
      sampleKernel[0] = vec2(0.5381, 0.1856);
      sampleKernel[1] = vec2(-0.4128, 0.4375);
      sampleKernel[2] = vec2(-0.3731, -0.5701);
      sampleKernel[3] = vec2(0.3128, -0.6713);
      sampleKernel[4] = vec2(0.6974, -0.2014);
      sampleKernel[5] = vec2(-0.6402, 0.1587);
      sampleKernel[6] = vec2(0.1284, 0.8124);
      sampleKernel[7] = vec2(-0.1548, -0.8412);
      sampleKernel[8] = vec2(0.8542, 0.4125);
      sampleKernel[9] = vec2(-0.8124, -0.3741);
      sampleKernel[10] = vec2(0.4125, 0.7412);
      sampleKernel[11] = vec2(-0.7412, 0.5412);

      float radiusScale = clamp(aoRadius * 12.0 / max(centerDepth, 1.0), 1.0, 16.0);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        vec2 sampleUv = vUv + sampleKernel[i] * texel * radiusScale;
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

        float sampleDepth = readLinearDepth(sampleUv);
        float diff = centerDepth - sampleDepth;

        // Crevice occlusion weight
        if (diff > 0.01 && diff < 5.0) {
          occlusion += 1.0 - smoothstep(0.0, 3.5, diff);
        }
        samplesCount += 1.0;
      }

      float aoFactor = 1.0 - (occlusion / max(samplesCount, 1.0)) * aoIntensity;
      aoFactor = clamp(aoFactor, 0.15, 1.0);

      gl_FragColor = vec4(sceneColor.rgb * aoFactor, sceneColor.a);
    }
  `
};

export const SSAOPass: React.FC<{ intensity?: number; radius?: number }> = ({ 
  intensity = 1.5, 
  radius = 3.0 
}) => {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height);
    renderTarget.depthTexture = new THREE.DepthTexture(size.width, size.height);
    
    const comp = new EffectComposer(gl, renderTarget);
    comp.addPass(new RenderPass(scene, camera));
    
    const ssaoPass = new ShaderPass(SSAOShader);
    ssaoPass.uniforms.tDepth.value = renderTarget.depthTexture;
    ssaoPass.uniforms.size.value.set(size.width, size.height);
    ssaoPass.uniforms.aoIntensity.value = intensity;
    ssaoPass.uniforms.aoRadius.value = radius;
    // @ts-ignore
    ssaoPass.uniforms.cameraNear.value = camera.near;
    // @ts-ignore
    ssaoPass.uniforms.cameraFar.value = camera.far;
    
    comp.addPass(ssaoPass);
    return comp;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    const ssaoPass = composer.passes[1] as ShaderPass;
    if (ssaoPass && ssaoPass.uniforms && ssaoPass.uniforms.size) {
      ssaoPass.uniforms.size.value.set(size.width, size.height);
      // @ts-ignore
      ssaoPass.uniforms.cameraNear.value = camera.near;
      // @ts-ignore
      ssaoPass.uniforms.cameraFar.value = camera.far;
    }
  }, [composer, size.width, size.height, camera]);

  useEffect(() => {
    const ssaoPass = composer.passes[1] as ShaderPass;
    if (ssaoPass && ssaoPass.uniforms) {
      ssaoPass.uniforms.aoIntensity.value = intensity;
      ssaoPass.uniforms.aoRadius.value = radius;
    }
  }, [composer, intensity, radius]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};
