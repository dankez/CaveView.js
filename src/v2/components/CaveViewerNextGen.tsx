import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { PointCloudLOD } from './PointCloudLOD'
import { EDLPass } from './EDLPass'
import MapboxTerrain from './MapboxTerrain'
import { 
  Stations, 
  StationLabels, 
  CaveLegs, 
  EntranceMarkers, 
  Character3D, 
  ManualConnection 
} from '@shared/components/CaveSharedElements'
import type { ParsedCave, ViewerOptions, StationLabel } from '@shared/types'

interface Props {
  cave: ParsedCave
  options: ViewerOptions
  onStationClick: (idx: number, screenX: number, screenY: number, ctrlKey: boolean) => void
  onCameraUpdate?: (data: { dist: number, fov: number, height: number }) => void
  onStatusChange?: (status: { msg: string; type: 'info' | 'error' | 'success' | 'progress'; progress?: number } | null) => void
  fitTrigger?: number
  selectedStations?: any[]
  activeProfilePoints?: any[] | null
  isMeasuringMode: boolean
  manualConnection?: { p1: any, p2: any } | null
}

const SceneBackground = ({ texture, color }: { texture: THREE.Texture | null, color: string }) => {
  const { scene } = useThree()
  useEffect(() => {
    if (texture) scene.background = texture
    else scene.background = new THREE.Color(color)
  }, [scene, texture, color])
  return null
}

const AutoFit = ({ cave, trigger, offset }: { cave: ParsedCave, trigger?: number, offset?: {x: number, y: number, z: number} }) => {
  const { camera, controls } = useThree() as any
  useEffect(() => {
    const b = cave.bounds
    const diag = Math.sqrt(b.size.x ** 2 + b.size.y ** 2 + b.size.z ** 2)
    const dist = Math.max(diag * 2.0, 50)
    
    // Account for calibration offset in world space
    const ox = offset?.x || 0;
    const oy = offset?.z || 0; // Three.js Y is world Z
    const oz = -(offset?.y || 0); // Three.js Z is world -Y
    
    const targetX = b.center.x + ox;
    const targetY = b.center.z + oy;
    const targetZ = -b.center.y + oz;
    
    camera.position.set(targetX + dist, targetY + dist * 0.8, targetZ + dist)
    camera.near = 0.1; camera.far = Math.max(diag * 25, 10000)
    camera.updateProjectionMatrix()
    if (controls && controls.target) {
      controls.target.set(targetX, targetY, targetZ)
      controls.update()
    }
  }, [cave, trigger, camera, controls, offset])
  return null
}

const NavigationHandler = ({ 
  isMeasuringMode, 
  controlsRef, 
  fitTrigger, 
  cave, 
  offset,
  onStationClick
}: { 
  isMeasuringMode: boolean, 
  controlsRef: React.RefObject<any>,
  fitTrigger?: number,
  cave: ParsedCave,
  offset?: {x: number, y: number, z: number},
  onStationClick: any
}) => {
  const { camera, scene, raycaster, gl } = useThree();
  const historyRef = useRef<{ pos: THREE.Vector3, target: THREE.Vector3 }[]>([]);

  const flyTo = useCallback((endPos: THREE.Vector3, targetPoint: THREE.Vector3) => {
    // Save current state to history before flying
    if (controlsRef.current) {
      historyRef.current.push({
        pos: camera.position.clone(),
        target: controlsRef.current.target.clone()
      });
      // Keep history manageable
      if (historyRef.current.length > 20) historyRef.current.shift();
    }

    gsap.to(camera.position, {
      x: endPos.x,
      y: endPos.y,
      z: endPos.z,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => {
        if (controlsRef.current) {
          controlsRef.current.target.lerp(targetPoint, 0.1);
        }
      },
      onComplete: () => {
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetPoint);
          controlsRef.current.update();
        }
      }
    });
  }, [camera, controlsRef]);

  const handleUndo = useCallback(() => {
    const prevState = historyRef.current.pop();
    if (prevState && controlsRef.current) {
      gsap.to(camera.position, {
        x: prevState.pos.x,
        y: prevState.pos.y,
        z: prevState.pos.z,
        duration: 1.0,
        ease: "power2.out"
      });
      gsap.to(controlsRef.current.target, {
        x: prevState.target.x,
        y: prevState.target.y,
        z: prevState.target.z,
        duration: 1.0,
        ease: "power2.out",
        onUpdate: () => controlsRef.current.update()
      });
    }
  }, [camera, controlsRef]);

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    if (isMeasuringMode) return;

    const mouse = new THREE.Vector2(
      (e.clientX / gl.domElement.clientWidth) * 2 - 1,
      -(e.clientY / gl.domElement.clientHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    raycaster.params.Points = { threshold: 0.5 };
    
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const targetPoint = intersects[0].point;
      const startPos = camera.position.clone();
      const direction = new THREE.Vector3().subVectors(targetPoint, startPos).normalize();
      const distance = startPos.distanceTo(targetPoint);
      const flyDistance = Math.max(0, distance - 3.0);
      const endPos = startPos.clone().add(direction.multiplyScalar(flyDistance));

      flyTo(endPos, targetPoint);
    }
  }, [camera, scene, raycaster, isMeasuringMode, flyTo, gl]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!isMeasuringMode) return;

    const mouse = new THREE.Vector2(
      (e.clientX / gl.domElement.clientWidth) * 2 - 1,
      -(e.clientY / gl.domElement.clientHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    raycaster.params.Points = { threshold: 0.2 };
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      // NextGen measurement doesn't have station indices, but we can fake it or use coordinates
      onStationClick(-1, e.clientX, e.clientY, e.ctrlKey, point);
    }
  }, [camera, scene, raycaster, isMeasuringMode, onStationClick, gl]);

  useEffect(() => {
    gl.domElement.addEventListener('dblclick', handleDoubleClick);
    gl.domElement.addEventListener('click', handleClick);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') handleUndo();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const onUndoEvent = () => handleUndo();
    window.addEventListener('cave-navigation-undo', onUndoEvent);

    return () => {
      gl.domElement.removeEventListener('dblclick', handleDoubleClick);
      gl.domElement.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('cave-navigation-undo', onUndoEvent);
    };
  }, [handleDoubleClick, handleClick, handleUndo, gl]);

  return null;
};

const CaveViewerNextGen = ({ 
  cave, options: o, onStationClick, onCameraUpdate, onStatusChange, fitTrigger, 
  selectedStations, activeProfilePoints, isMeasuringMode, manualConnection 
}: Props) => {
  console.log('[V2] Rendering CaveViewerNextGen', { pointCloudUrl: cave.pointCloudUrl });
  const [isMoving, setIsModelMoving] = useState(false)
  const controlsRef = useRef<any>(null);

  const handleCameraChange = useCallback(() => {
    if (!isMoving) setIsModelMoving(true)
  }, [isMoving])

  const diag = Math.sqrt(cave.bounds.size.x ** 2 + cave.bounds.size.y ** 2 + cave.bounds.size.z ** 2)

  // Calculate GPS center for Mapbox Terrain
  const gpsCenter = useMemo(() => {
    const labelsWithGps = cave.stationLabels.filter((l: StationLabel) => l.gps && l.gps.lat && l.gps.lon);
    if (labelsWithGps.length > 0) {
      const avgLat = labelsWithGps.reduce((sum: number, l: StationLabel) => sum + l.gps!.lat, 0) / labelsWithGps.length;
      const avgLon = labelsWithGps.reduce((sum: number, l: StationLabel) => sum + l.gps!.lon, 0) / labelsWithGps.length;
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
      const s1 = activeProfilePoints[0] as any;
      const s2 = activeProfilePoints[1] as any;
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
      <NavigationHandler 
        isMeasuringMode={isMeasuringMode} 
        controlsRef={controlsRef} 
        cave={cave} 
        offset={o.caveCalibrationOffset}
        onStationClick={onStationClick}
      />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <EDLPass strength={o.edlStrength || 1.0} radius={o.edlRadius || 1.0} />

      <group position={[
        o.caveCalibrationOffset?.x || 0, 
        o.caveCalibrationOffset?.z || 0, 
        -(o.caveCalibrationOffset?.y || 0)
      ]}>
        {/* ── Survey Data in V2 ── */}
        <Stations cave={cave} options={o} />
        <CaveLegs cave={cave} options={o} showSplay={o.showSplay} showAltitude={o.traverseAltitude} clippingPlanes={compositeClippingPlanes} />
        <StationLabels cave={cave} options={o} showNames={o.showStationNames} showAltitudes={o.showStationAlt} />
        <EntranceMarkers cave={cave} options={o} />

        {/* ── Measurements ── */}
        {selectedStations && selectedStations.length === 2 && (
          <ManualConnection p1={selectedStations[0]} p2={selectedStations[1]} />
        )}

        {/* ── Jaskyniar ── */}
        {o.placedCaver && (
          <Character3D pos={o.placedCaver.pos} pose={o.placedCaver.pose} clippingPlanes={compositeClippingPlanes} />
        )}

        {/* V2 Engine: Point Cloud LOD */}
        {cave.pointCloudUrl && (
          <PointCloudLOD 
            url={cave.pointCloudUrl} 
            pointSize={o.pointCloudSize || 1.0} 
            brightness={o.pointCloudBrightness || 1.0}
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

      <AutoFit cave={cave} trigger={fitTrigger} offset={o.caveCalibrationOffset} />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#84cc16', '#3b82f6']} labelColor="white" labels={['V', 'H', 'J']} />
      </GizmoHelper>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping={true}
        dampingFactor={0.05}
        onChange={handleCameraChange}
      />
    </Canvas>
  )
}

export default CaveViewerNextGen
