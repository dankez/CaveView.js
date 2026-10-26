import React, { useState, useEffect } from 'react';
import type { ParsedCave } from '@shared/types';
import type { Language } from '@shared/i18n';
import { guessCaveCoordinates } from '@shared/utils/dmrDownloader';

interface Dmr5DownloadPanelProps {
  cave?: ParsedCave | null;
  lang: Language;
  onDownload: (lat: number, lon: number, extentMeters: number) => Promise<void>;
  isDownloading: boolean;
  lastDownloadedDmr: {
    tifBuffer: ArrayBuffer;
    tfwText: string;
    filename: string;
    minZ: number;
    maxZ: number;
    width: number;
    height: number;
  } | null;
  onSaveFiles: () => void;
}

export function Dmr5DownloadPanel({
  cave,
  lang,
  onDownload,
  isDownloading,
  lastDownloadedDmr,
  onSaveFiles,
}: Dmr5DownloadPanelProps) {
  const isSk = lang === 'sk';

  // Inicializácia zo známych GPS súradníc jaskyne
  const initialGps = guessCaveCoordinates(cave);
  const [latStr, setLatStr] = useState<string>(initialGps ? initialGps.lat.toFixed(6) : '48.665276');
  const [lonStr, setLonStr] = useState<string>(initialGps ? initialGps.lon.toFixed(6) : '20.817054');
  const [extent, setExtent] = useState<number>(500);

  // Aktualizácia pri zmene jaskyne
  useEffect(() => {
    const coords = guessCaveCoordinates(cave);
    if (coords) {
      setLatStr(coords.lat.toFixed(6));
      setLonStr(coords.lon.toFixed(6));
    }
  }, [cave]);

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const isValidCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat >= 47.0 && lat <= 50.0 && lon >= 16.0 && lon <= 23.0;

  const handleDownloadClick = async () => {
    if (!isValidCoords || isDownloading) return;
    await onDownload(lat, lon, extent);
  };

  const getSourceLabel = () => {
    if (!initialGps) return isSk ? '📍 Ručne zadané GPS' : '📍 Manual GPS';
    if (initialGps.source === 'entrance_gps') {
      return isSk ? `📍 Vchod (${initialGps.stationName || 'GPS'})` : `📍 Entrance (${initialGps.stationName || 'GPS'})`;
    }
    if (initialGps.source === 'station_gps') {
      return isSk ? `📍 Stanica (${initialGps.stationName || 'GPS'})` : `📍 Station (${initialGps.stationName || 'GPS'})`;
    }
    return isSk ? '📍 Model (prepočítané z jaskyne)' : '📍 Model (reprojected)';
  };

  return (
    <div className="cad-subcard" style={{ padding: '8px 10px', marginTop: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#f59e0b' }} aria-hidden="true">
            cloud_download
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
            {isSk ? 'DMR 5.0 (GKÚ LiDAR SR)' : 'DMR 5.0 (GKÚ LiDAR)'}
          </span>
        </div>
        <span style={{ fontSize: '8.5px', color: 'var(--cv-text-muted)', fontFamily: 'var(--cv-font-mono)' }}>
          WCS 2.0.1 · 1 m
        </span>
      </div>

      <p style={{ fontSize: '9px', color: 'var(--cv-text-muted)', margin: '0 0 8px 0', lineHeight: 1.35 }}>
        {isSk
          ? 'Stiahnutie oficiálneho digitálneho modelu reliéfu SR (DMR 5.0) zo štátnej služby INSPIRE OGC WCS (1 m raster).'
          : 'Download official Slovak digital terrain model (DMR 5.0) from state INSPIRE OGC WCS service (1 m raster).'}
      </p>

      {/* Zdroj súradníc */}
      <div style={{ fontSize: '9px', color: 'var(--cv-primary)', marginBottom: '6px', fontWeight: 600 }}>
        {getSourceLabel()}
      </div>

      {/* Vstupy Lat / Lon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--cv-text-muted)', display: 'block', marginBottom: '2px' }}>
            Lat (°N)
          </label>
          <input
            type="number"
            step="0.000001"
            value={latStr}
            onChange={(e) => setLatStr(e.target.value)}
            disabled={isDownloading}
            style={{
              width: '100%',
              fontSize: '10px',
              fontFamily: 'var(--cv-font-mono)',
              padding: '3px 6px',
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${isValidCoords ? 'var(--cv-border)' : '#f87171'}`,
              borderRadius: '4px',
              color: 'var(--cv-text)',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--cv-text-muted)', display: 'block', marginBottom: '2px' }}>
            Lon (°E)
          </label>
          <input
            type="number"
            step="0.000001"
            value={lonStr}
            onChange={(e) => setLonStr(e.target.value)}
            disabled={isDownloading}
            style={{
              width: '100%',
              fontSize: '10px',
              fontFamily: 'var(--cv-font-mono)',
              padding: '3px 6px',
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${isValidCoords ? 'var(--cv-border)' : '#f87171'}`,
              borderRadius: '4px',
              color: 'var(--cv-text)',
            }}
          />
        </div>
      </div>

      {/* Výber rozsahu (Extent) */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <span style={{ fontSize: '9px', color: 'var(--cv-text-muted)' }}>
            {isSk ? 'Rozsah výseku' : 'Tile extent'}
          </span>
          <span style={{ fontSize: '9px', fontFamily: 'var(--cv-font-mono)', color: 'var(--cv-primary)' }}>
            {extent} × {extent} m ({extent * extent / 10000} ha)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {[300, 500, 1000, 2000].map((ext) => (
            <button
              key={ext}
              type="button"
              className={`btn-mini ${extent === ext ? 'active' : ''}`}
              style={{
                fontSize: '9px',
                padding: '2px 0',
                background: extent === ext ? 'rgba(245, 158, 11, 0.2)' : undefined,
                borderColor: extent === ext ? '#f59e0b' : undefined,
                color: extent === ext ? '#f59e0b' : undefined,
              }}
              onClick={() => setExtent(ext)}
              disabled={isDownloading}
            >
              {ext >= 1000 ? `${ext / 1000} km` : `${ext} m`}
            </button>
          ))}
        </div>
      </div>

      {/* Akčné tlačidlo Stiahnuť */}
      <button
        type="button"
        className="btn-mini"
        onClick={handleDownloadClick}
        disabled={!isValidCoords || isDownloading}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontWeight: 600,
          background: isDownloading ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)',
          borderColor: '#f59e0b',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: isDownloading || !isValidCoords ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
          {isDownloading ? 'hourglass_top' : 'download'}
        </span>
        <span>
          {isDownloading
            ? (isSk ? 'Sťahujem DMR 5.0 (WCS)...' : 'Downloading DMR 5.0...')
            : (isSk ? 'Stiahnuť a zobraziť povrch' : 'Download & View Terrain')}
        </span>
      </button>

      {/* Štatistika a export naposledy stiahnutého modelu */}
      {lastDownloadedDmr && (
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed rgba(245, 158, 11, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--cv-text-muted)' }}>{isSk ? 'Prevýšenie:' : 'Elevation range:'}</span>
            <span style={{ fontFamily: 'var(--cv-font-mono)', color: '#38bdf8', fontWeight: 600 }}>
              {lastDownloadedDmr.minZ.toFixed(1)} – {lastDownloadedDmr.maxZ.toFixed(1)} m
            </span>
          </div>
          <button
            type="button"
            className="btn-mini"
            onClick={onSaveFiles}
            style={{
              width: '100%',
              fontSize: '9px',
              padding: '4px',
              color: '#10b981',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            title={isSk ? 'Uložiť stiahnutý GeoTIFF a World File do počítača' : 'Save downloaded GeoTIFF and World File to PC'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>save_alt</span>
            <span>{isSk ? 'Uložiť .tif + .tfw do PC' : 'Save .tif + .tfw to PC'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
