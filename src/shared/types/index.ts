import { Vector3 } from 'three';

export interface Vec3 { x: number; y: number; z: number }

export interface Station {
  id: number;
  surveyId: number;
  name: string;
  coords: Vector3;
  type: number;
  comment?: string | null;
}

export interface Shot {
  from: Station;
  to: Station;
  type: number;
  surveyId: number;
}

export interface Lrud {
  l: number;
  r: number;
  u: number;
  d: number;
}

export interface Xsect {
  fromId: number;
  toId: number;
  start: Station;
  end: Station;
  fromLRUD: Lrud;
  lrud: Lrud;
  survey: number;
  type: number;
}

export interface Scrap {
  vertices: Vec3[]
  faces: number[][]
  survey?: number
}

export interface Segment {
  from: Vec3
  to: Vec3
  type: 'cave' | 'splay' | 'surface' | 'duplicate'
  fromLrud?: Lrud
  toLrud?: Lrud
}

/** Per-station metadata for label display */
export interface StationLabel {
  pos: Vec3        // centered 3-D position (Three.js coords)
  name: string     // station name from file
  altitude: number // original Z (metres above sea level, before centering)
  isEntrance?: boolean // true if identified as an entrance
  fullLabel?: string   // more descriptive name (e.g. from comments)
  gps?: { lat: number; lon: number; zone?: number; epsg?: string } | null
}

/** Calibration matrix that maps DTM grid (col i, row j) → world X/Y */
export interface Calibration {
  xOrigin: number; yOrigin: number
  xx: number; xy: number; yx: number; yy: number
}

/** Parsed terrain surface (LOX type 5 + type 6) */
export interface CaveSurface {
  /** Width × Height elevation grid in metres (Float64, row-major) */
  dtm: { data: Float64Array; samples: number; lines: number; calib: Calibration }
  /** Raw bitmap data if extracted from file */
  bitmapData?: Uint8Array | null
  /** MIME type of bitmapData */
  bitmapMimeType?: string | null
  /** JPEG or PNG data-URL for the overlay texture (created in main thread), or null */
  bitmapUrl: string | null
  /** Optional calibration for the bitmap, if different from DTM */
  bitmapCalib?: Calibration | null
  /** Real-world S-JTSK bounding box for WMS fetching */
  sjtskBbox?: string
  /** Aspect ratio of the S-JTSK bounding box */
  sjtskAspect?: number
  /** Same centering offset as applied to all cave coords */
  centerOffset: Vec3
  /** Real-world bounds of the terrain data (provided by tiffParser) */
  bounds?: {
    minZ: number;
    maxZ: number;
    width: number;
    height: number;
  }
}

export interface ParsedCave {
  segments:      Segment[]
  stations:      Vec3[]
  stationLabels: StationLabel[]
  scraps:        Scrap[]
  surfaces:      CaveSurface[]
  bounds: { min: Vec3; max: Vec3; center: Vec3; size: Vec3 }
  centerOffset:  Vec3        // offset applied when centering the model
  stationCount:  number
  segmentCount:  number
  scrapCount:    number
  pointCount:    number      // Added for point clouds
  hasSurface:    boolean
  points?:       Float32Array // Points as [x, y, z, ...]
  pointColors?:  Float32Array // Points as [r, g, b, ...] (0-1)
  pointNormals?: Float32Array // Points as [nx, ny, nz, ...]
  pointIntensity?: Float32Array // Intensity values
  pointClassification?: Uint8Array // Classification codes
  isLiDAR?:      boolean      // Added for point clouds
  pointCloudUrl?: string      // URL for streaming point cloud
}

export interface SurveyData {
  stations: Station[];
  shots: Shot[];
  xsects: Xsect[];
  scraps: Scrap[];
  limits: {
    min: Vector3;
    max: Vector3;
  };
}

// ─── ViewerOptions ────────────────────────────────────────────────────────────
export interface ViewerOptions {
  // Engine selection
  engine:              'v1' | 'v2'
  // Survey
  showSplay:           boolean
  // Stations
  showStations:        boolean
  showStationNames:    boolean
  showStationAlt:      boolean
  showEntrances:       boolean
  showEntranceLabels:  boolean
  // Grid
  showGrid:            boolean
  colorGrid:           string
  colorBoundingBox:    string
  showBoundingBox:     boolean
  // Cave scraps (walls)
  showScraps:          boolean
  scrapsOpacity:       number
  scrapsSolid:         boolean
  scrapsWireframe:     boolean
  scrapsAltitude:      boolean
  scrapsIntensity:     boolean
  scrapsClassification: boolean
  smoothScraps:        boolean
  accurateScraps:      boolean
  showRenderCave:      boolean
  caveTexture:         'limestone' | 'dolomite' | 'grey_limestone'
  renderOpacity:       number
  organicLevel:        number
  organicVoxelSize:     number   // Debug / Tuning: veľkosť voxlu
  organicDilation:      number   // Debug / Tuning: sila dilatácie (bulge)
  // Cave traverse
  showTraverse:        boolean
  traverseRadius:      number
  traverseAltitude:    boolean
  // Terrain surface
  showSurfaceMesh:     boolean
  showSurfaceMeshWire: boolean
  showSurfaceTexture:  boolean
  surfaceTextureSource: 'custom' | 'wms-orto' | 'wms-orto-freemap' | 'wms-geology' | 'wms-shadow' | 'none'
  surfaceTextureUrl?:  string | null
  showSurfaceNetwork:  boolean
  showContours:        boolean
  showContourLabels:  boolean
  contourColor:        string
  contourColor10:      string
  surfaceOpacity:      number
  surfaceColor:        string
  // LiDAR Layers
  showVegetation:      boolean
  showGround:          boolean
  showCaveLiDAR:       boolean
  // Mapbox Terrain
  showMapboxTerrain:   boolean
  mapboxToken:         string
  mapboxZoom:          number
  mapboxRadius:        number
  mapboxOpacity:       number
  // LiDAR V2 specific
  pointCloudSize:      number
  edlStrength:         number
  edlRadius:           number
  pointCloudBrightness: number
  pointCloudColorMode: 'original' | 'elevation' | 'natural'
  pointCloudCustomColor: string
  pointCloudPlasticity: number
  pointCloudViewMode: 'all' | 'floor' | 'ceiling' | 'contour' | 'heatmap'
  pointCloudHeightThreshold: number
  pointCloudAngleThreshold: number
  
  surfaceTextureOpacity: number
  surfaceWmsResolution: number
  surfaceTextureOffset: { x: number, y: number }
  surfaceTextureScale:  { x: number, y: number }
  surfaceOffset:        { x: number, y: number, z: number }
  surfaceTextureCalibration?: {
    p1: { x: number, y: number, lat: number, lon: number },
    p2: { x: number, y: number, lat: number, lon: number }
  } | null
  placedCaver:         { pos: [number, number, number], pose: 'standing' | 'crawling' } | null
  // Colors
  colorBackground:   string
  colorBackground2?:  string
  colorSplay:          string
  colorTraverse:       string
  colorScraps:         string
  colorScrapsWire:     string
  colorStations:       string
  colorStationNames:   string
  colorStationAlt:     string
  colorTerrainWire:    string
  // Clipping
  showClipping:        boolean
  clippingHeight:      number
  showProfileClipping: boolean
  profileClipFlip:     boolean
  profileClipOffset:   number
  showClippingEdges:   boolean
  showSurfaceClippingEdges: boolean
  colorClippingEdges:  string
  colorSurfaceClippingEdges: string
  useSurfaceNet:       boolean
  clippingPlanes?:     any[]
  showGizmo:           boolean

  // Floor Map
  floorMapSvg:         string | null
  floorMapTh2:         any | null  // Parsed Th2Scrap[]
  floorMapOpacity:     number
  manualMatches:       { src: { x: number; y: number }; dst: { x: number; y: number } }[] | null
  
  // Cinematic
  autoRotate:          boolean
  autoRotateSpeed:     number
  cinematicMode:       boolean
  recordingDuration:   number
  excludeModelFromClipping: boolean
  caveCalibrationOffset: { x: number, y: number, z: number }
  terrainCalibrationMode: boolean
}

export interface LiDARWorkerMessage {
  type: 'POINTCLOUD_CHUNK' | 'DONE' | 'ERROR';
  id?: string;
  bounds?: {
    min: Vec3;
    max: Vec3;
  };
  points?: Float32Array;
  colors?: Float32Array;
  normals?: Float32Array;
  intensity?: Float32Array;
  relHeight?: Float32Array;
  vertexCount?: number;
  error?: string;
}

export interface CaveViewerNextGenProps {
  cave: ParsedCave;
  options: ViewerOptions;
  onStationClick?: (idx: number, screenX: number, screenY: number, ctrlKey: boolean, point?: any) => void;
  onCameraUpdate?: (data: { dist: number, fov: number, height: number }) => void;
  onStatusChange?: (status: { msg: string, type: 'info' | 'error' | 'success' | 'progress', progress?: number } | null) => void;
  fitTrigger?: number;
  selectedStations?: StationLabel[];
  activeProfilePoints?: StationLabel[] | null;
  isMeasuringMode: boolean;
  manualConnection?: { p1: Vec3, p2: Vec3 } | null;
  anomalies?: any[];
  activeAnomalyId?: string | null;
  onSurfaceOffsetChange?: (offset: Vec3) => void;
}
