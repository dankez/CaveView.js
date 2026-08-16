import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { PointCloudDirect, PointCloudLOD } from './PointCloudLOD'
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
import { Scraps } from '@shared/components/Scraps'
import type { ParsedCave, ViewerOptions, StationLabel, CaveViewerNextGenProps, Vec3, ViewerCameraSnapshot } from '@shared/types'
import type { LiDARAnomaly } from '@shared/utils/speleoAnalysis'

const SceneBackground = ({ texture, color }: { texture: THREE.Texture | null, color: string }) => {
  const { scene } = useThree()
  useEffect(() => {
    const previousBackground = scene.background
    if (texture) scene.background = texture
    else scene.background = new THREE.Color(color)
    return () => {
      scene.background = previousBackground
      texture?.dispose()
    }
  }, [scene, texture, color])
  return null
}

const CameraMonitor = ({ controlsRef, onUpdate }: {
  controlsRef: React.RefObject<any>,
  onUpdate?: (data: ViewerCameraSnapshot) => void
}) => {
  const { camera, size } = useThree()

  useEffect(() => {
    if (!onUpdate) return

    const update = () => {
      const target = controlsRef.current?.target || new THREE.Vector3(0, 0, 0)
      const dist = camera.position.distanceTo(target)
      const perspective = camera as THREE.PerspectiveCamera
      camera.updateMatrixWorld(true)
      onUpdate({
        dist,
        fov: perspective.fov || 55,
        width: size.width,
        height: size.height,
        aspect: perspective.aspect || size.width / Math.max(size.height, 1),
        near: perspective.near || 0.1,
        far: perspective.far || 10000,
        position: camera.position.toArray() as [number, number, number],
        quaternion: camera.quaternion.toArray() as [number, number, number, number],
        target: target.toArray() as [number, number, number],
      })
    }

    const timer = setInterval(update, 200)
    update()
    return () => clearInterval(timer)
  }, [camera, controlsRef, onUpdate, size])

  return null
}

const AutoFit = ({ cave, trigger, offset }: { cave: ParsedCave, trigger?: number, offset?: Vec3 }) => {
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
  onStationClick,
  anomalies,
  activeAnomalyId
}: { 
  isMeasuringMode: boolean, 
  controlsRef: React.RefObject<any>,
  fitTrigger?: number,
  cave: ParsedCave,
  offset?: Vec3,
  onStationClick?: (idx: number, x: number, y: number, ctrl: boolean, p?: any) => void,
  anomalies?: LiDARAnomaly[],
  activeAnomalyId?: string | null
}) => {
  const { camera, scene, raycaster, gl } = useThree();
  const historyRef = useRef<{ pos: THREE.Vector3, target: THREE.Vector3 }[]>([]);

  const getCanvasPointer = useCallback((e: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    return new THREE.Vector2(
      (x / rect.width) * 2 - 1,
      -(y / rect.height) * 2 + 1
    );
  }, [gl]);

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

  useEffect(() => {
    if (!activeAnomalyId || !anomalies || !controlsRef.current) return;
    const a = anomalies.find(x => x.id === activeAnomalyId);
    if (!a) return;
    
    const offX = offset?.x || 0;
    const offY = offset?.z || 0;
    const offZ = -(offset?.y || 0);
    
    const posX = a.pos.x + offX;
    const posY = a.pos.z + offY;
    const posZ = -a.pos.y + offZ;
    
    const targetPoint = new THREE.Vector3(posX, posY, posZ);
    const endPos = new THREE.Vector3(posX + 15, posY + 10, posZ + 15);
    
    flyTo(endPos, targetPoint);
  }, [activeAnomalyId, anomalies, offset, flyTo, controlsRef]);

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

    const mouse = getCanvasPointer(e);
    if (!mouse) return;

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
  }, [camera, scene, raycaster, isMeasuringMode, flyTo, getCanvasPointer]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!isMeasuringMode) return;

    const mouse = getCanvasPointer(e);
    if (!mouse) return;

    raycaster.setFromCamera(mouse, camera);
    raycaster.params.Points = { threshold: 0.2 };
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      onStationClick?.(-1, e.clientX, e.clientY, e.ctrlKey, point);
    }
  }, [camera, scene, raycaster, isMeasuringMode, onStationClick, getCanvasPointer]);

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
  selectedStations, activeProfilePoints, isMeasuringMode, manualConnection,
  anomalies, activeAnomalyId, onSurfaceOffsetChange
}: CaveViewerNextGenProps) => {
  const [isMoving, setIsModelMoving] = useState(false)
  const controlsRef = useRef<any>(null);
  const movingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const terrainRef = useRef<THREE.Group>(null);
  const transformControlsRef = useRef<any>(null);

  // Disable OrbitControls while dragging terrain
  useEffect(() => {
    if (!transformControlsRef.current || !controlsRef.current) return;
    
    const controls = controlsRef.current;
    const transform = transformControlsRef.current;
    
    const handleDragging = (e: any) => {
      controls.enabled = !e.value;
    };
    
    transform.addEventListener('dragging-changed', handleDragging);
    
    return () => {
      transform.removeEventListener('dragging-changed', handleDragging);
    };
  }, [o.terrainCalibrationMode]);

  const handleTerrainTransform = useCallback(() => {
    if (terrainRef.current && onSurfaceOffsetChange) {
      const pos = terrainRef.current.position;
      // Convert Three.js (x, y, z) back to Speleo (x, y, z)
      // Three.js X -> world X
      // Three.js Y (vertikála) -> world Z
      // Three.js Z -> world -Y => world Y = -Three.js Z
      onSurfaceOffsetChange({
        x: Number(pos.x.toFixed(2)),
        y: Number((-pos.z).toFixed(2)),
        z: Number(pos.y.toFixed(2))
      });
    }
  }, [onSurfaceOffsetChange]);

  const handleCameraChange = useCallback(() => {
    if (!isMoving) setIsModelMoving(true)
    if (movingTimeoutRef.current) clearTimeout(movingTimeoutRef.current)
    movingTimeoutRef.current = setTimeout(() => {
      setIsModelMoving(false)
      movingTimeoutRef.current = null
    }, 800)
  }, [isMoving])

  useEffect(() => {
    return () => {
      if (movingTimeoutRef.current) clearTimeout(movingTimeoutRef.current)
    }
  }, [])

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
        const normal = new THREE.Vector3(-v.z, 0, v.x)
        if (o.profileClipFlip) normal.multiplyScalar(-1)
        planes.push(new THREE.Plane(normal, -normal.dot(p1) - o.profileClipOffset))
      }
    }
    return planes
  }, [o.showClipping, o.clippingHeight, o.showProfileClipping, o.profileClipFlip, o.profileClipOffset, activeProfilePoints, cave.centerOffset.z])

  const caveClippingPlanes = useMemo(() => {
    if (o.excludeModelFromClipping) return []
    return compositeClippingPlanes
  }, [o.excludeModelFromClipping, compositeClippingPlanes])

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
        anomalies={anomalies}
        activeAnomalyId={activeAnomalyId}
      />
      
      <ambientLight intensity={0.16} />
      <hemisphereLight color="#dbeafe" groundColor="#1e293b" intensity={0.34} />
      <directionalLight position={[4, 6, 3]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-5, 2, -4]} intensity={0.24} color="#bfdbfe" />
      <directionalLight position={[-4, 5, 6]} intensity={0.46} color="#7dd3fc" />
      <directionalLight position={[0, -3, 2]} intensity={0.08} color="#fef3c7" />

      <EDLPass strength={o.edlStrength || 1.0} radius={o.edlRadius || 1.0} />

      <group position={[
        o.caveCalibrationOffset?.x || 0, 
        o.caveCalibrationOffset?.z || 0, 
        -(o.caveCalibrationOffset?.y || 0)
      ]}>
        <Stations cave={cave} options={o} />
        <CaveLegs cave={cave} options={o} showSplay={o.showSplay} showAltitude={o.traverseAltitude} clippingPlanes={compositeClippingPlanes} />
        <StationLabels cave={cave} options={o} showNames={o.showStationNames} showAltitudes={o.showStationAlt} />
        <EntranceMarkers cave={cave} options={o} />

        {o.showScraps && cave.scraps?.length > 0 && (
          <Scraps 
            cave={cave} 
            options={o}
            opacity={o.scrapsOpacity}
            showSolid={cave.pointCount === 0 ? o.scrapsSolid : (o.smoothScraps || o.accurateScraps)}
            showWire={o.scrapsWireframe}
            showAltitude={o.scrapsAltitude}
            smooth={o.smoothScraps}
            showRender={o.showRenderCave}
            caveTexture={o.caveTexture}
            renderOpacity={o.renderOpacity}
            isMoving={isMoving}
            clippingPlanes={compositeClippingPlanes}
            onProcessingStart={onStatusChange ? (msg) => onStatusChange({ msg, type: 'progress' }) : undefined}
            onProcessingEnd={onStatusChange ? () => onStatusChange(null) : undefined}
          />
        )}

        {selectedStations && selectedStations.length === 2 && (
          <ManualConnection p1={selectedStations[0].pos} p2={selectedStations[1].pos} />
        )}

        {o.placedCaver && (
          <Character3D pos={o.placedCaver.pos} pose={o.placedCaver.pose} clippingPlanes={compositeClippingPlanes} />
        )}

        {cave.pointCloudUrl && (
          <PointCloudLOD 
            url={cave.pointCloudUrl} 
            pointSize={o.pointCloudSize || 1.0} 
            brightness={o.pointCloudBrightness || 1.0}
            plasticity={o.pointCloudPlasticity || 1.0}
            pointShape={o.pointCloudShape || 'diamond'}
            colorMode={o.pointCloudColorMode || 'original'}
            customColor={o.pointCloudCustomColor || '#b3a694'}
            highlightColor={o.colorClippingEdges || '#ff4444'}
            minZ={cave.bounds.min.z}
            maxZ={cave.bounds.max.z}
            clippingPlanes={caveClippingPlanes}
            viewMode={o.pointCloudViewMode || 'all'}
            heightThreshold={o.pointCloudHeightThreshold ?? 0.4}
            angleThreshold={o.pointCloudAngleThreshold ?? 0.5}
          />
        )}

        {!cave.pointCloudUrl && cave.points && cave.pointCount > 0 && (
          <PointCloudDirect
            cave={cave}
            pointSize={o.pointCloudSize || 1.0}
            brightness={o.pointCloudBrightness || 1.0}
            plasticity={o.pointCloudPlasticity || 1.0}
            pointShape={o.pointCloudShape || 'diamond'}
            colorMode={o.pointCloudColorMode || 'original'}
            customColor={o.pointCloudCustomColor || '#b3a694'}
            highlightColor={o.colorClippingEdges || '#ff4444'}
            minZ={cave.bounds.min.z}
            maxZ={cave.bounds.max.z}
            clippingPlanes={caveClippingPlanes}
            viewMode={o.pointCloudViewMode || 'all'}
            heightThreshold={o.pointCloudHeightThreshold ?? 0.4}
            angleThreshold={o.pointCloudAngleThreshold ?? 0.5}
          />
        )}

        {/* LiDAR Anomálie */}
        {anomalies && anomalies.map((a) => {
          const isSelected = activeAnomalyId === a.id;
          
          // Prepočet súradníc: Speleo (x, y, z) -> Three.js (x, z, -y)
          const posX = a.pos.x;
          const posY = a.pos.z;
          const posZ = -a.pos.y;
          
          if (a.type === 'chimney') {
            return (
              <group key={a.id} position={[posX, posY, posZ]}>
                <mesh>
                  <coneGeometry args={[0.4, a.size, 8]} />
                  <meshBasicMaterial 
                    color={isSelected ? "#f43f5e" : "#f97316"} 
                    transparent 
                    opacity={isSelected ? 0.6 : 0.3} 
                    wireframe={!isSelected}
                  />
                </mesh>
                <pointLight color="#f97316" intensity={isSelected ? 2.0 : 0.5} distance={8} />
              </group>
            )
          } else if (a.type === 'window') {
            return (
              <group key={a.id} position={[posX, posY, posZ]}>
                <mesh>
                  <sphereGeometry args={[0.6, 16, 16]} />
                  <meshBasicMaterial 
                    color={isSelected ? "#06b6d4" : "#0284c7"} 
                    transparent 
                    opacity={isSelected ? 0.6 : 0.3} 
                    wireframe={!isSelected}
                  />
                </mesh>
                <pointLight color="#0284c7" intensity={isSelected ? 2.0 : 0.5} distance={6} />
              </group>
            )
          } else if (a.type === 'fracture') {
            let rotation: [number, number, number] = [0, 0, 0];
            if (a.normal) {
              const normalVec = new THREE.Vector3(a.normal.x, a.normal.z, -a.normal.y).normalize();
              const up = new THREE.Vector3(0, 1, 0);
              const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normalVec);
              const euler = new THREE.Euler().setFromQuaternion(quaternion);
              rotation = [euler.x, euler.y, euler.z];
            }
            return (
              <group key={a.id} position={[posX, posY, posZ]} rotation={rotation}>
                <mesh>
                  <cylinderGeometry args={[a.size / 4, a.size / 4, 0.1, 16]} />
                  <meshBasicMaterial 
                    color={isSelected ? "#d946ef" : "#8b5cf6"} 
                    transparent 
                    opacity={isSelected ? 0.5 : 0.25} 
                    wireframe={!isSelected}
                  />
                </mesh>
                <pointLight color="#8b5cf6" intensity={isSelected ? 2.0 : 0.5} distance={8} />
              </group>
            )
          }
          return null;
        })}

        {gpsCenter && o.showMapboxTerrain && o.mapboxToken && (
          <group 
            ref={terrainRef} 
            position={[
              o.surfaceOffset?.x || 0, 
              o.surfaceOffset?.z || 0, 
              -(o.surfaceOffset?.y || 0)
            ]}
          >
            <MapboxTerrain 
              lat={gpsCenter.lat}
              lng={gpsCenter.lng}
              radius={o.mapboxRadius || 2.0}
              zoom={o.mapboxZoom || 13}
              opacity={o.mapboxOpacity || 0.5}
              visible={o.showMapboxTerrain}
              mapboxToken={o.mapboxToken}
            />
          </group>
        )}

        {o.terrainCalibrationMode && o.showMapboxTerrain && terrainRef.current && (
          <TransformControls 
            ref={transformControlsRef}
            object={terrainRef.current} 
            mode="translate" 
            onChange={handleTerrainTransform}
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
      <CameraMonitor controlsRef={controlsRef} onUpdate={onCameraUpdate} />
    </Canvas>
  )
}

export default CaveViewerNextGen
