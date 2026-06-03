# Large Model Performance

## Implemented in this pass

### Viewer code splitting

The main app no longer eagerly imports the v1 and v2 3D viewers. Both viewers are loaded with `React.lazy()` only when the viewer screen is rendered.

Impact:

- smaller initial welcome/app bundle,
- Three.js viewer code is not loaded before a model is opened,
- v2 point-cloud viewer is not loaded for regular v1 cave models.

### GeoTIFF lazy loading

The GeoTIFF parser is imported only when a `.tif` or `.tiff` file is loaded.

Impact:

- normal `.lox`, `.3d`, `.plt`, `.ply`, and `.stl` workflows do not load TIFF decoder code,
- TIFF behavior stays the same once the TIFF workflow starts.

### Adaptive terrain LOD while moving

Terrain tiles now use a lower vertex density while the camera/model is moving and return to full terrain geometry after movement stops.

Rules:

- small surfaces keep full quality,
- larger surfaces use 2x, 4x, 6x, or 8x subsampling while moving,
- full-resolution geometry still builds a BVH tree for precise raycasting,
- moving LOD skips BVH generation because it is temporary and lower density.

### Terrain build cleanup

Terrain height min/max is computed once per surface and shared by all terrain tiles. BVH data is disposed when a tile geometry is replaced.

Impact:

- less repeated CPU work when building terrain tiles,
- lower memory pressure when switching terrain LOD.

## Future larger steps

- Move XYZ tile stitching to a worker with `OffscreenCanvas` where supported.
- Add STL/PLY geometry simplification presets for very large files.
- Add a generated surface texture cache keyed by source, bbox, zoom, and resolution.
- Split heavy analysis panels and export tools into lazy-loaded chunks.
