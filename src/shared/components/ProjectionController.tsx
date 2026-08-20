import React, { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { ParsedCave } from '@shared/types'

export interface ProjectionControllerProps {
  projection: 'perspective' | 'orthographic'
  cave: ParsedCave
  controlsRef?: React.RefObject<any>
}

/**
 * ProjectionController manages switching between PerspectiveCamera and OrthographicCamera
 * across both Engine v1 and Engine v2 (NextGen). It preserves camera position, target,
 * and handles view preset events ('cave-set-view' for Plan, Profile, Section, and Isometric).
 */
export function ProjectionController({ projection, cave, controlsRef }: ProjectionControllerProps) {
  const { camera, set, size, controls: contextControls } = useThree() as any
  const modeRef = useRef<'perspective' | 'orthographic'>(projection)

  // Switch between Perspective and Orthographic camera
  useEffect(() => {
    if (modeRef.current === projection) return
    modeRef.current = projection

    const currentControls = controlsRef?.current || contextControls
    const target = currentControls?.target
      ? currentControls.target.clone()
      : new THREE.Vector3(cave.bounds.center.x, cave.bounds.center.z, -cave.bounds.center.y)

    const currentPos = camera.position.clone()
    const dir = currentPos.clone().sub(target)
    const dist = Math.max(dir.length(), 1)

    const b = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const far = Math.max(diag * 30, 10000)

    if (projection === 'orthographic') {
      const halfFov = (55 * Math.PI) / 180 / 2
      const frustumHalf = dist * Math.tan(halfFov)
      const aspect = size.width / Math.max(size.height, 1)

      const ortho = new THREE.OrthographicCamera(
        -frustumHalf * aspect, frustumHalf * aspect,
        frustumHalf, -frustumHalf,
        0.01, far
      )
      ortho.position.copy(currentPos)
      ortho.up.copy(camera.up)
      ortho.lookAt(target)
      ortho.updateProjectionMatrix()
      set({ camera: ortho })

      if (currentControls) {
        currentControls.object = ortho
        if (currentControls.target) currentControls.target.copy(target)
        currentControls.update()
      }
    } else {
      const aspect = size.width / Math.max(size.height, 1)
      const persp = new THREE.PerspectiveCamera(55, aspect, 0.1, far)
      persp.position.copy(currentPos)
      persp.up.copy(camera.up)
      persp.lookAt(target)
      persp.updateProjectionMatrix()
      set({ camera: persp })

      if (currentControls) {
        currentControls.object = persp
        if (currentControls.target) currentControls.target.copy(target)
        currentControls.update()
      }
    }
  }, [projection, cave, set, size, contextControls, controlsRef])

  // Keep orthographic frustum in sync with window resize / distance changes
  useFrame(() => {
    if (projection !== 'orthographic') return
    if (!(camera instanceof THREE.OrthographicCamera)) return
    const currentControls = controlsRef?.current || contextControls
    const target = currentControls?.target ?? new THREE.Vector3()
    const dist = Math.max(camera.position.distanceTo(target), 1)
    const halfFov = (55 * Math.PI) / 180 / 2
    const frustumHalf = dist * Math.tan(halfFov)
    const aspect = size.width / Math.max(size.height, 1)
    camera.left = -frustumHalf * aspect
    camera.right = frustumHalf * aspect
    camera.top = frustumHalf
    camera.bottom = -frustumHalf
    camera.updateProjectionMatrix()
  })

  // Listen to standard view events (top/plan, front/profile, side/section, iso)
  useEffect(() => {
    const handleSetView = (e: any) => {
      const viewType = e?.detail?.view || 'iso'
      const currentControls = controlsRef?.current || contextControls
      const b = cave.bounds
      const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
      const target = currentControls?.target
        ? currentControls.target.clone()
        : new THREE.Vector3(b.center.x, b.center.z, -b.center.y)

      const dist = Math.max(diag * 1.8, 40)
      const endPos = new THREE.Vector3()
      const endUp = new THREE.Vector3(0, 1, 0)

      switch (viewType) {
        case 'top': // Pôdorys (Plan view from above, North = -Z -> screen UP)
          endPos.set(target.x, target.y + dist, target.z)
          endUp.set(0, 0, -1)
          break
        case 'front': // Pozdĺžny profil (South -> North)
          endPos.set(target.x, target.y, target.z + dist)
          endUp.set(0, 1, 0)
          break
        case 'side': // Priečny profil (West -> East)
          endPos.set(target.x - dist, target.y, target.z)
          endUp.set(0, 1, 0)
          break
        case 'iso': // 3D Axonometria / Izometria
        case 'reset':
        default:
          endPos.set(target.x + dist * 0.707, target.y + dist * 0.577, target.z + dist * 0.707)
          endUp.set(0, 1, 0)
          break
      }

      gsap.to(camera.position, {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: () => {
          camera.up.copy(endUp)
          camera.lookAt(target)
          if (currentControls) {
            currentControls.update()
          }
        },
        onComplete: () => {
          camera.up.copy(endUp)
          camera.lookAt(target)
          if (currentControls) {
            currentControls.update()
          }
        }
      })
    }

    window.addEventListener('cave-set-view', handleSetView)
    return () => window.removeEventListener('cave-set-view', handleSetView)
  }, [cave, camera, contextControls, controlsRef])

  return null
}
