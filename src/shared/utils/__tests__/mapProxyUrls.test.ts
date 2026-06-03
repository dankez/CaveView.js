import { describe, expect, it } from 'vitest';
import { buildMapProxyUrl, buildMapProxyUrlCandidates, buildPhpProxyUrl, buildPublicCorsProxyUrls } from '../mapProxyUrls';

describe('mapProxyUrls', () => {
  it('keeps Vite proxy URLs for local development mode', () => {
    const url = buildMapProxyUrl(
      'zbgis',
      'Ortofoto/MapServer/tile/{z}/{y}/{x}',
      { blankTile: 'false' },
      '/xyz-proxy/zbgis/Ortofoto/MapServer/tile/{z}/{y}/{x}?blankTile=false',
      { mode: 'vite', appBase: '/' }
    );

    expect(url).toBe('/xyz-proxy/zbgis/Ortofoto/MapServer/tile/{z}/{y}/{x}?blankTile=false');
  });

  it('builds PHP proxy URLs for production hosting', () => {
    const url = buildMapProxyUrl(
      'zbgis',
      'Ortofoto/MapServer/tile/{z}/{y}/{x}',
      { blankTile: 'false' },
      '/xyz-proxy/zbgis/Ortofoto/MapServer/tile/{z}/{y}/{x}?blankTile=false',
      { mode: 'php', appBase: '/' }
    );

    expect(url).toBe('/map-proxy.php?source=zbgis&path=Ortofoto%2FMapServer%2Ftile%2F{z}%2F{y}%2F{x}&blankTile=false');
  });

  it('honors subdirectory deployments', () => {
    const url = buildPhpProxyUrl(
      'freemap-orto',
      '{z}/{x}/{y}.jpg',
      {},
      { appBase: '/viewer/' }
    );

    expect(url).toBe('/viewer/map-proxy.php?source=freemap-orto&path={z}%2F{x}%2F{y}.jpg');
  });

  it('allows an external proxy base', () => {
    const url = buildPhpProxyUrl(
      'geology',
      '',
      { service: 'WMS', bbox: '{bbox}', crs: 'EPSG:5514' },
      { proxyBase: 'https://tiles.example.com/proxy/' }
    );

    expect(url).toBe('https://tiles.example.com/proxy/map-proxy.php?source=geology&service=WMS&bbox={bbox}&crs=EPSG%3A5514');
  });

  it('builds direct, same-origin proxy, and public CORS fallback candidates', () => {
    const candidates = buildMapProxyUrlCandidates(
      'zbgis',
      'LLS_DMR5/MapServer/tile/{z}/{y}/{x}',
      { blankTile: 'false' },
      '/xyz-proxy/zbgis/LLS_DMR5/MapServer/tile/{z}/{y}/{x}?blankTile=false',
      'https://zbgis.skgeodesy.sk/zbgis/rest/services/LLS_DMR5/MapServer/tile/{z}/{y}/{x}?blankTile=false',
      { mode: 'php', appBase: '/' }
    );

    expect(candidates[0]).toBe('https://zbgis.skgeodesy.sk/zbgis/rest/services/LLS_DMR5/MapServer/tile/{z}/{y}/{x}?blankTile=false');
    expect(candidates[1]).toBe('/map-proxy.php?source=zbgis&path=LLS_DMR5%2FMapServer%2Ftile%2F{z}%2F{y}%2F{x}&blankTile=false');
    expect(candidates).toHaveLength(6);
  });

  it('preserves placeholders inside public CORS proxy URL patterns', () => {
    const candidates = buildPublicCorsProxyUrls('https://tiles.example.com/{z}/{x}/{y}.jpg?bbox={bbox}');

    expect(candidates[0]).toContain('{z}');
    expect(candidates[0]).toContain('{bbox}');
    expect(candidates[1]).toContain('{x}');
    expect(candidates[2]).toContain('{y}');
    expect(candidates[3]).toContain('{z}/{x}/{y}.jpg?bbox={bbox}');
  });
});
