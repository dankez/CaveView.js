import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { PointCloudLOD } from './PointCloudLOD'
import type { ParsedCave } from '@v1/parsers/caveParser'
import type { ViewerOptions } from '@v1/components/CaveViewer3D'
import type { SelStation } from '../../App'

interface Props {
  cave: ParsedCave
  options: ViewerOptions
  onStationClick: (idx: number, screenX: number, screenY: number, ctrlKey: boolean) => void
  onCameraUpdate?: (data: { dist: number, fov: number, height: number }) => void
  onStatusChange?: (status: { msg: string; type: 'info' | 'error' | 'success' | 'progress'; progress?: number } | null) => void
  fitTrigger?: number
  selectedStations?: SelStation[]
  activeProfilePoints?: SelStation[] | null
  isMeasuringMode: boolean
}

const SceneBackground = ({ texture, color }: { texture: THREE.Texture | null, color: string }) => {
  const { scene } = useThree()
  useEffect(() => {
    if (texture) scene.background = texture
    else scene.background = new THREE.Color(color)
  }, [scene, texture, color])
  return null
}

const AutoFit = ({ cave, trigger }: { cave: ParsedCave, trigger?: number }) => {
  const { camera, controls } = useThree() as any
  useEffect(() => {
    const b = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const dist = Math.max(diag * 2.0, 50)
    const targetX = b.center.x;
    const targetY = b.center.z;
    const targetZ = -b.center.y;
    
    camera.position.set(targetX + dist, targetY + dist * 0.8, targetZ + dist)
    camera.near = 0.1; camera.far = Math.max(diag * 25, 5000)
    camera.updateProjectionMatrix()
    if (controls && controls.target) {
      controls.target.set(targetX, targetY, targetZ)
      controls.update()
    }
  }, [cave, trigger, camera, controls])
  return null
}

const CaveViewerNextGen = ({ 
  cave, options: o, onStationClick, onCameraUpdate, onStatusChange, fitTrigger, 
  selectedStations, activeProfilePoints, isMeasuringMode 
}: Props) => {
  const [isMoving, setIsModelMoving] = useState(false)
  const handleCameraChange = useCallback(() => {
    if (!isMoving) setIsModelMoving(true)
  }, [isMoving])

  const diag = Math.sqrt(cave.bounds.size.x ** 2 + cave.bounds.size.y ** 2 + cave.bounds.size.z ** 2)

  // Calculate GPS center for Mapbox Terrain
  const gpsCenter = useMemo(() => {
    const labelsWithGps = cave.stationLabels.filter(l => l.gps && l.gps.lat && l.gps.lon);
    if (labelsWithGps.length > 0) {
      const avgLat = labelsWithGps.reduce((sum, l) => sum + l.gps!.lat, 0) / labelsWithGps.length;
      const avgLon = labelsWithGps.reduce((sum, l) => sum + l.gps!.lon, 0) / labelsWithGps.length;
      return { lat: avgLat, lng: avgLon };
    }
    return null;
  }, [cave.stationLabels]);

  const bgTexture = useMemo(() => {
    if (!o.colorBackground2) return null
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const grad = ctx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, o.colorBackground)
    grad.addColorStop(1, o.colorBackground2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 2, 512)
    return new THREE.CanvasTexture(canvas)
  }, [o.colorBackground, o.colorBackground2])

  const compositeClippingPlanes = useMemo(() => {
    const planes: THREE.Plane[] = []
    if (o.showClipping) {
      planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), o.clippingHeight - cave.centerOffset.z))
    }
    if (o.showProfileClipping && activeProfilePoints && activeProfilePoints.length === 2) {
      const s1 = activeProfilePoints[0]
      const s2 = activeProfilePoints[1]
      const p1 = new THREE.Vector3(s1.origX - (s1.centerX||0), 0, -(s1.origY - (s1.centerY||0)))
      const p2 = new THREE.Vector3(s2.origX - (s1.centerX||0), 0, -(s2.origY - (s1.centerY||0)))
      const v = new THREE.Vector3().subVectors(p2, p1).normalize()
      if (v.lengthSq() > 0.0001) {
        let normal = new THREE.Vector3(-v.z, 0, v.x)
        if (o.profileClipFlip) normal.multiplyScalar(-1)
        planes.push(new THREE.Plane(normal, -normal.dot(p1) - o.profileClipOffset))
      }
    }
    return planes
  }, [o.showClipping, o.clippingHeight, o.showProfileClipping, o.profileClipFlip, o.profileClipOffset, activeProfilePoints, cave.centerOffset.z])

  return (
    <Canvas
      id="nextgen-cave-canvas"
      gl={{ 
        antialias: true, 
        alpha: false, 
        preserveDrawingBuffer: true, 
        powerPreference: 'high-performance',
        localClippingEnabled: true 
      }}
      camera={{ fov: 55, near: 0.1, far: Math.max(diag * 20, 10000) }}
    >
      <SceneBackground texture={bgTexture} color={o.colorBackground} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <group position={[
        o.caveCalibrationOffset?.x || 0, 
        o.caveCalibrationOffset?.z || 0, 
        -(o.caveCalibrationOffset?.y || 0)
      ]}>
        {/* V2 Engine: Point Cloud LOD */}
        {cave.pointCloudUrl && (
          <PointCloudLOD 
            url={cave.pointCloudUrl} 
            pointSize={o.pointCloudSize || 1.0} 
            clippingPlanes={compositeClippingPlanes}
          />
        )}

        {/* Mapbox Terrain Context */}
        {gpsCenter && o.showMapboxTerrain && o.mapboxToken && (
          <MapboxTerrain 
            lat={gpsCenter.lat}
            lng={gpsCenter.lng}
            radius={o.mapboxRadius || 2.0}
            zoom={o.mapboxZoom || 13}
            opacity={o.mapboxOpacity || 0.5}
            visible={o.showMapboxTerrain}
            mapboxToken={o.mapboxToken}
          />
        )}
      </group>

      <AutoFit cave={cave} trigger={fitTrigger} />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#84cc16', '#3b82f6']} labelColor="white" labels={['V', 'H', 'J']} />
      </GizmoHelper>

      <OrbitControls
        makeDefault
        enableDamping={true}
        dampingFactor={0.05}
        onChange={handleCameraChange}
      />
    </Canvas>
  )
}

export default React.memo(CaveViewerNextGen)
