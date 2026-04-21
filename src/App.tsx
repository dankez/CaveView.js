import React, { useState, useRef, useCallback, useEffect, Suspense, useMemo } from 'react'
import proj4 from 'proj4'
import { parseLox, parseSvx, parsePlt } from './parsers/caveParser'
import type { ParsedCave, CaveSurface } from './parsers/caveParser'
import CaveViewer3D, { ViewerOptions } from './components/CaveViewer3D'
import { CalibrationModal } from './components/CalibrationModal'
import { getBrowserLanguage, getTranslation, Language, languages } from './i18n'

type AppState = 'welcome' | 'loading' | 'viewer' | 'error'

interface LoadedFile {
  name: string
  size: number
  ext: string
}

const SUPPORTED = [
  { ext: '.lox', label: 'Therion LOX', icon: '🗺️' },
  { ext: '.3d',  label: 'Survex 3D',   icon: '📐' },
  { ext: '.plt', label: 'Compass PLT', icon: '🧭' },
]

// ─── GPS & DTM utilities ─────────────────────────────────────────────────────────────

/** Pokus o konverziu UTM (metricke súradnice) → WGS84 lat/lon.
 *  Funguje pre UTM Severnej pologule zóna 1–60. Vráti null ak nie sú UTM súradnice. */
function tryUtmToWgs84(easting: number, northing: number): { lat: number; lon: number; zone: number } | null {
  // Kontrola UTM rozsahu
  if (easting < 100000 || easting > 900000) return null
  if (northing < 0 || northing > 10000000) return null

  // Odhadni UTM zónu zo stredového meridiánu
  // Pre Slovakia: UTM 34N (lon 18–24°, stred/východ) alebo 33N (lon 12–18°, západ)
  // Heuristika: ak northing ~5000000-5600000 a easting ~200000-700000 → pravdepodobne UTM
  const a  = 6378137.0
  const f  = 1 / 298.257223563
  const b  = a * (1 - f)
  const e2 = 1 - (b / a) ** 2
  const k0 = 0.9996
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))

  // Skuš zóny, preferuj 34N vzhľadom na najčastejšie jaskynné oblasti SR (Slovenský kras, Tatry)
  for (const zone of [34, 33, 32, 35, 31, 36, 30, 29]) {
    const x  = easting - 500000
    const y  = northing
    const M  = y / k0
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))

    const phi1 = mu
      + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
      + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
      + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)

    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2)
    const T1 = Math.tan(phi1) ** 2
    const C1 = (e2 / (1 - e2)) * Math.cos(phi1) ** 2
    const R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5
    const D  = x / (N1 * k0)

    const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
      D ** 2 / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2 / (1 - e2)) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2 / (1 - e2) - 3 * C1 ** 2) * D ** 6 / 720
    )
    const lon0_deg = (zone - 1) * 6 - 180 + 3
    const lon0_rad = lon0_deg * Math.PI / 180
    const lon  = lon0_rad + (D
      - (1 + 2 * T1 + C1) * D ** 3 / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2 / (1 - e2) + 24 * T1 ** 2) * D ** 5 / 120
    ) / Math.cos(phi1)

    const latDeg = lat * 180 / Math.PI
    const lonDeg = lon * 180 / Math.PI
    
    // Potrebujeme sa uistiť, že vypočítaná dĺžka naozaj patrí (alebo je veľmi blízko) do danej UTM zóny.
    // UTM zóna má šírku 6°. Povolíme malý presah (napr. 3.5° namiesto 3°) kvôli okraju.
    if (latDeg >= -90 && latDeg <= 90 && lonDeg >= -180 && lonDeg <= 180) {
      if (Math.abs(lonDeg - lon0_deg) <= 3.5) {
        return { lat: latDeg, lon: lonDeg, zone }
      }
    }
  }
  return null
}

/** Pokus o konverziu S-JTSK (metricke súradnice záporné) → WGS84 lat/lon. */
function tryJtskToWgs84(x: number, y: number): { lat: number; lon: number; epsg: string } | null {
  // S-JTSK má špecifické rozsahy (na Slovensku / v ČR).
  // Therion .lox zvyčajne exportuje orientáciu tak, že originX je -Y a originY je -X.
  // Easting (x) je typicky od -900000 do -150000 
  // Northing (y) je typicky od -1350000 do -900000
  if (x > -950000 && x < -150000 && y > -1350000 && y < -900000) {
    const sjtskDef = "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs"
    try {
      const wgs = proj4(sjtskDef, "WGS84", [x, y])
      if (wgs && wgs.length === 2) return { lat: wgs[1], lon: wgs[0], epsg: 'S-JTSK Křovák' }
    } catch (e) {
      console.warn("Chyba proj4 pri S-JTSK:", e)
    }
  }
  return null
}

/** Interpoluje výšku povrchu DTM pre danú world-space poziciú (x, y).
 *  Vráti výšku v metroch alebo null ak je bod mimo gridu. */
function sampleDtmAt(surface: CaveSurface, worldX: number, worldY: number): number | null {
  const { dtm } = surface
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

// ─── Station detail card ─────────────────────────────────────────────────────────────

export interface SelStation {
  idx:          number
  name:         string
  origX:        number
  origY:        number
  altitude:     number    // m n.m.
  gps:          { lat: number; lon: number; zone?: number; epsg?: string } | null
  distToSurf:   number | null   // m, kladné = jaskyňa je pod povrchom
  screenX:      number
  screenY:      number
  centerX?:     number
  centerY?:     number
  centerZ?:     number
}

function StationDetailCard({ stations, onClose, onPlaceCaver, onSetProfile, t }: { 
  stations: SelStation[]; 
  onClose: () => void;
  onPlaceCaver: (pos: [number, number, number], pose: 'standing' | 'crawling') => void;
  onSetProfile: (sts: SelStation[]) => void;
  t: (key: string) => string;
}) {
  const [posOffset, setPosOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; isDragging: boolean }>({ startX: 0, startY: 0, isDragging: false })

  if (stations.length === 0) return null
  const st1 = stations[0]
  const st2 = stations.length > 1 ? stations[1] : null

  // Pôvodná poloha karty
  const cx = Math.min(Math.max(st1.screenX, 280), window.innerWidth - 320)
  const cy = Math.min(Math.max(st1.screenY + 20, 60), window.innerHeight - 450)

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX - posOffset.x,
      startY: e.clientY - posOffset.y,
      isDragging: true
    }
    const handleMouseMove = (em: MouseEvent) => {
      if (!dragRef.current.isDragging) return
      setPosOffset({
        x: em.clientX - dragRef.current.startX,
        y: em.clientY - dragRef.current.startY
      })
    }
    const handleMouseUp = () => {
      dragRef.current.isDragging = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const Row = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.06)', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, textAlign: 'right', fontFamily: 'monospace' }}>
        {value}{sub && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{sub}</span>}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', left: cx + posOffset.x, top: cy + posOffset.y, zIndex: 200, minWidth: 280,
      background: 'linear-gradient(135deg,rgba(8,15,35,.97),rgba(15,25,50,.97))',
      border: '1px solid rgba(79,195,247,.35)',
      borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 8px 40px rgba(0,0,0,.7),0 0 0 1px rgba(79,195,247,.1)',
      backdropFilter: 'blur(12px)',
      fontFamily: 'Inter, system-ui, sans-serif',
      userSelect: 'text',
    }}>
      {/* Header - Drag Handle */}
      <div 
        onMouseDown={handleMouseDown}
        style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, 
          cursor: 'grab', padding: '4px 0' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4fc3f7', boxShadow: '0 0 6px #4fc3f7' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.01em' }}>
            {stations.length === 1 ? st1.name : `${t('measuring.selection')}: ${st1.name} → ${st2?.name}`}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 4,
        }} title={t('ui.close')} aria-label={t('ui.close')}>✕</button>
      </div>

      {/* Podrobnosti bodu */}
      {stations.map((st, i) => (
        <div key={i} style={{ marginBottom: stations.length > 1 ? 12 : 0 }}>
          {stations.length > 1 && (
            <div style={{ fontSize: 10, color: i === 0 ? '#fbbf24' : '#ef4444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {i === 0 ? t('measuring.startPoint') : t('measuring.endPoint')}
            </div>
          )}
          {st.idx !== -1 ? (
            <Row label={t('stations.title')} value={`#${st.idx}`} sub={`(${st.name})`} />
          ) : (
            <Row label={t('stations.coordinates')} value={st.name} />
          )}
          <Row label={t('stations.altitude')} value={`${st.altitude.toFixed(2)} m`} sub="n.m." />
          {st.distToSurf !== null && (
            <Row
              label={t('stations.depth')}
              value={Math.abs(st.distToSurf).toFixed(1) + ' m'}
              sub={st.distToSurf >= 0 ? `(${t('terrain.title').toLowerCase()})` : `(nad ${t('terrain.title').toLowerCase()})`}
            />
          )}

          {/* GPS Section only if 1 station is selected to save space */}
          {stations.length === 1 && (
            <>
              <div style={{ margin: '10px 0 2px', fontSize: 10, color: '#4fc3f7', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                GPS WGS84 {st.gps ? (st.gps.zone ? `(UTM ${st.gps.zone}N)` : `(${st.gps.epsg})`) : ''}
              </div>
              {st.gps ? (
                <>
                  <Row label="Latitude" value={`${st.gps.lat.toFixed(6)}°`} />
                  <Row label="Longitude" value={`${st.gps.lon.toFixed(6)}°`} />
                  <div style={{ marginTop: 4 }}>
                    <a
                      href={`https://maps.google.com/?q=${st.gps.lat.toFixed(6)},${st.gps.lon.toFixed(6)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#4fc3f7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      🗺️ {t('ui.googleMaps')}
                    </a>
                  </div>
                </>
              ) : (
                <Row label="GPS" value={t('measuring.unavailable')} sub="" />
              )}
            </>
          )}
        </div>
      ))}

      {/* Meranie ak sú zvolené dva body */}
      {st1 && st2 && (() => {
        const dx = st2.origX - st1.origX
        const dy = st2.origY - st1.origY
        const dz = st2.altitude - st1.altitude
        const horizDist = Math.sqrt(dx * dx + dy * dy)
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
        const inc = Math.asin(dz / dist3D) * 180 / Math.PI
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#ef4444', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ width: 14, height: 2, borderBottom: '2px dashed #ef4444' }}></div>
              {t('measuring.title')}
            </div>
            <Row label={t('measuring.dist3d')} value={`${dist3D.toFixed(2)} m`} />
            <Row label={t('measuring.distHoriz')} value={`${horizDist.toFixed(2)} m`} />
            <Row label={t('measuring.climb')} value={`${(dz > 0 ? '+' : '')}${dz.toFixed(2)} m`} />
            <Row label={t('measuring.azimuth')} value={`${az.toFixed(1)}°`} />
            <Row label={t('measuring.slope')} value={`${(inc > 0 ? '+' : '')}${inc.toFixed(1)}°`} />
          </div>
        )
      })()}

      {/* Mierka - Jaskyniar */}
      {stations.length === 1 && (
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button 
            onClick={() => onPlaceCaver([st1.origX - (stations[0].centerX || 0), st1.altitude - (stations[0].centerZ || 0), -st1.origY + (stations[0].centerY || 0)], 'standing')}
            style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(79,195,247,.1)', border: '1px solid rgba(79,195,247,.3)', borderRadius: 8, color: '#4fc3f7', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>accessibility_new</span>
            <span>{t('caver.standing')}</span>
          </button>
          <button 
            onClick={() => onPlaceCaver([st1.origX - (stations[0].centerX || 0), st1.altitude - (stations[0].centerZ || 0), -st1.origY + (stations[0].centerY || 0)], 'crawling')}
            style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(79,195,247,.1)', border: '1px solid rgba(79,195,247,.3)', borderRadius: 8, color: '#4fc3f7', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>child_care</span>
            <span>{t('caver.crawling')}</span>
          </button>
        </div>
      )}

      {stations.length >= 2 && (
        <button 
          onClick={() => onSetProfile(stations)}
          style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#3b82f6', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>content_cut</span>
          <span>{t('clipping.create')}</span>
        </button>
      )}

      <div style={{ marginTop: 12 }}>
        <button 
          className="btn-back" 
          style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }} 
          onClick={onClose}
        >
          {t('ui.closeWindow')}
        </button>
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 14, fontSize: 10, color: '#64748b', textAlign: 'center' }}>
        {stations.length === 1 ? t('ui.hint1') : t('ui.hint2')}
      </div>
    </div>
  )
}

const MemoizedStatusBadge = React.memo(({ isMoving }: { isMoving: boolean }) => (
  <div className={`tb-badge ${isMoving ? 'draft' : 'stable'}`} style={{
    fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
    background: isMoving ? '#f56565' : '#48bb78',
    color: '#fff', marginLeft: -4, boxShadow: isMoving ? '0 0 10px rgba(245,101,101,0.4)' : 'none',
    transition: 'all 0.1s'
  }}>
    {isMoving ? 'DRAFT' : 'STABLE'}
  </div>
))

// ─── Color Picker Component (Opravený — neblokuje UI) ─────────────────────────
const ColorPicker = ({ value, onChange, label, t }: { value: string, onChange: (c: string) => void, label?: string, t: (k: string) => string }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const palette = ['#fbbf24', '#ef4444', '#ffffff']

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 8 }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title={label || t('ui.changeColor')}
        style={{ 
          width: 22, height: 16, borderRadius: 3, background: value, 
          border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: 9, filter: 'invert(1) grayscale(1) contrast(100)' }}>🎨</span>
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 1001,
          background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
          padding: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', gap: 6
        }}>
          {palette.map(c => (
            <div key={c} onClick={() => { onChange(c); setIsOpen(false) }}
              style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
          <input type="color" value={value} onChange={e => onChange(e.target.value)} onBlur={() => setIsOpen(false)}
            style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
      )}
    </div>
  )
}

// ─── Scale Bar UI Component (Stabilná — mimo Canvasu) ─────────────────────────
const ScaleBar = ({ cameraData }: { cameraData: { dist: number, fov: number, height: number } | null }) => {
  if (!cameraData) return null
  const { dist, fov, height } = cameraData
  const fovRad = fov * Math.PI / 180
  const visibleHeight = 2 * Math.tan(fovRad / 2) * dist
  const pixelsPerUnit = height / visibleHeight
  const targetPx = 100
  const targetUnits = targetPx / pixelsPerUnit
  const niceUnits = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
  let best = niceUnits[0]
  for (const u of niceUnits) if (Math.abs(u - targetUnits) < Math.abs(best - targetUnits)) best = u
  const width = best * pixelsPerUnit
  const label = best < 1 ? `${best * 100} cm` : `${best} m`
  return (
    <div style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 100 }}>
      <div style={{ fontSize: 9, color: '#fff', marginBottom: 1, textShadow: '0 1px 2px #000', fontWeight: 600 }}>{label}</div>
      <div style={{ width: `${width}px`, height: 3, border: '1px solid white', borderTop: 'none', background: 'rgba(255,255,255,0.2)' }} />
    </div>
  )
}

// ─── Processing Overlay (Zobrazí sa len ak operácia trvá > 0.5s) ────────────────
const ProcessingOverlay = ({ info, lang }: { info: string | null, lang: string }) => {
  if (!info) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, transition: 'all 0.3s ease'
    }}>
      <div style={{
        background: '#1e293b', padding: '24px 40px', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
      }}>
        <div className="processing-spinner" style={{
          width: 40, height: 40, border: '3px solid rgba(79, 195, 247, 0.1)',
          borderTopColor: '#4fc3f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}>{info}</div>
        <div style={{ color: '#64748b', fontSize: 11 }}>{lang === 'sk' ? 'Toto môže trvať chvíľu pri veľkých modeloch...' : 'This may take a while for large models...'}</div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome')
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null)
  const [showStationCard, setShowStationCard] = useState(false)
  const [activeProfilePoints, setActiveProfilePoints] = useState<SelStation[] | null>(null)
  const [cave, setCave] = useState<ParsedCave | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedStations, setSelectedStations] = useState<SelStation[]>([])
  const [isMeasuringMode, setIsMeasuringMode] = useState(false)
  const [man1, setMan1] = useState('')
  const [man2, setMan2] = useState('')
  const [surfPointCache, setSurfPointCache] = useState<Record<string, SelStation>>({})
  const [fitTrigger, setFitTrigger] = useState(0)
  const [lang, setLang] = useState<Language>(getBrowserLanguage())
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [manualMatches, setManualMatches] = useState<any[] | null>(null)

  const t = useCallback((key: string) => getTranslation(lang, key), [lang])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isModelMoving, setIsModelMoving] = useState(false)
  const [cameraData, setCameraData] = useState<{ dist: number, fov: number, height: number } | null>(null)
  const [processingInfo, setProcessingInfo] = useState<string | null>(null)
  const [currentTheme, setCurrentTheme] = useState<string>('precision')
  const surfNextId = useRef(1)
  const [opts, setOpts] = useState<ViewerOptions>({
    showSplay:           false,
    showStations:        true,
    showStationNames:    false,
    showStationAlt:      false,
    showEntrances:       true,
    showEntranceLabels:  true,
    showGrid:            true,
    colorGrid:           '#222222',
    colorBoundingBox:    '#990000',
    showBoundingBox:     false,
    colorBackground:     '#0a0f1a',
    // Cave scraps
    showScraps:          true,
    scrapsOpacity:       0.75,
    scrapsSolid:         true,
    scrapsWireframe:     false,
    scrapsAltitude:      true,   // farebné podľa výšky
    smoothScraps:        false,
    showRenderCave:      false,
    caveTexture:         'rock',
    renderOpacity:       1.0,
    placedCaver:         null,
    // Cave traverse
    showTraverse:        true,   // polygonový ťah
    traverseRadius:      0.1,     // polomer rúrky v m
    traverseAltitude:    true,   // farebné podľa výšky
    // Terrain surface
    showSurfaceMesh:     true,
    showSurfaceMeshWire: false,
    showSurfaceTexture:  true,
    showSurfaceNetwork:  false,
    surfaceOpacity:      0.8,
    surfaceColor:        '#e2e8f0',
    colorSplay:          '#78909c',
    colorTraverse:       '#4fc3f7',
    colorScraps:         '#2a5585',
    colorScrapsWire:     '#6a9fd8',
    colorStations:       '#fbbf24',
    colorStationNames:   '#fbbf24',
    colorStationAlt:     '#a5f3fc',
    colorTerrainWire:    '#6ab04c',
    // Clipping
    showClipping:        false,
    clippingHeight:      0,
    showProfileClipping: false,
    profileClipFlip:     false,
    profileClipOffset:   0,
    // Floor Map
    floorMapSvg:         null,
    floorMapTh2:         null,
    floorMapOpacity:     0.8,
    manualMatches:       null,
  })

  // ─── DEFINÍCIA ŠABLÓN ────────────────────────────────────────────────────────
  const THEMES = {
    classic: {
      colorBackground:   '#050505',
      colorTraverse:     '#ffffff',
      colorSplay:        '#78909c',
      colorStations:     '#fbbf24',
      colorStationNames: '#fbbf24',
      colorStationAlt:   '#a5f3fc',
      showEntrances: true,
      showEntranceLabels: true,
      colorGrid:         '#224422',
      colorScraps:       '#2a5585',
      colorScrapsWire:   '#6a9fd8',
      colorTerrainWire:  '#6ab04c',
      colorBoundingBox:  '#990000',
      surfaceColor:      '#e2e8f0',
    },
    precision: {
      colorBackground:   '#0a0f1a',
      colorTraverse:     '#ffffff',
      colorSplay:        '#a5f3fc',
      colorStations:     '#fbbf24',
      colorStationNames: '#fbbf24',
      colorStationAlt:   '#a5f3fc',
      showEntrances: true,
      showEntranceLabels: true,
      colorGrid:         '#161e2b',
      colorScraps:       '#2a5585',
      colorScrapsWire:   '#a5f3fc',
      colorTerrainWire:  '#1e293b',
      colorBoundingBox:  '#990000',
      surfaceColor:      '#dee2f2',
    },
    light: {
      colorBackground:   '#f8fafc',
      colorTraverse:     '#2a5585',
      colorSplay:        '#64748b',
      colorStations:     '#fbbf24',
      colorStationNames: '#1e293b',
      colorStationAlt:   '#0891b2',
      showEntrances: true,
      showEntranceLabels: true,
      colorGrid:         '#cbd5e1',
      colorScraps:       '#94a3b8',
      colorScrapsWire:   '#475569',
      colorTerrainWire:  '#166534',
      colorBoundingBox:  '#990000',
      surfaceColor:      '#ffffff',
    }
  }

  const applyTheme = (name: keyof typeof THEMES) => {
    setCurrentTheme(name)
    setOpts(prev => ({ ...prev, ...THEMES[name] }))
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastClickRef = useRef<{time: number, idx: number}>({time: 0, idx: -1})

  const handleStationClick = useCallback((idx: number, screenX: number, screenY: number, ctrlKey: boolean) => {
    if (!cave) return
    const now = Date.now()
    if (now - lastClickRef.current.time < 300 && lastClickRef.current.idx === idx) {
      return // Zamedzenie double-click bugu na ten istý bod
    }
    lastClickRef.current = { time: now, idx }

    const sl = cave.stationLabels[idx]
    if (!sl) return

    const origX = sl.pos.x + cave.centerOffset.x
    const origY = sl.pos.y + cave.centerOffset.y
    const altitude = sl.altitude

    let gps: { lat: number; lon: number; zone?: number; epsg?: string } | null = null;
    gps = tryUtmToWgs84(origX, origY);
    if (!gps) {
      gps = tryJtskToWgs84(origX, origY);
    }

    let distToSurf: number | null = null
    if (cave.surfaces?.length > 0) {
      const surf = cave.surfaces[0]
      const zSurf = sampleDtmAt(surf, origX, origY)
      if (zSurf !== null) distToSurf = zSurf - altitude
    }

    const newSt: SelStation = { 
      idx, name: sl.name, origX, origY, altitude, gps, distToSurf, screenX, screenY,
      centerX: cave.centerOffset.x, centerY: cave.centerOffset.y, centerZ: cave.centerOffset.z
    }
    
    setSelectedStations(prev => {
      // Ak meranie VYP a nie je stlačený CTRL, vždy vraciame len aktuálny bod
      if (!isMeasuringMode && !ctrlKey) return [newSt]

      // Zjednodušené ovládanie:
      // Ak máme už presne 1 bod, klik na ďalší ho nastaví ako druhý bod (bez ohľadu na CTRL).
      if (prev.length === 1 && prev[0].idx !== newSt.idx) {
        return [prev[0], newSt]
      }
      // Ak nemáme nič, alebo máme už 2 body zmerané, resetujeme na 1 nový bod merania.
      // Kliknutie na rovnaký bod (idx) slúži ako "zrušenie výberu" = vyberie ho len raz a začne sa od neho znova
      return [newSt]
    })
    setShowStationCard(true)
  }, [cave, isMeasuringMode])

  const handleSurfaceClick = useCallback((origX: number, origY: number, altitude: number, screenX: number, screenY: number, ctrlKey: boolean = false) => {
    if (!cave || (!isMeasuringMode && !ctrlKey)) return // Klik na terén berieme IBA v režime merania alebo s CTRL
    const now = Date.now()
    if (now - lastClickRef.current.time < 300 && lastClickRef.current.idx === -1) return
    lastClickRef.current = { time: now, idx: -1 }

    let gps: { lat: number; lon: number; zone?: number; epsg?: string } | null = null;
    gps = tryUtmToWgs84(origX, origY);
    if (!gps) {
      gps = tryJtskToWgs84(origX, origY);
    }

    const sid = `Z${surfNextId.current++}`
    const newSt: SelStation = {
      idx: -1,
      name: sid,
      origX, origY, altitude,
      gps, distToSurf: 0,
      screenX, screenY,
      centerX: cave.centerOffset.x, centerY: cave.centerOffset.y, centerZ: cave.centerOffset.z
    }
    
    setSurfPointCache(prev => ({ ...prev, [sid]: newSt }))

    setSelectedStations(prev => {
      if (!isMeasuringMode && !ctrlKey) return [newSt]
      if (prev.length === 1 && (prev[0].origX !== newSt.origX || prev[0].origY !== newSt.origY)) {
        return [prev[0], newSt]
      }
      return [newSt]
    })
    setShowStationCard(true)
  }, [cave, isMeasuringMode])

  // Manuálne meranie cez textové vstupy
  useEffect(() => {
    if (selectedStations.length > 0) {
      setMan1(selectedStations[0].name)
      if (selectedStations.length > 1) setMan2(selectedStations[1].name)
      else setMan2('')
    } else {
      setMan1('')
      setMan2('')
    }
  }, [selectedStations])

  const stationMeta = new Map<number, { name: string; z: number; isEntrance?: boolean }>()
  const findStationByName = (name: string): SelStation | null => {
    if (!name) return null
    if (surfPointCache[name]) return surfPointCache[name]
    if (!cave) return null
    const idx = cave.stationLabels.findIndex(sl => sl.name.toLowerCase() === name.toLowerCase())
    if (idx === -1) return null

    const sl = cave.stationLabels[idx]
    const origX = sl.pos.x + cave.centerOffset.x
    const origY = sl.pos.y + cave.centerOffset.y
    const altitude = sl.altitude

    let gps = tryUtmToWgs84(origX, origY) || tryJtskToWgs84(origX, origY) || null

    let distToSurf: number | null = null
    if (cave.surfaces?.length > 0) {
      const zSurf = sampleDtmAt(cave.surfaces[0], origX, origY)
      if (zSurf !== null) distToSurf = zSurf - altitude
    }
    return { 
      idx, name: sl.name, origX, origY, altitude, gps, distToSurf, 
      screenX: window.innerWidth/2 - 140, screenY: window.innerHeight/2 - 150,
      centerX: cave.centerOffset.x, centerY: cave.centerOffset.y, centerZ: cave.centerOffset.z
    }
  }

  const execManualMeasure = () => {
    const s1 = findStationByName(man1.trim())
    const s2 = findStationByName(man2.trim())
    if (!s1 || !s2) {
      setErrorMsg('Jeden alebo oba body zadané v meraní neboli nájdené!')
      setTimeout(() => setErrorMsg(null), 3500)
    } else {
      setSelectedStations([s1, s2])
      setShowStationCard(true)
    }
  }

  // particle background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number }
    const pts: P[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4, a: Math.random() * 0.4 + 0.08,
    }))

    let id: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,179,237,${p.a})`; ctx.fill()
      })
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize) }
  }, [])

  const getExt = (name: string) => '.' + name.split('.').pop()!.toLowerCase()

  const runParserWorker = useCallback((buffer: ArrayBuffer): Promise<ParsedCave> => {
    return new Promise((resolve, reject) => {
      // Vite 4/5 syntax pre worker
      const worker = new Worker(new URL('./parsers/parser.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data.type === 'done') resolve(e.data.cave);
        else reject(new Error(e.data.error || 'Worker parsing failed'));
        worker.terminate();
      };
      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
      // Transferable ArrayBuffer pre nulové oneskorenie pri kopírovaní dát
      worker.postMessage({ buffer }, [buffer]);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const ext = getExt(file.name)
    if (!['.lox', '.3d', '.plt'].includes(ext)) {
      setErrorMsg(`Nepodporovaný formát: ${ext}. Použite .lox, .3d alebo .plt`)
      return
    }
    setErrorMsg(null)
    setLoadedFile({ name: file.name, size: file.size, ext })
    setAppState('loading')
    setProgress(10)

    try {
      let parsed: ParsedCave

      if (ext === '.plt') {
        const text = await file.text()
        setProgress(50)
        parsed = parsePlt(text)
      } else {
        const buf = await file.arrayBuffer()
        setProgress(50)
        if (ext === '.lox') {
          parsed = await runParserWorker(buf)
        } else {
          parsed = parseSvx(buf)
        }
      }

      setProgress(95)

      if (parsed.segments.length === 0 && parsed.stations.length === 0) {
        throw new Error('Súbor neobsahuje žiadne merania alebo stanice.')
      }

      setCave(parsed)
      // Inicializovať výšku rezu na vrchol modelu
      setOpts(prev => ({ ...prev, clippingHeight: parsed.bounds.max.z + parsed.centerOffset.z }))
      setTimeout(() => { setProgress(100); setTimeout(() => setAppState('viewer'), 200) }, 100)
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Chyba pri načítaní: ' + (e?.message || String(e)))
      setAppState('error')
    }
  }, [])

  const handleSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    const ext = name.split('.').pop()
    
    if (ext === 'th2') {
      const text = await file.text()
      const { parseTh2 } = await import('./parsers/th2Parser')
      const parsed = parseTh2(text)
      setManualMatches(null)
      setOpts(prev => ({ ...prev, floorMapTh2: parsed, floorMapSvg: null, showFloorMap: true, manualMatches: null }))
    } else if (ext === 'pdf') {
      try {
        const pdfjs = await import('pdfjs-dist');
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height; canvas.width = viewport.width;
        await (page as any).render({ canvasContext: context!, viewport, canvas: canvas }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        setManualMatches(null);
        setOpts(prev => ({ ...prev, floorMapSvg: dataUrl, floorMapTh2: null, showFloorMap: true, manualMatches: null }));
        setIsCalibrating(true);
      } catch (err) { alert('Chyba pri spracovaní PDF'); }
    } else {
      const text = await file.text()
      setManualMatches(null)
      setOpts(prev => ({ ...prev, floorMapSvg: text, floorMapTh2: null, showFloorMap: true, manualMatches: null }))
    }
  }

  // Load from URL (for demo/test models served from public/)
  const loadFromUrl = useCallback(async (url: string, label: string) => {
    const ext = '.' + url.split('.').pop()!.toLowerCase()
    setErrorMsg(null)
    setLoadedFile({ name: label, size: 0, ext })
    setAppState('loading')
    setProgress(10)
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setProgress(40)
      const contentLength = Number(resp.headers.get('content-length') || 0)
      if (ext === '.plt') {
        const text = await resp.text()
        setProgress(60)
        const parsed = parsePlt(text)
        setLoadedFile({ name: label, size: text.length, ext })
        if (parsed.segments.length === 0 && parsed.stations.length === 0)
          throw new Error('Súbor neobsahuje žiadne dáta.')
        setCave(parsed)
      } else {
        const buf = await resp.arrayBuffer()
        setProgress(60)
        setLoadedFile({ name: label, size: buf.byteLength, ext })
        
        let parsed: ParsedCave
        if (ext === '.lox') {
          parsed = await runParserWorker(buf)
        } else {
          parsed = parseSvx(buf)
        }

        if (parsed.segments.length === 0 && parsed.stations.length === 0)
          throw new Error('Súbor neobsahuje žiadne dáta.')
        setCave(parsed)
      }
      setProgress(100)
      setTimeout(() => setAppState('viewer'), 150)
    } catch (e: any) {
      console.error(e)
      setErrorMsg('Chyba pri načítaní demo modelu: ' + (e?.message || String(e)))
      setAppState('error')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files[0]) handleFile(files[0])
  }, [handleFile])

  const handleReset = () => {
    setAppState('welcome'); setLoadedFile(null); setCave(null)
    setProgress(0); setErrorMsg(null)
  }

  const toggleOpt = (key: keyof ViewerOptions) =>
    setOpts(prev => ({ ...prev, [key]: !prev[key] }))

  // Compute stats for Legend
  const legendCave = useMemo(() => {
    if (!cave || (!opts.scrapsAltitude && !opts.traverseAltitude)) return null
    let minZ = Infinity, maxZ = -Infinity
    if (cave.scraps?.length) {
      for (const sc of cave.scraps) {
        for (const v of sc.vertices) {
          if (v.z < minZ) minZ = v.z
          if (v.z > maxZ) maxZ = v.z
        }
      }
    } else {
      minZ = cave.bounds.min.z
      maxZ = cave.bounds.max.z
    }
    if (minZ === Infinity) return null
    return {
      minAlt: minZ + cave.centerOffset.z,
      maxAlt: maxZ + cave.centerOffset.z
    }
  }, [cave, opts.scrapsAltitude, opts.traverseAltitude])

  const legendSurf = useMemo(() => {
    if (!cave || !opts.showSurfaceNetwork) return null
    let minZ = Infinity, maxZ = -Infinity
    if (cave.surfaces?.length > 0) {
      const d = cave.surfaces[0].dtm.data
      for(let i=0; i<d.length; i++){
        if (d[i] < minZ) minZ = d[i]
        if (d[i] > maxZ) maxZ = d[i]
      }
    }
    if (minZ === Infinity) return null
    return {
      minAlt: minZ,
      maxAlt: maxZ
    }
  }, [cave, opts.showSurfaceNetwork])

  const setOpacity = (key: 'scrapsOpacity' | 'surfaceOpacity' | 'floorMapOpacity', v: number) =>
    setOpts(prev => ({ ...prev, [key]: v }))

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : (bytes / 1024).toFixed(1) + ' KB'

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',system-ui,sans-serif;background:#050810;color:#e2e8f0;overflow:hidden}
        .bg-canvas{position:fixed;inset:0;pointer-events:none;z-index:0}

        /* WELCOME */
        .app{position:relative;z-index:1;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
        .welcome{display:flex;flex-direction:column;align-items:center;gap:2rem;padding:2rem;max-width:680px;width:100%}
        .logo-icon{font-size:4rem;filter:drop-shadow(0 0 28px rgba(99,179,237,.55));animation:float 4s ease-in-out infinite}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        .logo-title{font-size:2.8rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#63b3ed 0%,#9f7aea 50%,#63b3ed 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite}
        @keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}}
        .logo-sub{font-size:.85rem;color:#718096;margin-top:.3rem;letter-spacing:.08em;text-transform:uppercase}

        .dropzone{width:100%;border:2px dashed rgba(99,179,237,.3);border-radius:20px;padding:2.5rem 2rem;text-align:center;cursor:pointer;transition:all .25s ease;background:rgba(99,179,237,.03);position:relative;overflow:hidden}
        .dropzone:hover,.dropzone.over{border-color:rgba(99,179,237,.7);background:rgba(99,179,237,.08);transform:scale(1.01);box-shadow:0 0 40px rgba(99,179,237,.15)}
        .dz-icon{font-size:2.5rem;margin-bottom:.7rem;display:block}
        .dz-title{font-size:1.05rem;font-weight:600;margin-bottom:.3rem}
        .dz-sub{font-size:.82rem;color:#718096}
        .dz-or{margin:.9rem 0;color:#4a5568;font-size:.82rem}
        .btn-open{display:inline-flex;align-items:center;gap:.45rem;background:linear-gradient(135deg,#4299e1,#9f7aea);color:#fff;border:none;border-radius:10px;padding:.65rem 1.5rem;font-size:.875rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;box-shadow:0 4px 20px rgba(66,153,225,.3)}
        .btn-open:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(66,153,225,.45)}

        .formats{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;width:100%}
        .fmt-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.8rem;text-align:center;transition:all .2s}
        .fmt-card:hover{background:rgba(99,179,237,.06);border-color:rgba(99,179,237,.25);transform:translateY(-2px)}
        .fmt-icon{font-size:1.4rem;margin-bottom:.25rem}
        .fmt-label{font-size:.77rem;font-weight:600;color:#a0aec0}
        .fmt-ext{font-size:.72rem;color:#4a5568;margin-top:.1rem}

        .err-msg{width:100%;background:rgba(245,101,101,.12);border:1px solid rgba(245,101,101,.3);border-radius:10px;padding:.75rem 1rem;font-size:.85rem;color:#fc8181;display:flex;align-items:flex-start;gap:.5rem}
        input[type="file"]{display:none}

        /* LOADING */
        .loading-screen{display:flex;flex-direction:column;align-items:center;gap:1.4rem;padding:2rem;text-align:center}
        .load-icon{font-size:3.5rem;animation:pulse 1.4s ease-in-out infinite}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.7}}
        .load-title{font-size:1.35rem;font-weight:700}
        .load-file{font-size:.82rem;color:#718096;margin-top:.15rem}
        .prog-wrap{width:320px;background:rgba(255,255,255,.05);border-radius:100px;height:7px;overflow:hidden}
        .prog-bar{height:100%;border-radius:100px;background:linear-gradient(90deg,#4299e1,#9f7aea);transition:width .1s linear;box-shadow:0 0 10px rgba(99,179,237,.6)}
        .prog-pct{font-size:.82rem;color:#718096}

        /* VIEWER */
        .viewer-shell{width:100vw;height:100vh;display:flex;flex-direction:column;overflow:hidden}
        .topbar{height:50px;background:rgba(5,8,16,.95);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:1rem;padding:0 1.1rem;flex-shrink:0;backdrop-filter:blur(8px)}
        .tb-logo{font-size:1rem;font-weight:700;color:#63b3ed;white-space:nowrap}
        .tb-file{font-size:.77rem;color:#718096;background:rgba(255,255,255,.05);padding:.22rem .65rem;border-radius:6px;border:1px solid rgba(255,255,255,.08);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tb-badge{font-size:.7rem;font-weight:700;padding:.2rem .5rem;border-radius:4px;background:rgba(99,179,237,.15);color:#63b3ed;border:1px solid rgba(99,179,237,.3)}
        .tb-space{flex:1}
        .tb-stat{font-size:.75rem;color:#4a5568}
        .btn-back{display:flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#a0aec0;border-radius:8px;padding:.38rem .85rem;font-size:.78rem;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap}
        .btn-back:hover{background:rgba(255,255,255,.1);color:#e2e8f0}

        .viewer-body{flex:1;display:flex;overflow:hidden;position:relative}
        .canvas-wrap{flex:1;position:relative}

        /* Sidebar */
        .sidebar-container { display: flex; flex-shrink: 0; z-index: 100; }
        .sidebar{width:230px;background:rgba(8,12,24,.97);border-left:1px solid rgba(255,255,255,.05);padding:.9rem;display:flex;flex-direction:column;gap:1rem;overflow-y:auto;flex-shrink:0;height:100%;max-height:100%}
        .sidebar::-webkit-scrollbar{width:5px}
        .sidebar::-webkit-scrollbar-track{background:rgba(0,0,0,0.1)}
        .sidebar::-webkit-scrollbar-thumb{background:rgba(99,179,237,0.3);border-radius:10px}
        .sidebar::-webkit-scrollbar-thumb:hover{background:rgba(99,179,237,0.5)}
        .s-label{font-size:.62rem;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.45rem}
        .info-row{display:flex;justify-content:space-between;font-size:.75rem;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.04);color:#718096}
        .info-val{color:#63b3ed;font-weight:600}

        .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
        .toggle-label{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:#a0aec0;cursor:pointer}
        .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .switch{width:32px;height:17px;background:rgba(255,255,255,.1);border-radius:100px;position:relative;cursor:pointer;transition:background .2s;border:1px solid rgba(255,255,255,.1);flex-shrink:0}
        .switch.on{background:rgba(66,153,225,.6);border-color:rgba(66,153,225,.5)}
        .switch::after{content:'';position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
        .switch.on::after{transform:translateX(15px)}

        .slider-row{padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
        .slider-top{display:flex;justify-content:space-between;font-size:.76rem;color:#a0aec0;margin-bottom:.3rem}
        .slider-val{color:#63b3ed;font-weight:600}
        input[type=range]{width:100%;height:3px;-webkit-appearance:none;background:rgba(255,255,255,.1);border-radius:100px;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#4299e1;cursor:pointer;box-shadow:0 0 6px rgba(66,153,225,.5)}

        .btn-demo{background:rgba(99,179,237,.08);border:1px solid rgba(99,179,237,.25);color:#63b3ed;border-radius:8px;padding:.45rem 1rem;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
        .btn-demo:hover{background:rgba(99,179,237,.18);border-color:rgba(99,179,237,.5);transform:translateY(-1px)}

        .help-text{font-size:.72rem;color:#2d3748;line-height:1.6}
        .loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
        .loading-3d{font-size:.85rem;color:#4a5568}

        @media (max-width: 1023px) {
          .sidebar-container { display: none; }
          .sidebar-container.open { 
            display: flex; position: fixed; inset: 0; z-index: 9999; width: 100vw; height: 100vh;
            background: rgba(8,12,24,.96); backdrop-filter: blur(12px);
          }
          .sidebar { width: 100%; height: 100%; border-left: none; padding: 2rem 1.5rem; }
          .btn-menu { display: flex !important; }
          .tb-file, .tb-badge, .tb-stat { display: none; }
          .s-label { font-size: 0.9rem; margin-top: 1rem; color: #a0aec0; }
          .toggle-row, .slider-row, .info-row { padding: 0.8rem 0; font-size: 1rem; }
          .toggle-label { font-size: 1.05rem; }
          .switch { width: 44px; height: 24px; }
          .switch::after { width: 18px; height: 18px; top: 2px; left: 2px; }
          .switch.on::after { transform: translateX(20px); }
          .btn-back { font-size: 1rem; padding: 0.5rem 0.6rem; }
          .hide-mobile { display: none !important; }
          .hide-mobile-flex { display: none !important; }
          .btn-fit { display: none !important; }
        }
      `}</style>

      <canvas ref={canvasRef} className="bg-canvas" style={{ background: opts.colorBackground }} />

      <div className="app">

        {/* ── WELCOME ── */}
        {(appState === 'welcome' || appState === 'error') && (
          <div className="welcome">
            <div style={{ textAlign: 'center' }}>
              <div className="logo-icon">🏔️</div>
              <h1 className="logo-title">CaveView 3D</h1>
              <p className="logo-sub">{t('welcome.sub')}</p>
            </div>

            <div
              className={`dropzone${isDragging ? ' over' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false) }}
              onClick={() => fileInputRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <span className="dz-icon">📂</span>
              <p className="dz-title">{t('welcome.dzTitle')}</p>
              <p className="dz-sub">{t('welcome.dzSub')}</p>
              <div className="dz-or">— alebo —</div>
              <button
                className="btn-open"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                type="button"
              >
                📁 {t('welcome.selectFile')}
              </button>
              <input ref={fileInputRef} type="file" accept=".lox,.3d,.plt" onChange={e => {
                const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''
              }} />
            </div>

            {errorMsg && (
              <div className="err-msg" role="alert">⚠️ {errorMsg}</div>
            )}

            {/* Demo models */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.5rem', textAlign: 'center' }}>{t('welcome.demoTitle')}</div>
                <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center' }}>
                  <button className="btn-demo" onClick={() => loadFromUrl('/test_simple.lox', 'model-simple.lox')} type="button">
                    🗺️ Simple LOX
                  </button>
                  <button className="btn-demo" onClick={() => loadFromUrl('/test_model2.lox', 'model2.lox')} type="button">
                    🗺️ Model2 (scraps)
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: '#f56565', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.5rem', textAlign: 'center' }}>{t('welcome.stressTitle')}</div>
                <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center' }}>
                  <button className="btn-demo" style={{ borderColor: 'rgba(245,101,101,0.4)', color: '#feb2b2', background: 'rgba(245,101,101,0.05)' }} 
                    onClick={() => loadFromUrl('/zadiel.lox', 'zadiel.lox')} type="button">
                    🏔️ {t('welcome.bigModel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {appState === 'loading' && (
          <div className="loading-screen">
            <div className="load-icon">⛏️</div>
            <div>
              <div className="load-title">{t('ui.parsing')}</div>
              <div className="load-file">{loadedFile?.name}</div>
            </div>
            <div className="prog-wrap">
              <div className="prog-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="prog-pct">{progress}%</div>
          </div>
        )}

        {/* ── VIEWER ── */}
        {appState === 'viewer' && cave && (
          <div className="viewer-shell">
            {/* Top bar */}
            <div className="topbar">
              {/* Menu Button pre Mobily (prvá položka) */}
              <button className="btn-menu btn-back" style={{ display: 'none', marginRight: 8, background: 'rgba(255,255,255,0.15)', borderWidth: 0, padding: '0.4rem 0.7rem' }} onClick={() => setIsMobileMenuOpen(true)}>
                <span>☰</span>
              </button>

              <span className="tb-logo">CV 3D</span>
              <span className="tb-file" title={loadedFile?.name}>{loadedFile?.name}</span>
              <MemoizedStatusBadge isMoving={isModelMoving} />
              <span className="tb-badge hide-mobile">{loadedFile?.ext?.replace('.', '')?.toUpperCase()}</span>
              
              <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '2px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                {(['classic', 'precision', 'light'] as const).map(th => (
                  <button key={th} onClick={() => applyTheme(th as any)}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '9px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: currentTheme === th ? '#334155' : 'transparent',
                      color: currentTheme === th ? '#f8fafc' : '#64748b' }}>
                    {t(`themes.${th}`)}
                  </button>
                ))}
              </div>

              <div className="tb-space" />

              <button
                className={`btn-back hide-mobile-flex${isMeasuringMode ? ' active' : ''}`}
                style={{
                  background: isMeasuringMode ? '#6366f1' : 'rgba(99,179,237,0.1)',
                  color: isMeasuringMode ? '#fff' : '#63b3ed',
                  borderColor: isMeasuringMode ? '#818cf8' : 'rgba(99,179,237,0.3)',
                  marginRight: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => setIsMeasuringMode(!isMeasuringMode)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', display: 'block' }}>straighten</span>
                <span>{t('sidebar.measure')}</span>
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(30,41,59,0.5)', padding: '2px', borderRadius: '6px' }}>
                  {(['sk', 'en', 'fr', 'de'] as Language[]).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer',
                        background: lang === l ? '#6366f1' : 'transparent',
                        color: lang === l ? 'white' : '#94a3b8' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleReset}
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#94a3b8', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', display: 'block' }}>close</span>
                  <span>{t('ui.close')}</span>
                </button>
              </div>
            </div>

            <div className="viewer-body">
              <div className="canvas-wrap">
                <Suspense fallback={
                  <div className="loading-overlay">
                    <span className="loading-3d">{t('ui.init3d')}</span>
                  </div>
                }>
                  <CaveViewer3D
                    cave={cave}
                    options={opts}
                    onStationClick={handleStationClick}
                    onSurfaceClick={isMeasuringMode ? handleSurfaceClick : undefined}
                    onMoveStateChange={setIsModelMoving}
                    onCameraUpdate={setCameraData}
                    onProcessingStart={setProcessingInfo}
                    onProcessingEnd={() => setProcessingInfo(null)}
                    fitTrigger={fitTrigger}
                    selectedStations={selectedStations}
                    activeProfilePoints={activeProfilePoints}
                    manualConnection={
                      selectedStations.length === 2 && selectedStations[0] && selectedStations[1]
                        ? {
                            p1: { x: selectedStations[0].origX - cave.centerOffset.x, y: selectedStations[0].origY - cave.centerOffset.y, z: selectedStations[0].altitude - cave.centerOffset.z },
                            p2: { x: selectedStations[1].origX - cave.centerOffset.x, y: selectedStations[1].origY - cave.centerOffset.y, z: selectedStations[1].altitude - cave.centerOffset.z }
                          }
                        : null
                    }
                  />
                </Suspense>

                {/* Station detail card overlay */}
                {selectedStations.length > 0 && showStationCard && (
                  <StationDetailCard
                    stations={selectedStations}
                    onClose={() => setShowStationCard(false)}
                    onPlaceCaver={(pos, pose) => setOpts(p => ({ ...p, placedCaver: { pos, pose } }))}
                    onSetProfile={(sts) => {
                      setActiveProfilePoints([...sts])
                      setOpts(p => ({ ...p, showProfileClipping: true, profileClipOffset: 0 }))
                      setShowStationCard(false)
                    }}
                    t={t}
                  />
                )}
              </div>

              {/* Sidebar container */}
              <div className={`sidebar-container ${isMobileMenuOpen ? 'open' : ''}`}>
                <aside className="sidebar">
                  {isMobileMenuOpen && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#e2e8f0' }}>{t('sidebar.control')}</span>
                      <button className="btn-back" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>✖ {t('ui.close')}</button>
                    </div>
                  )}

                <div>
                  <div className="s-label">{t('file.title')}</div>
                  <div className="info-row"><span>{t('file.format')}</span><span className="info-val">{loadedFile?.ext.replace('.', '').toUpperCase()}</span></div>
                  <div className="info-row"><span>{t('file.segments')}</span><span className="info-val">{cave.segmentCount.toLocaleString()}</span></div>
                  <div className="info-row"><span>{t('file.stations')}</span><span className="info-val">{cave.stationCount.toLocaleString()}</span></div>
                  {cave.scrapCount > 0 && (
                    <div className="info-row"><span>{t('file.scraps')}</span><span className="info-val">{cave.scrapCount.toLocaleString()}</span></div>
                  )}
                </div>

                {/* ── ANALÝZA PRIESTOROVÝCH REZOV ── */}
                <div style={{ marginBottom: '20px' }}>
                    <div className="s-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', display: 'block' }}>content_cut</span>
                      <span>{t('clipping.title')}</span>
                    </div>
                    
                    <div style={{ padding: '12px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.5)' }}>
                      <div className="toggle-row" style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>{t('clipping.horiz')}</span>
                        <div className={`switch${opts.showClipping ? ' on' : ''}`}
                          onClick={() => toggleOpt('showClipping')} role="switch"
                          aria-checked={opts.showClipping} tabIndex={0}
                        />
                      </div>

                      {opts.showClipping && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '6px' }}>
                            <span>{t('clipping.height')}</span>
                            <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{opts.clippingHeight.toFixed(1)} m</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => setOpts(p => ({ ...p, clippingHeight: p.clippingHeight - 1 }))}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>-</button>
                            <input type="range" className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              min={cave.bounds.min.z + cave.centerOffset.z - 10} max={cave.bounds.max.z + cave.centerOffset.z + 10}
                              step={0.1} value={opts.clippingHeight} onChange={(e) => setOpts(p => ({ ...p, clippingHeight: parseFloat(e.target.value) }))} />
                            <button onClick={() => setOpts(p => ({ ...p, clippingHeight: p.clippingHeight + 1 }))}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</button>
                          </div>
                        </div>
                      )}

                      <div className="toggle-row">
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>{t('clipping.vert')}</span>
                        <div className={`switch${opts.showProfileClipping ? ' on' : ''}`}
                          onClick={() => toggleOpt('showProfileClipping')} role="switch"
                          aria-checked={opts.showProfileClipping} tabIndex={0}
                        />
                      </div>
                      
                      {opts.showProfileClipping && activeProfilePoints && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '6px' }}>
                            <span>{t('clipping.offset')}</span>
                            <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{opts.profileClipOffset.toFixed(1)} m</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <button onClick={() => setOpts(p => ({ ...p, profileClipOffset: p.profileClipOffset - 0.5 }))}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>-</button>
                            <input type="range" className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              min={-50} max={50} step={0.1} value={opts.profileClipOffset}
                              onChange={(e) => setOpts(p => ({ ...p, profileClipOffset: parseFloat(e.target.value) }))} />
                            <button onClick={() => setOpts(p => ({ ...p, profileClipOffset: p.profileClipOffset + 0.5 }))}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</button>
                          </div>

                          <button 
                            onClick={() => toggleOpt('profileClipFlip')}
                            style={{ width: '100%', padding: '6px', background: '#1e293b', color: '#94a3b8', fontSize: '10px', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', display: 'block' }}>swap_horiz</span>
                            <span>{t('clipping.flip')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                </div>

                {/* ── VRSTVY (survey) ── */}
                <div>
                  <div className="s-label">{t('survey.title')}</div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: opts.colorSplay }} />
                        {t('survey.splay')}
                        <ColorPicker t={t} value={opts.colorSplay} onChange={(c) => setOpts(p => ({ ...p, colorSplay: c }))} />
                      </label>
                      <div className={`switch${opts.showSplay ? ' on' : ''}`}
                        onClick={() => toggleOpt('showSplay')} role="switch"
                        aria-checked={opts.showSplay} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: opts.colorGrid }} />
                        {t('survey.grid')}
                        <ColorPicker t={t} value={opts.colorGrid} onChange={(c) => setOpts(p => ({ ...p, colorGrid: c }))} />
                      </label>
                      <div className={`switch${opts.showGrid ? ' on' : ''}`}
                        onClick={() => toggleOpt('showGrid')} role="switch"
                        aria-checked={opts.showGrid} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">{t('survey.bbox')}</label>
                      <div className={`switch${opts.showBoundingBox ? ' on' : ''}`}
                        onClick={() => toggleOpt('showBoundingBox')} role="switch"
                        aria-checked={opts.showBoundingBox} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">{t('survey.altitude')}</label>
                      <div className={`switch${opts.traverseAltitude ? ' on' : ''}`}
                        onClick={() => toggleOpt('traverseAltitude')} role="switch"
                        aria-checked={opts.traverseAltitude} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: opts.colorTraverse }} />
                        {t('survey.tubes')}
                        <ColorPicker t={t} value={opts.colorTraverse} onChange={(c) => setOpts(p => ({ ...p, colorTraverse: c }))} />
                      </label>
                      <div className={`switch${opts.showTraverse ? ' on' : ''}`}
                        onClick={() => toggleOpt('showTraverse')} role="switch"
                        aria-checked={opts.showTraverse} tabIndex={0} />
                    </div>

                    {opts.showTraverse && (
                      <div style={{ marginTop: '8px', padding: '0 4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>
                          <span>{t('survey.tubes')} - {t('terrain.wire').toLowerCase()}</span>
                          <span style={{ color: '#4fc3f7' }}>{(opts.traverseRadius * 100).toFixed(0)} cm</span>
                        </div>
                        <input type="range" min={0.01} max={1.5} step={0.01}
                          value={opts.traverseRadius}
                          onChange={e => setOpts(p => ({ ...p, traverseRadius: Number(e.target.value) }))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                      </div>
                    )}
                </div>

                {/* ── STENY JASKYNE (scraps) ── */}
                {cave.scrapCount > 0 && (
                  <div>
                    <div className="s-label">{t('cave.title')}</div>
                    <div className="toggle-row">
                      <label className="toggle-label">{t('cave.show')}</label>
                      <div className={`switch${opts.showScraps ? ' on' : ''}`}
                        onClick={() => toggleOpt('showScraps')} role="switch"
                        aria-checked={opts.showScraps} tabIndex={0} />
                    </div>

                    {opts.showScraps && (
                      <>
                        <div className="toggle-row">
                          <label className="toggle-label">{t('cave.organic')}</label>
                          <div className={`switch${opts.smoothScraps ? ' on' : ''}`}
                            onClick={() => toggleOpt('smoothScraps')} role="switch"
                            aria-checked={opts.smoothScraps} tabIndex={0} />
                        </div>
                        <div className="toggle-row">
                          <label className="toggle-label">{t('cave.render3d')}</label>
                          <div className={`switch${opts.showRenderCave ? ' on' : ''}`}
                            onClick={() => toggleOpt('showRenderCave')} role="switch"
                            aria-checked={opts.showRenderCave} tabIndex={0} />
                        </div>
                        {([
                          { key: 'scrapsSolid' as const, label: t('cave.mesh') },
                          { key: 'scrapsWireframe' as const, label: t('cave.wire') },
                          { key: 'scrapsAltitude' as const, label: t('cave.altitude') },
                        ] as const).map(({ key, label }) => (
                          <div className="toggle-row" key={key}>
                            <label className="toggle-label">{label}</label>
                            <div className={`switch${opts[key] ? ' on' : ''}`}
                              onClick={() => toggleOpt(key)} role="switch"
                              aria-checked={opts[key]} tabIndex={0} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                <div>
                  <div className="s-label">{t('cave.title')} (Mapy)</div>
                  <div className="file-input-row" style={{ margin: '0.8rem 0', display: 'flex', gap: '0.5rem' }}>
                    <label className="btn-secondary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer', fontSize: '11px', padding: '8px' }}>
                      {t('cave.floorMapUpload')}
                      <input type="file" accept=".svg,.th2,.pdf" onChange={handleSvgUpload} style={{ display: 'none' }} />
                    </label>
                    {(opts.floorMapSvg || opts.floorMapTh2) && (
                      <button className="btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '8px' }} onClick={() => setIsCalibrating(true)}>
                        {t('cave.manualCalibrate')}
                      </button>
                    )}
                  </div>
                  {(opts.floorMapSvg || opts.floorMapTh2) && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '6px' }}>
                        <span>{t('cave.floorMapOpacity')}</span>
                        <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{(opts.floorMapOpacity * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min={0} max={100} step={5}
                        value={Math.round(opts.floorMapOpacity * 100)}
                        onChange={e => setOpacity('floorMapOpacity', Number(e.target.value) / 100)}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  )}
                </div>

                {/* ── TERÉN (surface) ── */}
                {cave.hasSurface && (
                  <div>
                    <div className="s-label">{t('terrain.title')}</div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: opts.surfaceColor }} />
                        {t('terrain.shaded')}
                        <ColorPicker t={t} value={opts.surfaceColor} onChange={(c) => setOpts(p => ({ ...p, surfaceColor: c }))} />
                      </label>
                      <div className={`switch${opts.showSurfaceMesh ? ' on' : ''}`}
                        onClick={() => toggleOpt('showSurfaceMesh')} role="switch"
                        aria-checked={opts.showSurfaceMesh} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: opts.colorTerrainWire, border: '1px solid #4a7c3f' }} />
                        {t('terrain.wire')}
                        <ColorPicker t={t} value={opts.colorTerrainWire} onChange={(c) => setOpts(p => ({ ...p, colorTerrainWire: c }))} />
                      </label>
                      <div className={`switch${opts.showSurfaceMeshWire ? ' on' : ''}`}
                        onClick={() => toggleOpt('showSurfaceMeshWire')} role="switch"
                        aria-checked={opts.showSurfaceMeshWire} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: 'linear-gradient(180deg,#e53935 0%,#f9a825 33%,#43a047 66%,#1565c0 100%)', border: 'none' }} />
                        {t('terrain.network')}
                      </label>
                      <div className={`switch${opts.showSurfaceNetwork ? ' on' : ''}`}
                        onClick={() => toggleOpt('showSurfaceNetwork')} role="switch"
                        aria-checked={opts.showSurfaceNetwork} tabIndex={0} />
                    </div>
                    <div className="toggle-row">
                      <label className="toggle-label">
                        <div className="dot" style={{ background: '#8fbc8f', border: '1px solid #4a7c3f' }} />
                        {t('terrain.texture')}
                      </label>
                      <div className={`switch${opts.showSurfaceTexture ? ' on' : ''}`}
                        onClick={() => toggleOpt('showSurfaceTexture')} role="switch"
                        aria-checked={opts.showSurfaceTexture} tabIndex={0} />
                    </div>
                    
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '6px' }}>
                        <span>{t('terrain.opacity')}</span>
                        <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{(opts.surfaceOpacity * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min={5} max={100} step={5}
                        value={Math.round(opts.surfaceOpacity * 100)}
                        onChange={e => setOpacity('surfaceOpacity', Number(e.target.value) / 100)}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="s-label">{t('stations.title')}</div>
                  <div className="toggle-row">
                    <label className="toggle-label">
                      <div className="dot" style={{ background: opts.colorStations, border: '1px solid rgba(255,255,255,.2)' }} />
                      {t('stations.show')}
                      <ColorPicker t={t} value={opts.colorStations} onChange={(c) => setOpts(p => ({ ...p, colorStations: c }))} />
                    </label>
                    <div className={`switch${opts.showStations ? ' on' : ''}`}
                      onClick={() => toggleOpt('showStations')} role="switch"
                      aria-checked={opts.showStations} tabIndex={0} />
                  </div>
                  <div className="toggle-row">
                    <label className="toggle-label">
                      <div className="dot" style={{ background: opts.colorStationNames }} />
                      {t('stations.names')}
                      <ColorPicker t={t} value={opts.colorStationNames} onChange={(c) => setOpts(p => ({ ...p, colorStationNames: c }))} />
                    </label>
                    <div className={`switch${opts.showStationNames ? ' on' : ''}`}
                      onClick={() => toggleOpt('showStationNames')} role="switch"
                      aria-checked={opts.showStationNames} tabIndex={0} />
                  </div>
                  <div className="toggle-row">
                    <label className="toggle-label">
                      <div className="dot" style={{ background: opts.colorStationAlt }} />
                      {t('stations.altitude')}
                      <ColorPicker t={t} value={opts.colorStationAlt} onChange={(c) => setOpts(p => ({ ...p, colorStationAlt: c }))} />
                    </label>
                    <div className={`switch${opts.showStationAlt ? ' on' : ''}`}
                      onClick={() => toggleOpt('showStationAlt')} role="switch"
                      aria-checked={opts.showStationAlt} tabIndex={0} />
                  </div>
                  <div className="toggle-row">
                    <label className="toggle-label">
                      <div className="dot" style={{ background: '#fb8c00', border: '1px solid white' }} />
                      {t('stations.entrances')}
                    </label>
                    <div className={`switch${opts.showEntrances ? ' on' : ''}`}
                      onClick={() => toggleOpt('showEntrances')} role="switch"
                      aria-checked={opts.showEntrances} tabIndex={0} />
                  </div>
                  <div className="toggle-row">
                    <label className="toggle-label">{t('stations.entranceLabels')}</label>
                    <div className={`switch${opts.showEntranceLabels ? ' on' : ''}`}
                      onClick={() => toggleOpt('showEntranceLabels')} role="switch"
                      aria-checked={opts.showEntranceLabels} tabIndex={0} />
                  </div>
                </div>

                <div>
                  <div className="s-label">{t('ui.help')}</div>
                  <div className="help-text" style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.6', background: 'rgba(30,41,59,0.3)', padding: '8px', borderRadius: '6px' }}>
                    {t('ui.helpRotate')}<br />
                    {t('ui.helpPan')}<br />
                    {t('ui.helpZoom')}<br />
                    {t('ui.helpTouch')}
                  </div>
                </div>

                <div>
                  <div className="s-label">{t('legend.title')}</div>
                  {[
                    { color: '#4fc3f7', label: t('legend.cave') },
                    { color: '#78909c', label: t('legend.splay') },
                    { color: '#81c784', label: t('legend.surface') },
                  ].map(({ color, label }) => (
                    <div className="toggle-row" key={label} style={{ marginBottom: '4px' }}>
                      <div className="toggle-label">
                        <div className="dot" style={{ background: color }} />
                        <span style={{ fontSize: '11px' }}>{label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
            <ScaleBar cameraData={cameraData} />
            <ProcessingOverlay info={processingInfo} lang={lang} />
          </div>
        </div>
      )}
      {/* ── MANUÁLNA KALIBRÁCIA ── */}
      {isCalibrating && opts.floorMapSvg && cave && (
        <CalibrationModal 
          svgText={opts.floorMapSvg} 
          cave={cave}
          onCalibrate={(matches) => {
            setManualMatches(matches)
            setOpts(prev => ({ ...prev, manualMatches: matches }))
            setIsCalibrating(false)
          }}
          onClose={() => setIsCalibrating(false)}
        />
      )}
    </div>
    </>
  )
}
