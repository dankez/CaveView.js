/**
 * Cave file parsers for .lox (Therion), .3d (Survex), .plt (Compass)
 */

export interface Vec3 { x: number; y: number; z: number }

export interface Segment {
  from: Vec3
  to: Vec3
  type: 'cave' | 'splay' | 'surface' | 'duplicate'
}

export interface Scrap {
  vertices: Vec3[]
  faces: number[][]
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
  /** Same centering offset as applied to all cave coords */
  centerOffset: Vec3
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
}

// ─── LOX Parser ────────────────────────────────────────────────────────────────

export function parseLox(buffer: ArrayBuffer, onProgress?: (msg: string) => void): ParsedCave {
  const f       = new DataView(buffer)
  const bytes   = new Uint8Array(buffer)
  const l       = buffer.byteLength
  const utf8    = new TextDecoder('utf-8')

  const stationsById  = new Map<number, Vec3>()
  const stationMeta   = new Map<number, { name: string; z: number; isEntrance?: boolean; fullLabel?: string }>()
  const segments:  Segment[]     = []
  const scraps:    Scrap[]       = []
  const surfaces:  CaveSurface[] = []
  const shash: Record<string, Vec3> = {}

  // Terrain accumulator — type 5 and type 6 records share one terrain object per file
  let terrain: Partial<CaveSurface> = {}

  let pos            = 0
  let chunkDataStart = 0

  function readUint(): number      { const v = f.getUint32(pos, true);    pos += 4; return v }
  function readFloat64(): number   { const v = f.getFloat64(pos, true);   pos += 8; return v }
  function readDataPtr()           { return { position: readUint(), size: readUint() } }
  function readString(ptr: { position: number; size: number }): string {
    if (ptr.size === 0) return ''
    return utf8.decode(new Uint8Array(buffer, chunkDataStart + ptr.position, ptr.size - 1))
  }

  while (pos < l) {
    const m_type     = readUint()
    const m_totalRecSize = readUint()
    const m_recCount     = readUint()
    const m_dataSize     = readUint()

    if (m_type === 2 && onProgress) onProgress('parsing_stations');
    if (m_type === 3 && onProgress) onProgress('parsing_shots');
    if (m_type === 4 && onProgress) onProgress('generating_scraps');
    if (m_type === 5 && onProgress) onProgress('generating_surface');

    const m_recSize = m_recCount > 0 ? m_totalRecSize / m_recCount : 0
    chunkDataStart = pos + m_totalRecSize   // out-of-line area for this chunk

    for (let i = 0; i < m_recCount; i++) {
      switch (m_type) {
        case 1: readSurvey();     break
        case 2: readStation();    break
        case 3: readShot();       break
        case 4: readScrap();      break
        case 5: readSurface();    break
        case 6: readSurfaceBMP(); break
        default: 
          // Neznámy typ chunku — preskočíme ho namiesto chyby
          pos += m_recSize
          break
      }
    }
    pos += m_dataSize
  }

  if (onProgress) onProgress('finalizing');

  // Commit terrain if we collected DTM data
  if (terrain.dtm) {
    surfaces.push({
      dtm:            terrain.dtm!,
      bitmapData:     terrain.bitmapData ?? null,
      bitmapMimeType: terrain.bitmapMimeType ?? null,
      bitmapUrl:      null, // will be populated in main thread
      bitmapCalib:    terrain.bitmapCalib ?? null,
      centerOffset:   { x: 0, y: 0, z: 0 },
    })
  }

  const stations = Array.from(stationsById.values())
  const ids      = Array.from(stationsById.keys())

  return buildResult(segments, stations, stationMeta, scraps, surfaces, ids)

  // ── type 1 ─ Survey ──────────────────────────────────────────────────────────
  function readSurvey() {
    readUint()      // m_id
    readDataPtr()   // namePtr
    readUint()      // m_parent
    readDataPtr()   // titlePtr
  }

  // ── type 2 ─ Station ─────────────────────────────────────────────────────────
  function readStation() {
    const m_id      = readUint()
    readUint()                   // m_surveyId
    const namePtr    = readDataPtr()
    const commentPtr = readDataPtr()
    const rawName    = readString(namePtr)
    const rawComment = readString(commentPtr)
    
    const lowerText = (rawName + " " + rawComment).toLowerCase()
    const m_flags = readUint()
    // Flags v tomto modeli: 0x02 = entrance, 0x01 = surface/point?
    const isEntrance = (m_flags & 0x02) !== 0 || 
                       lowerText.includes('vchod') || 
                       lowerText.includes('vstup') || 
                       lowerText.includes('entrance') || 
                       lowerText.includes('zavrt')
    
    const x = readFloat64()
    const y = readFloat64()
    const z = readFloat64()
    const coords: Vec3 = { x, y, z }

    stationsById.set(m_id, coords)
    
    // Ak je meno len číslo a máme komentár, použi komentár ako plný label
    const isNum = /^\d+$/.test(rawName)
    const fullLabel = (isNum && rawComment) ? rawComment : rawName

    stationMeta.set(m_id, {
      name: rawName || `[${m_id}]`,
      z:    coords.z,   // original altitude before centering
      isEntrance,
      fullLabel: fullLabel || rawName
    } as any)
  }

  function readCoords(): Vec3 {
    const x = readFloat64(); const y = readFloat64(); const z = readFloat64()
    return { x, y, z }
  }

  // ── type 3 ─ Shot ────────────────────────────────────────────────────────────
  function readShot() {
    const m_from_r = readUint(); const m_to_r = readUint()
    readFloat64(); readFloat64(); readFloat64(); readFloat64()  // fromLRUD
    readFloat64(); readFloat64(); readFloat64(); readFloat64()  // toLRUD
    const m_flags = readUint()
    readUint()  // m_sectionType
    readUint()  // m_surveyId
    pos += 8    // m_threshold

    const from = stationsById.get(m_from_r)
    const to   = stationsById.get(m_to_r)
    if (!from || !to) return

    let type: Segment['type'] = 'cave'
    if      (m_flags & 0x10) type = 'splay'
    else if (m_flags & 0x01) type = 'surface'
    else if (m_flags & 0x02) type = 'duplicate'
    segments.push({ from, to, type })
  }

  // ── type 4 ─ Scrap (triangulated wall mesh) ───────────────────────────────
  function readScrap() {
    readUint(); readUint()                    // m_id, m_surveyId
    const m_numPoints  = readUint()
    const pointsPtr    = readDataPtr()
    const m_num3Angles = readUint()
    const facesPtr     = readDataPtr()

    const vDV      = new DataView(buffer, chunkDataStart + pointsPtr.position)
    const vertices: Vec3[] = []
    for (let i = 0; i < m_numPoints; i++) {
      const o = i * 24
      vertices.push({ x: vDV.getFloat64(o, true), y: vDV.getFloat64(o + 8, true), z: vDV.getFloat64(o + 16, true) })
    }

    const fDV  = new DataView(buffer, chunkDataStart + facesPtr.position)
    const faces: number[][] = []
    let lastFace: number[] | undefined

    for (let i = 0; i < m_num3Angles; i++) {
      const o    = i * 12
      const face = [fDV.getUint32(o, true), fDV.getUint32(o + 4, true), fDV.getUint32(o + 8, true)]
      if (face[0] === face[1] || face[0] === face[2] || face[1] === face[2]) continue

      fixWinding: {
        if (lastFace) {
          for (let j = 0; j < 3; j++) {
            if (face[j] === lastFace[(j + 2) % 3] && face[(j + 1) % 3] === lastFace[(j + 3) % 3]) { face.reverse(); break fixWinding }
          }
          for (let j = 0; j < 3; j++) {
            if (face[j] === lastFace[j] && face[(j + 1) % 3] === lastFace[(j + 1) % 3]) { face.reverse(); break fixWinding }
          }
          for (let j = 0; j < 3; j++) {
            if (face[j] === lastFace[(j + 1) % 3] && face[(j + 1) % 3] === lastFace[(j + 2) % 3]) { face.reverse(); break fixWinding }
          }
        }
      }
      faces.push(face); lastFace = face
    }

    if (vertices.length > 0 && faces.length > 0) scraps.push({ vertices, faces })
  }

  // ── type 5 ─ Surface DTM ─────────────────────────────────────────────────
  function readSurface() {
    readUint()                   // m_id
    const m_width   = readUint()
    const m_height  = readUint()
    const surfacePtr = readDataPtr()
    const calib      = readCalibration()

    // elevation data is Float64 grid in the out-of-line area
    const ab  = buffer.slice(chunkDataStart + surfacePtr.position,
                             chunkDataStart + surfacePtr.position + surfacePtr.size)
    const dtm = new Float64Array(ab)

    terrain.dtm = { data: dtm, samples: m_width, lines: m_height, calib }
  }

  function readSurfaceBMP() {
    readUint()   // m_type (texture type)
    readUint()   // m_surfaceId
    const imagePtr = readDataPtr()
    const calib = readCalibration()
    terrain.bitmapCalib = calib

    const imgData = new Uint8Array(buffer, chunkDataStart + imagePtr.position, imagePtr.size)
    const b0 = imgData[0]; const b1 = imgData[1]
    let mimeType = ''
    if      (b0 === 0xff && b1 === 0xd8) mimeType = 'image/jpeg'
    else if (b0 === 0x89 && b1 === 0x50) mimeType = 'image/png'
    if (!mimeType) return

    // We store raw data to avoid Blob URL revocation in Worker
    terrain.bitmapData     = new Uint8Array(imgData) // Clone it so it's not tied to original buffer
    terrain.bitmapMimeType = mimeType
  }

  function readCalibration(): Calibration {
    return {
      xOrigin: readFloat64(), yOrigin: readFloat64(),
      xx: readFloat64(), xy: readFloat64(),
      yx: readFloat64(), yy: readFloat64(),
    }
  }
}

// ─── SVX .3d parser (v3–v8) ────────────────────────────────────────────────────

export function parseSvx(buffer: ArrayBuffer, onProgress?: (msg: string) => void): ParsedCave {
  const data    = new Uint8Array(buffer)
  const dv      = new DataView(buffer)
  const decoder = new TextDecoder()

  const segments:  Segment[]  = []
  const stations:  Vec3[]     = []
  const stationMeta = new Map<number, { name: string; z: number }>()
  const stationMap  = new Map<string, Vec3>()

  let pos = 0

  function readLine(): string {
    const start = pos
    while (pos < data.length && data[pos] !== 0x0a) pos++
    const s = decoder.decode(data.subarray(start, pos)); pos++; return s
  }

  readLine(); const version = readLine(); readLine(); readLine()

  if (!['v3','v4','v5','v6','v7','v8'].includes(version))
    throw new Error('Nepodporovaná verzia .3d: ' + version)
  if (version === 'v8') pos++

  let label = ''; let prevPos: Vec3 | null = null; let stIdx = 0

  if (onProgress) onProgress('parsing_model');
  while (pos < data.length) {
    const cmd = data[pos++]
    if (cmd === 0x00) { label = ''; continue }
    if (cmd === 0x0f) { prevPos = readXYZ(); continue }

    if (cmd >= 0x40 && cmd < 0x80) {
      const flags = cmd & 0x3f
      if (version === 'v8') readLabelV8(flags); else readLabelV7()
      const cur = readXYZ()
      if (prevPos) {
        const type: Segment['type'] = (flags & 0x01) ? 'surface' : (flags & 0x04) ? 'splay' : 'cave'
        segments.push({ from: { ...prevPos }, to: { ...cur }, type })
      }
      prevPos = cur; continue
    }

    if (cmd >= 0x80) {
      if (version === 'v8') readLabelV8(cmd & 0x3f); else readLabelV7()
      const coords = readXYZ()
      if (!stationMap.has(label)) {
        stationMap.set(label, coords)
        stations.push(coords)
        stationMeta.set(stIdx++, { name: label, z: coords.z })
      }
      continue
    }

    if (cmd >= 0x00 && cmd <= 0x04) continue
    if (cmd === 0x10) continue
    if (cmd === 0x11) { pos += 2; continue }
    if (cmd === 0x12) { pos += 3; continue }
    if (cmd === 0x13) { pos += 4; continue }
    if (cmd === 0x1f) { pos += 4; continue }
    if (cmd >= 0x20 && cmd <= 0x24) { pos += 4; continue }
    if (cmd === 0x21) { pos += 8; continue }
    if (cmd >= 0x01 && cmd < 0x0f) { label = label.slice(0, -cmd); continue }
    if (cmd >= 0x10 && cmd < 0x20) { label = label.slice(0, -(cmd - 15)); continue }
    if (cmd === 0x30 || cmd === 0x31) { pos += 8;  continue }
    if (cmd === 0x32 || cmd === 0x33) { pos += 16; continue }
  }

  return buildResult(segments, stations, stationMeta, [], [])

  function readXYZ(): Vec3 {
    const x = dv.getInt32(pos, true) / 100; pos += 4
    const y = dv.getInt32(pos, true) / 100; pos += 4
    const z = dv.getInt32(pos, true) / 100; pos += 4
    return { x, y, z }
  }

  function readLabelV7() {
    let len = 0
    if      (data[pos] === 0xfe) { len = dv.getUint16(pos, true) + data[pos]; pos += 2 }
    else if (data[pos] === 0xff) { len = dv.getUint32(pos, true);              pos += 4 }
    else                          { len = data[pos++] }
    if (len === 0) return
    label += decoder.decode(data.subarray(pos, pos + len)); pos += len
  }

  function readLabelV8(flags: number) {
    if (flags & 0x20) return
    const b = data[pos++]; let del = 0, add = 0
    if (b !== 0) { del = b >> 4; add = b & 0x0f }
    else {
      const db = data[pos++]; del = db !== 0xff ? db : (dv.getUint32(pos, true) + (pos += 4, 0))
      const ab = data[pos++]; add = ab !== 0xff ? ab : (dv.getUint32(pos, true) + (pos += 4, 0))
    }
    if (del) label = label.slice(0, -del)
    if (add) { label += decoder.decode(data.subarray(pos, pos + add)); pos += add }
  }
}

// ─── PLT parser (Compass) ──────────────────────────────────────────────────────

export function parsePlt(text: string, onProgress?: (msg: string) => void): ParsedCave {
  const lines    = text.split('\n')
  const segments: Segment[]  = []
  const stations: Vec3[]     = []
  const meta     = new Map<number, { name: string; z: number }>()
  let prevPos: Vec3 | null   = null; let idx = 0

  if (onProgress) onProgress('parsing_model');
  for (const rawLine of lines) {
    const line = rawLine.trim(); const cmd = line.charAt(0)
    if (cmd !== 'M' && cmd !== 'D') { prevPos = null; continue }
    const parts = line.split(/\s+/)
    if (parts.length < 4) continue
    const x = parseFloat(parts[1]); const y = parseFloat(parts[2]); const z = parseFloat(parts[3])
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue
    const coords: Vec3 = { x: x * 0.3048, y: y * 0.3048, z: z * 0.3048 }
    // Extract station name from last token if present
    const name = parts.length >= 5 ? parts[parts.length - 1] : `P${idx}`
    stations.push(coords)
    meta.set(idx++, { name, z: coords.z })
    if (cmd === 'D' && prevPos) segments.push({ from: prevPos, to: coords, type: 'cave' })
    prevPos = coords
  }

  return buildResult(segments, stations, meta, [], [])
}

// ─── PLY parser (LiDAR / Mesh) ──────────────────────────────────────────────────

export function parsePly(buffer: ArrayBuffer, onProgress?: (msg: string) => void): ParsedCave {
  // Read header more robustly (can be > 1024 bytes)
  const bytes = new Uint8Array(buffer);
  let headerEnd = -1;
  const decoder = new TextDecoder();
  
  // Find "end_header"
  const searchStr = 'end_header';
  for (let i = 0; i < Math.min(bytes.length, 16384); i++) {
    if (bytes[i] === 101 && bytes[i+1] === 110 && bytes[i+2] === 100) { // "end"
      const chunk = decoder.decode(bytes.subarray(i, i + 20));
      if (chunk.startsWith('end_header')) {
        headerEnd = i + chunk.indexOf('\n') + 1;
        if (chunk.includes('\r\n')) headerEnd = i + chunk.indexOf('\n') + 1;
        break;
      }
    }
  }

  if (headerEnd === -1) throw new Error('Invalid PLY: Missing end_header');
  
  const headerText = decoder.decode(bytes.subarray(0, headerEnd));
  const headerLines = headerText.split(/\r?\n/);
  
  let vertexCount = 0;
  let faceCount = 0;
  let format = '';
  
  const properties: { name: string, type: string, size: number, offset: number }[] = [];
  let currentElement = '';
  let currentStride = 0;
  
  const typeSizes: Record<string, number> = {
    'char': 1, 'uchar': 1, 'short': 2, 'ushort': 2, 'int': 4, 'uint': 4, 'float': 4, 'double': 8,
    'int8': 1, 'uint8': 1, 'int16': 2, 'uint16': 2, 'int32': 4, 'uint32': 4, 'float32': 4, 'float64': 8
  };

  for (const line of headerLines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'format') format = parts[1];
    if (parts[0] === 'element') {
      currentElement = parts[1];
      if (parts[1] === 'vertex') vertexCount = parseInt(parts[2]);
      if (parts[1] === 'face') faceCount = parseInt(parts[2]);
    }
    if (parts[0] === 'property' && currentElement === 'vertex') {
      const type = parts[1];
      const name = parts[2];
      const size = typeSizes[type] || 4;
      properties.push({ name, type, size, offset: currentStride });
      currentStride += size;
    }
  }

  if (format !== 'binary_little_endian') {
    throw new Error('Support for ASCII or Big Endian PLY not implemented yet.');
  }

  if (onProgress) onProgress(vertexCount > 500000 ? 'loading_large_lidar' : 'parsing_model');

  const vertexStride = currentStride;
  const dv = new DataView(buffer, headerEnd);
  
  // Allocate optimized typed arrays
  const points = new Float32Array(vertexCount * 3);
  const pointColors = new Float32Array(vertexCount * 3);
  const pointNormals = new Float32Array(vertexCount * 3);
  const pointIntensity = new Float32Array(vertexCount);
  const pointClassification = new Uint8Array(vertexCount);
  
  // Property indices for fast access
  const propIdx = {
    x: properties.find(p => p.name === 'x'),
    y: properties.find(p => p.name === 'y'),
    z: properties.find(p => p.name === 'z'),
    r: properties.find(p => p.name === 'red' || p.name === 'r' || p.name === 'diffuse_red'),
    g: properties.find(p => p.name === 'green' || p.name === 'g' || p.name === 'diffuse_green'),
    b: properties.find(p => p.name === 'blue' || p.name === 'b' || p.name === 'diffuse_blue'),
    nx: properties.find(p => p.name === 'nx' || p.name === 'normal_x'),
    ny: properties.find(p => p.name === 'ny' || p.name === 'normal_y'),
    nz: properties.find(p => p.name === 'nz' || p.name === 'normal_z'),
    intensity: properties.find(p => p.name === 'intensity' || p.name === 'i' || p.name === 'scalar_Intensity'),
    class: properties.find(p => p.name === 'classification' || p.name === 'class' || p.name === 'scalar_Classification')
  };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Faster parsing loop
  for (let i = 0; i < vertexCount; i++) {
    const vOffset = i * vertexStride;
    
    // Position (mandatory)
    let x = 0, y = 0, z = 0;
    if (propIdx.x) x = dv.getFloat32(vOffset + propIdx.x.offset, true);
    if (propIdx.y) y = dv.getFloat32(vOffset + propIdx.y.offset, true);
    if (propIdx.z) z = dv.getFloat32(vOffset + propIdx.z.offset, true);
    
    points[i*3] = x; points[i*3+1] = y; points[i*3+2] = z;
    
    // Bounds
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;

    // Color (optional)
    if (propIdx.r && propIdx.g && propIdx.b) {
      pointColors[i*3]   = dv.getUint8(vOffset + propIdx.r.offset) / 255;
      pointColors[i*3+1] = dv.getUint8(vOffset + propIdx.g.offset) / 255;
      pointColors[i*3+2] = dv.getUint8(vOffset + propIdx.b.offset) / 255;
    } else {
      pointColors[i*3] = 1; pointColors[i*3+1] = 1; pointColors[i*3+2] = 1;
    }

    // Normals (optional)
    if (propIdx.nx && propIdx.ny && propIdx.nz) {
      pointNormals[i*3]   = dv.getFloat32(vOffset + propIdx.nx.offset, true);
      pointNormals[i*3+1] = dv.getFloat32(vOffset + propIdx.ny.offset, true);
      pointNormals[i*3+2] = dv.getFloat32(vOffset + propIdx.nz.offset, true);
    }

    // Intensity (optional)
    if (propIdx.intensity) {
      pointIntensity[i] = dv.getFloat32(vOffset + propIdx.intensity.offset, true);
    }

    // Classification (optional)
    if (propIdx.class) {
      pointClassification[i] = dv.getUint8(vOffset + propIdx.class.offset);
    }
  }

  // ── Voxelová decimácia (rovnomerná, celý model) ───────────────────────────
  // OPRAVA: Predtým sa zastavilo pri MAX_POINTS → zachoval sa len začiatok súboru.
  // Teraz: VŠETKY body prechádzajú voxelovou mriežkou; voxelový krok zabezpečí
  // rovnomernú hustotu po celom modeli.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const MAX_POINTS = 1_000_000;
  const rangeMax = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

  const dX = maxX - minX, dY = maxY - minY, dZ = maxZ - minZ;
  const approxSurface = 2 * (dX*dY + dX*dZ + dY*dZ) || rangeMax * rangeMax;
  const surfaceVoxel = Math.sqrt(approxSurface / MAX_POINTS);
  const voxelStep = vertexCount > MAX_POINTS
    ? Math.max(0.005, surfaceVoxel)
    : 0.002;

  const invVoxel = 1.0 / voxelStep;
  const voxelMap = new Map<bigint, number>();

  const outPoints = new Float32Array(Math.min(vertexCount, MAX_POINTS) * 3);
  const hasColors = !!(propIdx.r && propIdx.g && propIdx.b);
  const outColors    = hasColors     ? new Float32Array(outPoints.length)               : new Float32Array(0);
  const hasNativeCls = propIdx.class !== undefined;
  const outCls       = hasNativeCls  ? new Uint8Array(Math.min(vertexCount, MAX_POINTS)) : new Uint8Array(0);
  const hasIntensity = propIdx.intensity !== undefined;
  const outIntensity = hasIntensity  ? new Float32Array(Math.min(vertexCount, MAX_POINTS)) : new Float32Array(0);

  let outCount = 0;

  for (let i = 0; i < vertexCount; i++) {
    if (outCount >= MAX_POINTS) break; 
    const x = points[i*3];
    const y = points[i*3+1];
    const z = points[i*3+2];

    const ix = Math.floor((x - minX) * invVoxel);
    const iy = Math.floor((y - minY) * invVoxel);
    const iz = Math.floor((z - minZ) * invVoxel);

    const key = BigInt(ix & 0x3FFF) | (BigInt(iy & 0x3FFF) << 14n) | (BigInt(iz & 0x3FFF) << 28n);
    if (voxelMap.has(key)) continue;
    voxelMap.set(key, outCount);

    const o3 = outCount * 3;
    outPoints[o3]   = x - cx;
    outPoints[o3+1] = y - cy;
    outPoints[o3+2] = z - cz;

    if (hasColors) {
      outColors[o3]   = pointColors[i*3];
      outColors[o3+1] = pointColors[i*3+1];
      outColors[o3+2] = pointColors[i*3+2];
    }
    if (hasNativeCls) outCls[outCount] = pointClassification[i];
    if (hasIntensity) outIntensity[outCount] = pointIntensity[i];

    outCount++;
  }

  if (onProgress) onProgress('finalizing');

  const finalPoints  = outPoints.subarray(0, outCount * 3);
  const finalColors  = hasColors ? outColors.subarray(0, outCount * 3) : null;
  const finalCls     = hasNativeCls ? outCls.subarray(0, outCount) : null;
  const finalInt     = hasIntensity ? outIntensity.subarray(0, outCount) : null;

  return {
    segments: [],
    stations: [],
    stationLabels: [],
    scraps: [],
    surfaces: [],
    bounds: {
      min:    { x: minX - cx, y: minY - cy, z: minZ - cz },
      max:    { x: maxX - cx, y: maxY - cy, z: maxZ - cz },
      center: { x: 0, y: 0, z: 0 },
      size:   { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    },
    centerOffset: { x: cx, y: cy, z: cz },
    stationCount: 0,
    segmentCount: 0,
    scrapCount: 0,
    pointCount: outCount,
    hasSurface: false,
    isLiDAR: true,
    points:               new Float32Array(finalPoints),
    pointColors:          finalColors  ? new Float32Array(finalColors)  : new Float32Array(outCount * 3),
    pointNormals:         new Float32Array(0),   // normály generuje GPU, nepotrebujeme prenášať
    pointIntensity:       finalInt     ? new Float32Array(finalInt)     : new Float32Array(0),
    pointClassification:  finalCls     ? new Uint8Array(finalCls)       : new Uint8Array(0),
  };
}

/**
 * Heuristic classification of LiDAR points.
 * Distinguishes between Ground, Vegetation, and Cave Passages.
 */
export function classifyLiDAR(cave: ParsedCave) {
  if (!cave.points || !cave.pointNormals) return;
  const count = cave.pointCount;
  const classes = new Uint8Array(count);
  const points = cave.points;
  const normals = cave.pointNormals;

  // Calculate local stats if needed (simplified for performance)
  let avgZ = 0;
  for (let i = 0; i < count; i++) avgZ += points[i*3+2];
  avgZ /= count;

  for (let i = 0; i < count; i++) {
    const pIdx = i * 3;
    const nz = normals[pIdx + 2];
    const z = points[pIdx + 2];

    // 1. GROUND (Horizontal normals, relatively flat)
    if (nz > 0.85) {
      classes[i] = 2; // Ground
    } 
    // 2. VEGETATION (Random normals, usually high up)
    else if (z > avgZ + 2 && Math.abs(nz) < 0.7) {
      classes[i] = 4; // Vegetation
    }
    // 3. CAVE (Deep points, mostly vertical walls)
    else if (z < avgZ - 5) {
      classes[i] = 10; // Custom: Cave
    }
    // 4. UNCLASSIFIED
    else {
      classes[i] = 1; 
    }
  }
  cave.pointClassification = classes;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function buildResult(
  segments:    Segment[],
  stations:    Vec3[],
  stationMeta: Map<number, { name: string; z: number; isEntrance?: boolean; fullLabel?: string }>,
  scraps:      Scrap[],
  surfaces:    CaveSurface[],
  stationIds?: number[]
): ParsedCave {
  if (stations.length === 0 && segments.length > 0) {
    segments.forEach(s => { stations.push(s.from, s.to) })
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  const pts = segments.length > 0 ? segments.flatMap(s => [s.from, s.to]) : stations
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z
  }
  for (const sc of scraps) for (const v of sc.vertices) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z
  }

  const cx = (isFinite(minX) && isFinite(maxX)) ? (minX + maxX) / 2 : 0
  const cy = (isFinite(minY) && isFinite(maxY)) ? (minY + maxY) / 2 : 0
  const cz = (isFinite(minZ) && isFinite(maxZ)) ? (minZ + maxZ) / 2 : 0

  const centered = segments.map(s => ({
    type: s.type,
    from: { x: s.from.x - cx, y: s.from.y - cy, z: s.from.z - cz },
    to:   { x: s.to.x   - cx, y: s.to.y   - cy, z: s.to.z   - cz },
  }))

  const centeredStations = stations.map(s => ({ x: s.x - cx, y: s.y - cy, z: s.z - cz }))
  const isLiDAR = stationMeta.size === 0 && stations.length > 5000

  // Build station labels — use original z for altitude
  const stationLabels: StationLabel[] = isLiDAR ? [] : centeredStations.map((pos, i) => {
    const lookupId = stationIds ? stationIds[i] : i
    const meta = stationMeta.get(lookupId)
    let n = meta?.name ?? `S${i}`
    if (!/[a-zA-Z0-9]/.test(n)) n = ''
    return {
      pos,
      name:     n,
      altitude: meta?.z        ?? (pos.z + cz),   // original altitude in metres
      isEntrance: meta?.isEntrance,
      fullLabel:  meta?.fullLabel
    }
  })

  const centeredScraps = scraps.map(sc => ({
    faces: sc.faces,
    vertices: sc.vertices.map(v => ({ x: v.x - cx, y: v.y - cy, z: v.z - cz })),
  }))

  const centerOffset: Vec3 = { x: cx, y: cy, z: cz }
  const centeredSurfaces = surfaces.map(s => ({ ...s, centerOffset }))

  // Convert stations to Float32Array points for rendering
  const pointCount = centeredStations.length
  const pointsTyped = new Float32Array(pointCount * 3)
  for (let i = 0; i < pointCount; i++) {
    pointsTyped[i*3] = centeredStations[i].x
    pointsTyped[i*3+1] = centeredStations[i].y
    pointsTyped[i*3+2] = centeredStations[i].z
  }

  return {
    segments:      centered,
    stations:      centeredStations,
    stationLabels,
    scraps:        centeredScraps,
    surfaces:      centeredSurfaces,
    bounds: {
      min:    { x: minX - cx, y: minY - cy, z: minZ - cz },
      max:    { x: maxX - cx, y: maxY - cy, z: maxZ - cz },
      center: { x: 0, y: 0, z: 0 },
      size:   { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    },
    centerOffset,
    stationCount:  stations.length,
    segmentCount:  segments.length,
    scrapCount:    scraps.length,
    pointCount:    pointCount,
    hasSurface:    surfaces.length > 0,
    isLiDAR:       isLiDAR,
    points:        pointsTyped
  }
}
