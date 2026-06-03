import { describe, expect, it } from 'vitest';
import { buildMapProxyUrl, buildPhpProxyUrl } from '../mapProxyUrls';

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
});
