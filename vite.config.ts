/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ZBGIS Ortofoto — GKÚ
      '/wms-proxy/orto': {
        target: 'https://zbgisws.skgeodesy.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/wms-proxy\/orto/, '/zbgis_ortofoto_wms/service.svc/get'),
      },
      // Geologická mapa — ags.geology.sk (WMS 1.1.1 ArcGIS)
      '/wms-proxy/geology': {
        target: 'https://ags.geology.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/wms-proxy\/geology/, '/arcgis/services/WebServices/GM50/MapServer/WMSServer'),
      },
      // ZBGIS DMR (Digital Terrain Model) — includes Hillshade
      '/wms-proxy/shadow': {
        target: 'https://zbgisws.skgeodesy.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/wms-proxy\/shadow/, '/zbgis_dmr_wms/service.svc/get'),
      },
      // XYZ Tile Proxies for scraping
      '/xyz-proxy/zbgis': {
        target: 'https://zbgis.skgeodesy.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/xyz-proxy\/zbgis/, '/zbgis/rest/services'),
      },
      '/xyz-proxy/freemap-orto': {
        target: 'https://ortofoto.tiles.freemap.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/xyz-proxy\/freemap-orto/, ''),
      },
      '/xyz-proxy/freemap-shading': {
        target: 'https://dmr5-shading.tiles.freemap.sk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/xyz-proxy\/freemap-shading/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
