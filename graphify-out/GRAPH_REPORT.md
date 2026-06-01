# Graph Report - CaveView-modernized  (2026-06-01)

## Corpus Check
- 227 files · ~285,122 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1433 nodes · 2403 edges · 123 communities (74 shown, 49 thin omitted)
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 605 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fd0c1b85`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
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
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 97|Community 97]]

## God Nodes (most connected - your core abstractions)
1. `Survey` - 49 edges
2. `Page` - 28 edges
3. `GLTFWriter` - 27 edges
4. `WebTerrain` - 18 edges
5. `Stations` - 18 edges
6. `Legs` - 17 edges
7. `CommonTerrain` - 16 edges
8. `Tile` - 16 edges
9. `Changelog` - 15 edges
10. `Scale` - 14 edges

## Surprising Connections (you probably didn't know these)
- `handleTiffFile()` --calls--> `parseGeoTiff()`  [INFERRED]
  src/App.tsx → src/v1/parsers/tiffParser.ts
- `downloadTiledXyz()` --calls--> `lon2tile()`  [EXTRACTED]
  src/shared/utils/XyzTileDownloader.ts → src/utils/XyzTileDownloader.ts
- `downloadTiledXyz()` --calls--> `lat2tile()`  [EXTRACTED]
  src/shared/utils/XyzTileDownloader.ts → src/utils/XyzTileDownloader.ts
- `buildCrossSections()` --calls--> `buildWallsSync()`  [INFERRED]
  legacy/js/viewer/walls/buildCrossSections.js → legacy/js/viewer/walls/WallBuilders.js
- `buildWallsSync()` --calls--> `buildScraps()`  [INFERRED]
  legacy/js/viewer/walls/WallBuilders.js → legacy/js/viewer/walls/buildScraps.js

## Communities (123 total, 49 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (21): _getId(), ScaleBar, EditPage, ExportPage, Frame, HelpPage, InfoPage, Page (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (8): dataURL(), hydrateGeometry(), replaceExtension(), WorkerPool, WorkerPoolCache, EPSG3857TileSet, Tile, WebTerrain

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (15): equalArray(), getCanvas(), getMinMax(), getPaddedArrayBuffer(), getPaddedBufferSize(), GLTFExporter, GLTFLightExtension, GLTFMaterialsClearcoatExtension (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (8): LineSegments2, LineSegmentsGeometry, SurveyBox, CGeometry, Orb, TerrainMeshGeometry, DyeTraces, Legs

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (10): GlyphString, GlyphStringBase, MutableGlyphString, GlyphStringGeometry, GlyphStringGeometryCache, AHI, AngleScale, CursorScale (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (51): 🎡 Adaptívny Rotačný Gizmo, 🎡 Adaptive Rotation Gizmo, ✂️ Advanced Spatial Analysis (Clipping & Profiles), 🎨 Advanced Visuals, 🔒 Bezpečnosť a Audit, ☁️ Cloud Sharing (Google Drive) & Security, code:bash (git clone https://github.com/dankez/CaveView.js.git), code:bash (git clone https://github.com/dankez/CaveView.js.git) (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (43): applyTaubinSmoothing(), AutoFit(), BoundingBox(), buildScrapsGeo(), buildTerrainGeo(), buildTerrainTileData(), CameraMonitor(), CaveLegs() (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (27): getTileUrl(), gpsToFractionalTile(), PROXIES, stitchTilesToDataURL(), TileCache, TileData, TileInfo, tileToGps() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (28): CalibrationPoint, Props, CaveLegs, Character3D, CYL_UP, ELEV_STOPS, EntranceMarkers, ManualConnection (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (31): PLYHeader, PLYLoader, PLYProperty, Bounds, buckets, cell, cellBounds, doneMessage (+23 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (7): StationPosition, LinearScale, Scale, AnaglyphEffect(), StationLabels, Stations, testPoint()

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (7): AppState, draw(), execManualMeasure(), findStationByName(), LoadedFile, MemoizedStatusBadge, SUPPORTED

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (5): RenderUtils, TextureLookup, unpackRGBA(), CommonTerrain, Snapshot

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (29): [1.2.0] - 2026-05-01, [1.3.0] - 2026-05-03, [2.0.1] - 2026-05-17, [2.0.2] - 2026-05-17, [2.1.0] - 2026-06-01, Branding & Signature (v1.4.3), Changelog, Custom Farby & Analytické Rezy (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (7): Cfg, Compass, HudObject, BarGeometry, EntrancePointMaterial, WallMaterial, LightingManager()

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): 1.1 Surface Nets (Dual Contouring), 1.2 Silk/Fabric Smoothing (Laplacian), 1.3 Taubin Smoothing (Volume Preserving), 1.4 Dilation / Bulge (Model Offset), 1. Rekonštrukcia povrchu (Surface Reconstruction), 2.1 LiDAR Raycasting & LOD (Level of Detail), 2.2 Režim merania a Gating interakcie, 2.2 Vertikálne profilovanie (Clipping) (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (21): buildResult(), Calibration, CaveSurface, classifyLiDAR(), ParsedCave, parseLox(), parsePlt(), parsePly() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.1
Nodes (5): loxLoader, pltLoader, SurveyDataCollector, Svx3dLoader, progress()

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (3): Materials(), CaveViewer, StationMarkers

### Community 20 - "Community 20"
Cohesion: 0.1
Nodes (5): DepthMaterial, HeightMaterial, SurveyLineMaterial, ExportGltf, ViewState

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (3): ClusterMarkers, QuadTree, Marker

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (4): AHIControl, CompassControl, Control, CursorControl

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (7): de, en, fr, Language, languages, Translations, sk

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (4): CommonTerrainMaterial, ContourMaterial, HypsometricMaterial, TerrainOverlayMaterial

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (3): ModelSource, CaveViewUI(), FileSelector

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (4): TextureCache, LoxTile, ImagePopup, PointIndicator

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (3): Leg, OrbitControls, SegmentPopup

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (14): 🏔️ 1. Vrstevnice, ktoré vám konečne niečo povedia, 🗺️ 2. Mapy a povrchy s profesionálnou presnosťou, 📐 3. Merania (pre tých, čo chcú mať všetko pod kontrolou), 🎥 4. Filmové štúdio priamo v prehliadači, 📱 5. Mobilná verzia (pre jaskynných nomádov), 🔗 6. Zdieľanie ako u profíkov (Embed), 👤 7. Jaskyniar so svetlom a orezávaním, ✂️ 8. Rezy jaskyňou (Clipping) – Vidieť dovnútra nikdy nebolo jednoduchšie (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (12): altClose, altToggles, caverStandingBtn, closeBtn, closeMenuBtn, criticalErrors, errors, langBtn (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (9): DownloadResult, downloadTiledXyz(), downloadWmsImage(), gpsToTile(), lat2tile(), lon2tile(), metersPerPixel(), Progress (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (4): buildCrossSections(), buildScraps(), buildWallsSync(), Walls

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (12): DankeZ Downloader (Freemap Tile Downloader), 🇬🇧 English version, Freemap Tile Downloader, Insights and Improvements, Kľúčové Vlastnosti, Key Features, New Features, Nové Funkcie (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.27
Nodes (9): Lrud, Segment, analyzeLiDARAnomalies(), calculateVolumeAndProfile(), estimateDistanceToPointCloud(), estimateLRUDFromGeometry(), LiDARAnomaly, ProfileResult (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (3): DistanceFieldPass, HUD(), CameraManager()

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (3): PointerControls, Popup, PopupGeometry

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (6): code:html (<iframe), ⚠️ Dôležité upozornenie (CORS), 🚀 Hlavné funkcie, 🔗 LochViewer - Systém zdieľania a vkladania (Embed), 🛠️ Parametre URL adresy, 📦 Príklad vloženia do stránky

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (4): parseTh2(), Th2Line, Th2Point, Th2Scrap

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (5): Aktuálny stav (Current Progress), Core Requirements (Striktné pravidlá), graphify, Project Goal, Role: Speleological Software Engineer

### Community 54 - "Community 54"
Cohesion: 0.4
Nodes (5): 🏗 Architecture, 🛠 Development Rules, 🚀 Engine v2 (NextGen) Tech Stack, graphify, Project Guidelines: CaveView 2.x NextGen

### Community 55 - "Community 55"
Cohesion: 0.7
Nodes (3): fetchAltitudeFromZbgis(), jtskToWgs84(), wgs84ToJtsk()

### Community 64 - "Community 64"
Cohesion: 0.5
Nodes (4): encodeState(), getIframeCode(), getShareUrl(), handleCopyShare()

### Community 66 - "Community 66"
Cohesion: 0.5
Nodes (3): getBrowserLanguage(), getTranslation(), App()

### Community 68 - "Community 68"
Cohesion: 0.5
Nodes (3): DownloadProgress, downloadTiledWms(), TileCache

## Knowledge Gaps
- **177 isolated node(s):** `AppState`, `LoadedFile`, `SUPPORTED`, `MemoizedStatusBadge`, `PLYProperty` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reconstructSurface()` connect `Community 0` to `Community 6`, `Community 23`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `parsePly()` connect `Community 16` to `Community 19`, `Community 11`, `Community 23`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `getPaddedArrayBuffer()` connect `Community 2` to `Community 23`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `AppState`, `LoadedFile`, `SUPPORTED` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._