import type { ParsedCave, StationLabel, CaveSurface, Vec3 } from '@shared/types'

export interface ReferenceStationInfo {
  station: StationLabel | null
  idx: number
  name: string
  altitude: number
  type: 'entrance_gps' | 'entrance' | 'lowest_station' | 'none'
  gps: { lat: number; lon: number; zone?: number; epsg?: string } | null
}

const ENTRANCE_REGEX = /(vchod|vstup|entrance|eingang|trou|boca|zavrt|závrt)/i
const SURFACE_REGEX = /(surface|povrch|ter[eé]n|gps|fix|sjtsk|utm)/i

/** Overí, či je stanica označená alebo pomenovaná ako vchod */
export function isEntranceStation(station: { name?: string; fullLabel?: string; isEntrance?: boolean }): boolean {
  if (station.isEntrance) return true
  if (station.name && ENTRANCE_REGEX.test(station.name)) return true
  if (station.fullLabel && ENTRANCE_REGEX.test(station.fullLabel)) return true
  return false
}

/** Overí, či ide o povrchovú stanicu (napr. povrchový polygon, GPS bod na povrchu) */
export function isSurfaceStation(
  station: { name?: string; fullLabel?: string; pos?: Vec3 },
  idx?: number,
  cave?: ParsedCave
): boolean {
  const name = station.name || ''
  const full = station.fullLabel || ''
  if (SURFACE_REGEX.test(name) || SURFACE_REGEX.test(full)) return true

  // Ak máme segmenty, skontrolujeme, či sú všetky pripojené ťahy typu 'surface'
  if (cave && station.pos && cave.segments?.length > 0) {
    const p = station.pos
    let hasSegments = false
    let allSurface = true

    for (let i = 0; i < cave.segments.length; i++) {
      const seg = cave.segments[i]
      const matchesFrom = Math.abs(seg.from.x - p.x) < 0.001 && Math.abs(seg.from.y - p.y) < 0.001 && Math.abs(seg.from.z - p.z) < 0.001
      const matchesTo = Math.abs(seg.to.x - p.x) < 0.001 && Math.abs(seg.to.y - p.y) < 0.001 && Math.abs(seg.to.z - p.z) < 0.001

      if (matchesFrom || matchesTo) {
        hasSegments = true
        if (seg.type !== 'surface') {
          allSurface = false
          break
        }
      }
    }

    if (hasSegments && allSurface) return true
  }

  return false
}

/** Nájde referenčný vchod alebo bod s najnižším číslom (mimo povrchu) */
export function findReferenceStation(cave: ParsedCave): ReferenceStationInfo {
  if (!cave.stationLabels || cave.stationLabels.length === 0) {
    if (cave.stations && cave.stations.length > 0) {
      const p = cave.stations[0]
      const alt = p.z + (cave.centerOffset?.z || 0)
      return {
        station: null,
        idx: 0,
        name: '0',
        altitude: alt,
        type: 'none',
        gps: null,
      }
    }
    return {
      station: null,
      idx: -1,
      name: '',
      altitude: 0,
      type: 'none',
      gps: null,
    }
  }

  // 1. Priorita: Hľadáme vchody (podľa flagu isEntrance alebo názvu)
  const entrances: { sl: StationLabel; idx: number }[] = []
  cave.stationLabels.forEach((sl, idx) => {
    if (isEntranceStation(sl)) {
      entrances.push({ sl, idx })
    }
  })

  if (entrances.length > 0) {
    // Ak máme viac vchodov, vezmeme prvý označený vchod (primárny)
    const primary = entrances[0]
    const hasGps = Boolean(primary.sl.gps)
    return {
      station: primary.sl,
      idx: primary.idx,
      name: primary.sl.name || `Vchod ${primary.idx}`,
      altitude: primary.sl.altitude,
      type: hasGps ? 'entrance_gps' : 'entrance',
      gps: primary.sl.gps || null,
    }
  }

  // 2. Ak jaskyňa nemá vchod ani GPS:
  // Hľadáme nepovrchové stanice a vyberieme stanicu s najnižším číslom (často 0, 1, 2...)
  const nonSurface: { sl: StationLabel; idx: number; num: number | null }[] = []
  
  cave.stationLabels.forEach((sl, idx) => {
    if (!isSurfaceStation(sl, idx, cave)) {
      // Extrakcia čísla z názvu (napr. "0", "1", "0.0", "P1")
      const match = sl.name.match(/\d+(\.\d+)?/)
      const num = match ? parseFloat(match[0]) : null
      nonSurface.push({ sl, idx, num })
    }
  })

  const pool = nonSurface.length > 0 ? nonSurface : cave.stationLabels.map((sl, idx) => {
    const match = sl.name.match(/\d+(\.\d+)?/)
    return { sl, idx, num: match ? parseFloat(match[0]) : null }
  })

  // Zoradíme: najprv stanice s číslom (vzostupne), pri zhode čísla preferujeme presné "0", potom podľa idx
  let best = pool[0]
  for (let i = 1; i < pool.length; i++) {
    const item = pool[i]
    if (item.num !== null) {
      if (best.num === null || item.num < best.num) {
        best = item
      } else if (item.num === best.num) {
        if (item.sl.name === '0' && best.sl.name !== '0') {
          best = item
        }
      }
    }
  }

  return {
    station: best.sl,
    idx: best.idx,
    name: best.sl.name || `S${best.idx}`,
    altitude: best.sl.altitude,
    type: 'lowest_station',
    gps: best.sl.gps || null,
  }
}

/** Interpoluje výšku povrchu DTM pre danú world-space pozíciu (x, y) */
export function sampleDtmAt(surface: CaveSurface, worldX: number, worldY: number): number | null {
  const { dtm } = surface
  if (!dtm || !dtm.calib) return null
  const { data, samples, lines, calib } = dtm
  const det = calib.xx * calib.yy - calib.xy * calib.yx
  if (Math.abs(det) < 1e-12) return null

  const dx  = worldX - calib.xOrigin
  const dy  = worldY - calib.yOrigin
  const col = (dx * calib.yy - dy * calib.xy) / det
  const row = (dy * calib.xx - dx * calib.yx) / det

  if (col < 0 || col >= samples - 1 || row < 0 || row >= lines - 1) return null

  const c0 = Math.floor(col), r0 = Math.floor(row)
  const fc = col - c0, fr = row - r0
  const z00 = data[r0 * samples + c0]
  const z10 = data[r0 * samples + c0 + 1]
  const z01 = data[(r0 + 1) * samples + c0]
  const z11 = data[(r0 + 1) * samples + c0 + 1]
  return z00 * (1 - fc) * (1 - fr) + z10 * fc * (1 - fr) + z01 * (1 - fc) * fr + z11 * fc * fr
}

/** Nájde nadmorskú výšku terénu priamo kolmo nad danými world súradnicami */
export function sampleSurfaceElevationAt(
  surfaces: CaveSurface[] | undefined,
  worldX: number,
  worldY: number,
  worldZ?: number,
  caveCalibrationOffset: Vec3 = { x: 0, y: 0, z: 0 },
  surfaceOffset: Vec3 = { x: 0, y: 0, z: 0 }
): { surfaceZ: number; distToSurf: number | null } | null {
  if (!surfaces || surfaces.length === 0) return null

  for (let i = 0; i < surfaces.length; i++) {
    const surf = surfaces[i]
    const sx = worldX + caveCalibrationOffset.x - surfaceOffset.x
    const sy = worldY + caveCalibrationOffset.y - surfaceOffset.y
    const rawZ = sampleDtmAt(surf, sx, sy)
    if (rawZ !== null && Number.isFinite(rawZ)) {
      const surfaceZ = rawZ + surfaceOffset.z
      const distToSurf = worldZ !== undefined ? surfaceZ - (worldZ + caveCalibrationOffset.z) : null
      return { surfaceZ, distToSurf }
    }
  }

  return null
}

export interface StationDepthsResult {
  distToSurf: number | null       // m, kladné = pod povrchom, záporné = nad povrchom
  surfaceZ: number | null         // m n.m. nadmorská výška povrchu kolmo nad bodom
  denivEntrance: number | null    // m, denivelácia od vchodu / ref bodu (alt - refAlt)
  refStationName: string | null   // meno referenčného vchodu / bodu
  refStationType: 'entrance_gps' | 'entrance' | 'lowest_station' | 'none'
  entranceAlt: number | null      // m n.m. výška referenčného bodu
  refStationIdx: number
}

/** Kompletný výpočet hĺbky pod povrchom a denivelácie od vchodu pre dané súradnice */
export function calculateStationDepths(
  cave: ParsedCave,
  pointCoords: { x: number; y: number; z: number },
  opts?: {
    caveCalibrationOffset?: Vec3
    surfaceOffset?: Vec3
  }
): StationDepthsResult {
  const caveOffset = opts?.caveCalibrationOffset || { x: 0, y: 0, z: 0 }
  const surfOffset = opts?.surfaceOffset || { x: 0, y: 0, z: 0 }

  const ref = findReferenceStation(cave)
  const denivEntrance = ref.type !== 'none' ? pointCoords.z - ref.altitude : null

  const surf = sampleSurfaceElevationAt(
    cave.surfaces,
    pointCoords.x,
    pointCoords.y,
    pointCoords.z,
    caveOffset,
    surfOffset
  )

  return {
    distToSurf: surf?.distToSurf ?? null,
    surfaceZ: surf?.surfaceZ ?? null,
    denivEntrance,
    refStationName: ref.name || null,
    refStationType: ref.type,
    entranceAlt: ref.type !== 'none' ? ref.altitude : null,
    refStationIdx: ref.idx,
  }
}
