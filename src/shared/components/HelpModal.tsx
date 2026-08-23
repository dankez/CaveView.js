import React, { useState, useMemo } from 'react'

export interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  initialLang?: 'sk' | 'en' | 'fr' | 'de'
}

type TabKey = 'basics' | 'nav' | 'splays' | 'measuring' | 'clipping' | 'lidar' | 'terrain' | 'share'

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  initialLang = 'sk'
}) => {
  const [lang, setLang] = useState<'sk' | 'en'>(initialLang === 'sk' ? 'sk' : 'en')
  const [activeTab, setActiveTab] = useState<TabKey>('basics')
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const isSk = lang === 'sk'

  return (
    <div 
      className="share-overlay"
      style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div 
        className="plan-map-dialog"
        style={{ 
          maxWidth: '850px', 
          width: '94vw', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          background: '#0f172a',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.15)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📖</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
                {isSk ? 'LochViewer — Používateľská príručka' : 'LochViewer — User Guide'}
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {isSk ? 'Kompletný sprievodca funkciami a ovládacími prvkami v2.4.15' : 'Comprehensive guide to tools, shortcuts & workflows v2.4.15'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Language Switcher */}
            <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.7)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setLang('sk')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: isSk ? '#3b82f6' : 'transparent',
                  color: isSk ? '#fff' : '#94a3b8'
                }}
              >
                🇸🇰 SK
              </button>
              <button
                onClick={() => setLang('en')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: !isSk ? '#3b82f6' : 'transparent',
                  color: !isSk ? '#fff' : '#94a3b8'
                }}
              >
                🇬🇧 EN
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          background: 'rgba(30, 41, 59, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '4px 12px',
          gap: '4px'
        }}>
          {[
            { id: 'basics', icon: '📁', labelSk: 'Formáty a Lišta', labelEn: 'Formats & Topbar' },
            { id: 'nav', icon: '🧭', labelSk: 'Navigácia & Skratky', labelEn: 'Navigation & Shortcuts' },
            { id: 'splays', icon: '🕳️', labelSk: 'Splay 3D Steny', labelEn: 'Splay 3D Walls' },
            { id: 'measuring', icon: '📐', labelSk: 'Meranie & Tektonika', labelEn: 'Measuring & Tectonics' },
            { id: 'clipping', icon: '✂️', labelSk: 'Rezy Z-Clip', labelEn: 'Z-Clipping' },
            { id: 'lidar', icon: '☁️', labelSk: 'LiDAR NextGen', labelEn: 'LiDAR NextGen' },
            { id: 'terrain', icon: '🏔️', labelSk: 'Terén & ZBGIS', labelEn: 'Terrain & ZBGIS' },
            { id: 'share', icon: '🔗', labelSk: 'Zdieľanie & Embed', labelEn: 'Share & Embed' },
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabKey)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#3b82f6' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                <span>{tab.icon}</span>
                <span>{isSk ? tab.labelSk : tab.labelEn}</span>
              </button>
            )
          })}
        </div>

        {/* Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          color: '#e2e8f0',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          {activeTab === 'basics' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>📁 {isSk ? 'Podporované formáty & Spustenie' : 'Supported Formats & Loading'}</h3>
              <p>
                {isSk 
                  ? 'LochViewer spracováva 3D dáta priamo v prehliadači prostredníctvom WebGL a paralelných Web Workerov (100% lokálne a bezpečne bez odosielania na externé servery).'
                  : 'LochViewer parses and renders 3D cave data directly in your browser via WebGL and Web Workers (100% client-side, zero cloud telemetry).'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '14px' }}>
                {[
                  { ext: '.lox', name: 'Therion / Loch', descSk: '3D polygóny, scraps, splays, DTM a textúry', descEn: '3D centerlines, scraps, splays, DTM and textures' },
                  { ext: '.3d', name: 'Survex', descSk: 'Polygónové ťahy a podzemné stanice', descEn: 'Underground cave traverse surveys' },
                  { ext: '.plt', name: 'Compass', descSk: 'Zamerané traverzy a shoty', descEn: 'Compass cave survey files' },
                  { ext: '.ply', name: 'LiDAR Point Cloud', descSk: 'Milióny bodov, RGB farby, intenzita', descEn: 'Dense point clouds, RGB colors, intensity' },
                  { ext: '.stl', name: '3D Mesh', descSk: 'Triangulované siete z fotogrametrie a skenovania', descEn: 'Triangulated mesh models from 3D scans' },
                  { ext: '.tif/.tfw', name: 'GeoTIFF / DMR5', descSk: 'Digitálny model terénu SR v S-JTSK', descEn: 'Digital elevation models & aerial orthophotos' },
                ].map(f => (
                  <div key={f.ext} style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ background: '#3b82f6', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>{f.ext}</span>
                      <strong style={{ fontSize: '12px', color: '#f8fafc' }}>{f.name}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{isSk ? f.descSk : f.descEn}</div>
                  </div>
                ))}
              </div>

              <h4 style={{ color: '#38bdf8', marginTop: '20px' }}>🧭 {isSk ? 'Horná piktogramová lišta' : 'Top Bar Controls'}</h4>
              <p>
                {isSk 
                  ? 'Všetky nástroje v hornej lište obsahujú prehľadné ikony s okamžitou odozvou:'
                  : 'All essential tools in the clean top bar are accessible with a single click:'}
              </p>
              <ul style={{ paddingLeft: '20px', color: '#cbd5e1', fontSize: '12px' }}>
                <li><strong>📷 Export PNG</strong> — {isSk ? 'Snímka vo vysokom rozlíšení so severkou a mierkou' : 'High-res screenshot with compass & scale'}</li>
                <li><strong>🧊/📐 Projekcia (O)</strong> — {isSk ? 'Prepínač Perspektíva ↔ Ortogonálne zobrazenie' : 'Perspective ↔ Orthographic camera toggle'}</li>
                <li><strong>⛶ Zoom to Fit (F)</strong> — {isSk ? 'Vycentrovanie jaskyne do zorného poľa' : 'Recenter and fit model to screen'}</li>
                <li><strong>📈 Centerline (C)</strong> — {isSk ? 'Kostra polygonálneho ťahu a staníc' : 'Survey centerline traverse network'}</li>
                <li><strong>🪨 Steny (W)</strong> — {isSk ? 'Plné 3D steny (Scraps, Splay SDF, STL)' : '3D cave wall meshes'}</li>
                <li><strong>🏔️ Terén (T)</strong> — {isSk ? 'Nadložný povrch, DMR tieňovanie a ortofotomapa' : 'Overhead surface terrain & orthophoto'}</li>
                <li><strong>✂️ Z-Clip (Z)</strong> — {isSk ? 'Horizontálny posuvník rezu nadmorskej výšky' : 'Floating horizontal slicing plane'}</li>
                <li><strong>📏 Meranie (M)</strong> — {isSk ? '3-Stavový cyklický merací nástroj' : '3-State measurement & polygon area'}</li>
              </ul>
            </div>
          )}

          {activeTab === 'nav' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>🧭 {isSk ? 'Navigácia & Klávesové skratky' : 'Navigation & Shortcuts'}</h3>
              <p>
                {isSk
                  ? 'LochViewer podporuje plynulú navigáciu myšou, dotykovými gestami aj rýchlymi klávesovými skratkami pre technické mapovanie.'
                  : 'LochViewer supports smooth mouse navigation, touch gestures, and 1-key technical view presets for precision cave mapping.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>🖱️ {isSk ? 'Ovládanie myšou' : 'Mouse Controls'}</h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                    <li><strong>{isSk ? 'Ľavé tlačidlo' : 'Left Click'}</strong>: {isSk ? 'Orbitálna rotácia' : 'Orbit rotate'}</li>
                    <li><strong>{isSk ? 'Pravé tlačidlo' : 'Right Click'}</strong>: {isSk ? 'Posun (Pan)' : 'Pan view'}</li>
                    <li><strong>{isSk ? 'Koliesko' : 'Wheel'}</strong>: {isSk ? 'Plynulý Zoom' : 'Smooth Zoom'}</li>
                    <li><strong>{isSk ? 'Dvojklik' : 'Double Click'}</strong>: {isSk ? 'Prelet kamery k bodu' : 'Flight to point'}</li>
                    <li><strong>{isSk ? 'Klik na ružicu' : 'Click Compass'}</strong>: {isSk ? 'Zarovnať na Sever' : 'Snap to North'}</li>
                  </ul>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>⌨️ {isSk ? 'Klávesové skratky' : 'Keyboard Shortcuts'}</h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>1</kbd> — {isSk ? 'Pôdorys (Plan View)' : 'Plan View (Top)'}</li>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>2</kbd> — {isSk ? 'Pozdĺžny profil (Profile)' : 'Profile View (Front)'}</li>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>3</kbd> — {isSk ? 'Priečny profil (Section)' : 'Cross Section (Side)'}</li>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>4</kbd> — {isSk ? '3D Izometria' : '3D Isometric view'}</li>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>O</kbd> — {isSk ? 'Ortogonál ↔ Perspektíva' : 'Ortho ↔ Perspective'}</li>
                    <li><kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', border: '1px solid #475569' }}>Ctrl+Z</kbd> — {isSk ? 'Späť v histórii pohľadov' : 'Undo navigation flight'}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'splays' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>🕳️ {isSk ? 'Splay SDF 3D Steny (Marching Cubes)' : 'Splay SDF 3D Cave Walls'}</h3>
              <p>
                {isSk
                  ? 'Revolučný algoritmus Signed Distance Fields (SDF), ktorý priamo z laserových lúčov (splays) automaticky vypočíta uzavretú, hladkú a nepriepustnú 3D sieť chodieb.'
                  : 'Automated volumetric Signed Distance Field (SDF) and parallel Marching Cubes algorithm reconstructing watertight 3D passage walls from raw laser splay rays.'}
              </p>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', marginTop: '12px' }}>
                <strong style={{ color: '#93c5fd' }}>{isSk ? 'Hlavné výhody:' : 'Key Highlights:'}</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                  <li><strong>{isSk ? 'Bisektorová rovina' : 'Bisector Normal Plane'}</strong>: {isSk ? 'Zamedzuje prekrývaniu a kolíziám lúčov medzi susednými stanicami.' : 'Eliminates overlapping cone artifacts between adjacent stations.'}</li>
                  <li><strong>{isSk ? 'Pamäťová Cache' : 'Session Cache'}</strong>: {isSk ? 'Vygenerovaná sieť je uložená v RAM — zapínanie a vypínanie je bleskové.' : 'Calculated mesh is cached in RAM for zero-latency toggling.'}</li>
                  <li><strong>{isSk ? 'Farbenie podľa výšky' : 'Color by Height'}</strong>: {isSk ? 'Plná podpora hypsometrickej speleologickej škály.' : 'Full support for elevation hypsometric gradients.'}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'measuring' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>📐 {isSk ? 'Meranie & Štruktúrna geológia' : 'Measurement & Structural Geology'}</h3>
              <p>
                {isSk
                  ? 'Kliknutím na ikonu pravítka v hornej lište cyklujete medzi režimami merania. Otvorí sa presúvateľný panel (MeasurementPanel):'
                  : 'Click the ruler icon to cycle measurement modes. A draggable floating dock appears with comprehensive readouts:'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 6px 0', color: '#a5b4fc' }}>📏 {isSk ? 'Vzdialenosť (2 Body)' : 'Distance (2 Points)'}</h4>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                    {isSk ? '3D priama vzdialenosť, horizontálny priemet, prevýšenie ΔH, azimut a sklon spojnice.' : 'True 3D distance, horizontal distance, elevation difference ΔH, azimuth, and inclination.'}
                  </p>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 6px 0', color: '#c084fc' }}>⛏️ {isSk ? 'Tektonika (3 Body)' : 'Tectonics (3 Points)'}</h4>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                    {isSk ? 'Výpočet sklonu roviny (Dip), azimutu spádnice (Dip Direction), smeru vrstvy (Strike) a 3D zobrazenie disku roviny.' : 'Calculates true dip angle, dip direction, strike line, and displays interactive 3D planar disc.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clipping' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>✂️ {isSk ? 'Horizontálne rezy (Z-Clipping)' : 'Horizontal Z-Clipping'}</h3>
              <p>
                {isSk
                  ? 'Kliknutím na nožnice ✂️ sa v pravom hornom rohu vysunie plávajúci posuvník. Posúvaním plynulo zrezávate nadložie modelu s okamžitým zobrazením presnej nadmorskej výšky rezu.'
                  : 'Click the scissors icon ✂️ to reveal the floating Z-slice slider. Dynamically slice horizontal cave tiers with live elevation readout.'}
              </p>
            </div>
          )}

          {activeTab === 'lidar' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>☁️ {isSk ? 'LiDAR Point Cloud (Engine v2)' : 'LiDAR Point Cloud (Engine v2)'}</h3>
              <p>
                {isSk
                  ? 'Špecializovaný motor pre laserové skeny (.ply) s miliónmi bodov. Využíva Octree LOD streaming (60 FPS) a Eye-Dome Lighting (EDL) post-processing pre plastické tieňovanie detailov.'
                  : 'High-performance engine for massive point clouds (.ply) with Octree streaming (60 FPS) and Eye-Dome Lighting (EDL) depth shading.'}
              </p>
              <ul style={{ paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                <li><strong>{isSk ? 'Guma & Štetec' : 'Eraser & Brush'}</strong>: {isSk ? 'Interaktívne vymazanie šumu a vegetácie.' : 'Interactively erase scan noise or vegetation.'}</li>
                <li><strong>{isSk ? '2D Pôdorysná mapa' : '2D Plan Map'}</strong>: {isSk ? 'Generovanie a PNG export ortofoto mapy z hustoty bodov.' : 'Generate high-resolution PNG plan raster from point density.'}</li>
              </ul>
            </div>
          )}

          {activeTab === 'terrain' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>🏔️ {isSk ? 'Povrchový terén, WMS ZBGIS & Kalibrácia' : 'Terrain, ZBGIS WMS & Calibration'}</h3>
              <p>
                {isSk
                  ? 'Pripojenie na oficiálny štátny mapový WMS server GKÚ SR (Ortofoto a DMR 5.0 tieňovanie) a Mapbox 3D terén. Nástroj Kalibrácia umožňuje jemný 3D posun jaskyne voči povrchu v krokoch po 0.5 m.'
                  : 'Official Slovak Geodetic Institute (GKÚ ZBGIS) WMS integration, Mapbox 3D satellite surfaces, and 0.5m 3D cave-to-surface position calibration.'}
              </p>
            </div>
          )}

          {activeTab === 'share' && (
            <div>
              <h3 style={{ color: '#60a5fa', marginTop: 0 }}>🔗 {isSk ? 'Zdieľanie & Iframe Embed' : 'Sharing & Iframe Embedding'}</h3>
              <p>
                {isSk
                  ? 'Všetky nastavenia kamery, farieb, výšky rezu a filtrov sa v reálnom čase ukladajú do URL adresy. Cez tlačidlo Zdieľať môžete vygenerovať priamy odkaz alebo kód <iframe> pre vašu webstránku.'
                  : 'All visual states, slice heights, camera positions, and layer settings are preserved in shareable URLs and iframe embed codes.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94a3b8'
        }}>
          <div>
            LochViewer • Slovenská speleologická spoločnosť (SSS) • <a href="https://loch.sss.sk" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>loch.sss.sk</a>
          </div>
          <button
            onClick={onClose}
            className="share-copy-btn"
            style={{ flex: 0, padding: '6px 16px', background: '#3b82f6', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            {isSk ? 'Zavrieť' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
