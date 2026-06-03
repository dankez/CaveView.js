# Map Texture Cache and Inspector

## Purpose

Remote surface textures use many XYZ map tiles. Re-downloading the same model area is slow and also makes provider/proxy failures harder to diagnose. CaveView now keeps downloaded XYZ tiles in browser IndexedDB and exposes a small tile inspector in the surface texture controls.

## Runtime behavior

- XYZ sources use persistent browser cache by source id and tile coordinate: `source`, `zoom`, `x`, `y`.
- Cache is used for ZBGIS orthophoto, ZBGIS DMR hillshade, and Freemap orthophoto XYZ textures.
- WMS sources, currently the geology layer, are not cached as individual tiles because they are downloaded as one rendered map image.
- If IndexedDB is unavailable, the downloader silently falls back to network downloads.
- Cached tiles do not change the final calibration bbox. The stitched image still uses the exact XYZ tile extent returned by the downloader.

## Inspector fields

The sidebar inspector shows:

- selected source/provider and detected XYZ zoom,
- completed tile count and failed tile count,
- cache hits/misses and bytes read from cache,
- network tile count and downloaded bytes,
- fallback usage when direct/proxy candidates fail,
- output image format and elapsed time.

The `Vyčistiť cache` button clears the browser's CaveView map tile cache. Use it when verifying a production proxy or when a provider changes imagery and stale tiles are suspected.

## Limits

The default IndexedDB cache keeps up to 2500 tile records and skips single tile blobs larger than 2 MB. Oldest entries are pruned in the background after writes.

## Developer notes

- Cache implementation: `src/shared/utils/tileCache.ts`
- Download and inspector stats: `src/shared/utils/XyzTileDownloader.ts`
- UI panel: `TextureDownloadInspectorPanel` in `src/App.tsx`
- Viewer bridge: `onTextureDownloadInfo` in `src/v1/components/CaveViewer3D.tsx`
