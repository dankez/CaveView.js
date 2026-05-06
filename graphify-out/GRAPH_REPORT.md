# Graph Report - CaveView-modernized  (2026-05-05)

## Corpus Check
- 186 files · ~256,609 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 986 nodes · 1668 edges · 47 communities detected
- Extraction: 64% EXTRACTED · 36% INFERRED · 0% AMBIGUOUS · INFERRED: 599 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]

## God Nodes (most connected - your core abstractions)
1. `Survey` - 49 edges
2. `Page` - 28 edges
3. `GLTFWriter` - 27 edges
4. `WebTerrain` - 18 edges
5. `Stations` - 18 edges
6. `Legs` - 17 edges
7. `CommonTerrain` - 16 edges
8. `Tile` - 16 edges
9. `Scale` - 14 edges
10. `Cfg` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildCrossSections()` --calls--> `buildWallsSync()`  [INFERRED]
  legacy/js/viewer/walls/buildCrossSections.js → legacy/js/viewer/walls/WallBuilders.js
- `buildWallsSync()` --calls--> `buildScraps()`  [INFERRED]
  legacy/js/viewer/walls/WallBuilders.js → legacy/js/viewer/walls/buildScraps.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (12): Cfg, DepthMaterial, EntrancePointMaterial, HeightMaterial, Materials(), WallMaterial, ExportGltf, LightingManager() (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (14): ColourCache, SurveyColourMapper(), Leg, PublicFactory, Segment, Station, CanvasPopup, OrbitControls (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (18): DistanceFieldFilterPass, DistanceFieldPass, HUD(), CaveLoader, FileLoader, buildResult(), parseLox(), parsePlt() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (14): _getId(), EditPage, ExportPage, Frame, HelpPage, InfoPage, Page, RoutePanel (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (21): equalArray(), getCanvas(), getMinMax(), getPaddedArrayBuffer(), getPaddedBufferSize(), GLTFExporter, GLTFLightExtension, GLTFMaterialsClearcoatExtension (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (9): dataURL(), hydrateGeometry(), replaceExtension(), WorkerPool, WorkerPoolCache, EPSG3857TileSet, Overlay, Tile (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (14): GlyphString, GlyphStringBase, MutableGlyphString, GlyphStringGeometry, GlyphStringGeometryCache, AHI, AngleScale, Compass (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (8): LineSegments2, LineSegmentsGeometry, SurveyBox, CGeometry, Orb, TerrainMeshGeometry, DyeTraces, Walls

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (7): StationPosition, LinearScale, Scale, Selection, StationLabels, Stations, testPoint()

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (8): TextureCache, loxLoader, pltLoader, SurveyDataCollector, Svx3dLoader, progress(), ImagePopup, PointIndicator

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (5): RenderUtils, TextureLookup, unpackRGBA(), CommonTerrain, Snapshot

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (7): draw(), encodeState(), execManualMeasure(), findStationByName(), getIframeCode(), getShareUrl(), handleCopyShare()

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (3): ClusterMarkers, QuadTree, Marker

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (4): AHIControl, CompassControl, Control, CursorControl

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (2): Routes, SurveyMetadata

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (4): CommonTerrainMaterial, ContourMaterial, HypsometricMaterial, TerrainOverlayMaterial

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (3): ModelSource, CaveViewUI(), FileSelector

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (3): PointerControls, Popup, PopupGeometry

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (1): EPSG4326TileSet

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (1): intersectTrianglePlane()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (2): DistanceFieldPlugin, DistanceLookup

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (1): FullScreenQuad

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (1): WorkerLoader

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (2): ARButton, ARPlugin

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (2): LocationPlugin, LocationSource

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (1): SurveyLineMaterial

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (1): CursorMaterial

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (1): DepthCursorMaterial

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (1): Line2Material

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (1): GlyphAtlas

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (1): LoxTerrainGeometry

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (1): HeightLookup

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (1): StationNameLabel

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): include(), read()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (1): TerrainMeshLoader

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (1): HeightMapLoader

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (1): OSFilePlugin

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (1): WaterMaterial

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (1): StationMaterial

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (1): DepthMapMaterial

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (1): MissingMaterial

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (1): ExtendedPointsMaterial

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (1): ClusterMaterial

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (1): PopupMaterial

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (1): TerrainTileGeometry

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (1): FlatTileGeometry

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (1): Point

## Knowledge Gaps
- **Thin community `Community 14`** (17 nodes): `Routes.js`, `SurveyMetadata.js`, `.setStation()`, `Routes`, `.addRoute()`, `.adjacentToRoute()`, `.constructor()`, `.getCurrentRoute()`, `.getRouteNames()`, `.inCurrentRoute()`, `.loadRoute()`, `.saveCurrent()`, `SurveyMetadata`, `.constructor()`, `.getRoutes()`, `.saveLocal()`, `.saveRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (8 nodes): `EPSG4326TileSet.js`, `EPSG4326TileSet`, `.constructor()`, `.getCoverage()`, `.getScreenAttribution()`, `.getTileSets()`, `.getTileSpec()`, `.workerScript()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (6 nodes): `intersectTrianglePlane()`, `onEnd()`, `onStart()`, `Stations()`, `update()`, `CaveViewer3D.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (6 nodes): `DistanceFieldPlugin.js`, `DistanceFieldPlugin`, `.constructor()`, `DistanceLookup`, `.constructor()`, `.lookup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (6 nodes): `FullScreenQuad`, `.constructor()`, `.dispose()`, `.material()`, `.render()`, `FullScreenQuad.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (5 nodes): `WorkerLoader.js`, `WorkerLoader`, `.abort()`, `.constructor()`, `.load()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (5 nodes): `ARPlugin.js`, `ARButton`, `.createButton()`, `ARPlugin`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (5 nodes): `LocationPlugin.js`, `LocationPlugin`, `.constructor()`, `LocationSource`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (5 nodes): `SurveyLineMaterial.js`, `SurveyLineMaterial`, `.constructor()`, `.getCursor()`, `.setCursor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (5 nodes): `CursorMaterial.js`, `CursorMaterial`, `.constructor()`, `.getCursor()`, `.setCursor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `DepthCursorMaterial.js`, `DepthCursorMaterial`, `.constructor()`, `.getCursor()`, `.setCursor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (4 nodes): `Line2Material.js`, `Line2Material`, `.constructor()`, `.dispose()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (4 nodes): `GlyphAtlas.js`, `GlyphAtlas`, `.constructor()`, `GlyphAtlasCache()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (4 nodes): `LoxTerrainGeometry.js`, `LoxTerrainGeometry`, `.constructor()`, `.setupUVs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `HeightLookup.js`, `HeightLookup`, `.constructor()`, `.lookup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (4 nodes): `StationNameLabel.js`, `StationNameLabel`, `.close()`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (4 nodes): `include()`, `makeColours.js`, `mkJSON()`, `read()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (3 nodes): `TerrainMeshLoader.js`, `TerrainMeshLoader`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `HeightMapLoader.js`, `HeightMapLoader`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (3 nodes): `OSFilePlugin.js`, `OSFilePlugin`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `WaterMaterial.js`, `WaterMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (3 nodes): `StationMaterial.js`, `StationMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (3 nodes): `DepthMapMaterial.js`, `DepthMapMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (3 nodes): `MissingMaterial.js`, `MissingMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (3 nodes): `ExtendedPointsMaterial.js`, `ExtendedPointsMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (3 nodes): `ClusterMaterial.js`, `ClusterMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (3 nodes): `PopupMaterial.js`, `PopupMaterial`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (3 nodes): `TerrainTileGeometry.js`, `TerrainTileGeometry`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (3 nodes): `FlatTileGeometry.js`, `FlatTileGeometry`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (3 nodes): `Point.js`, `Point`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Materials()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Survey` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Stations` connect `Community 8` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._