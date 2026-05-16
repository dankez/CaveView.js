# Graph Report - CaveView-modernized  (2026-05-16)

## Corpus Check
- 222 files · ~274,478 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1344 nodes · 2225 edges · 135 communities (63 shown, 72 thin omitted)
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 605 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01d6696b`
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
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
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
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]

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
- `handleTiffFile()` --calls--> `parseGeoTiff()`  [INFERRED]
  src/App.tsx → src/v1/parsers/tiffParser.ts
- `buildCrossSections()` --calls--> `buildWallsSync()`  [INFERRED]
  legacy/js/viewer/walls/buildCrossSections.js → legacy/js/viewer/walls/WallBuilders.js
- `downloadTiledXyz()` --calls--> `lon2tile()`  [EXTRACTED]
  src/shared/utils/XyzTileDownloader.ts → src/utils/XyzTileDownloader.ts
- `downloadTiledXyz()` --calls--> `lat2tile()`  [EXTRACTED]
  src/shared/utils/XyzTileDownloader.ts → src/utils/XyzTileDownloader.ts
- `buildWallsSync()` --calls--> `buildScraps()`  [INFERRED]
  legacy/js/viewer/walls/WallBuilders.js → legacy/js/viewer/walls/buildScraps.js

## Communities (135 total, 72 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (62): applyTaubinSmoothing(), AutoFit(), BoundingBox(), buildScrapsGeo(), buildTerrainGeo(), buildTerrainTileData(), CameraMonitor(), CaveLegs() (+54 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (12): _getId(), EditPage, ExportPage, HelpPage, InfoPage, Page, RoutePanel, SelectionPage (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (12): GlyphString, GlyphStringBase, MutableGlyphString, GlyphStringGeometry, GlyphStringGeometryCache, AHI, AngleScale, CursorScale (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (7): dataURL(), hydrateGeometry(), replaceExtension(), EPSG3857TileSet, Overlay, Tile, WebTerrain

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (27): getTileUrl(), gpsToFractionalTile(), PROXIES, stitchTilesToDataURL(), TileCache, TileData, TileInfo, tileToGps() (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (13): parseGeoTiff(), AppState, draw(), encodeState(), execManualMeasure(), findStationByName(), getIframeCode(), getShareUrl() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (37): 🎡 Adaptívny Rotačný Gizmo, 🎡 Adaptive Rotation Gizmo, ✂️ Advanced Spatial Analysis (Clipping & Profiles), 🔒 Bezpečnosť a Audit, ☁️ Cloud Sharing (Google Drive) & Security, code:bash (git clone https://github.com/dankez/CaveView.js.git), code:bash (git clone https://github.com/dankez/CaveView.js.git), 📄 Documentation / Dokumentácia (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (9): Cfg, Compass, HudObject, CommonTerrainMaterial, ContourMaterial, EntrancePointMaterial, HypsometricMaterial, TerrainOverlayMaterial (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (4): pltLoader, SurveyDataCollector, Svx3dLoader, progress()

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (15): PLYHeader, PLYLoader, PLYProperty, Bounds, loader, nodeColors, nodeIntensity, nodeNormals (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (18): CalibrationPoint, Props, buildResult(), Calibration, CaveSurface, classifyLiDAR(), ParsedCave, parseLox() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (4): LinearScale, Scale, Stations, testPoint()

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (22): 1.1 Surface Nets (Dual Contouring), 1.2 Silk/Fabric Smoothing (Laplacian), 1.3 Taubin Smoothing (Volume Preserving), 1.4 Dilation / Bulge (Model Offset), 1. Rekonštrukcia povrchu (Surface Reconstruction), 2.1 LiDAR Raycasting & LOD (Level of Detail), 2.2 Režim merania a Gating interakcie, 2.2 Vertikálne profilovanie (Clipping) (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (21): [1.2.0] - 2026-05-01, [1.3.0] - 2026-05-03, Branding & Signature (v1.4.3), Changelog, Georeferencovanie & XYZ Scraping (v1.5.0), LiDAR Progresívny LOD & Optimalizácia (v1.4.0), LiDAR Výkon & Organická Rekonštrukcia (v1.3.3), Opravené (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (3): ClusterMarkers, QuadTree, Marker

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (10): de, en, fr, getBrowserLanguage(), getTranslation(), Language, languages, Translations (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (5): DistanceFieldPass, HUD(), PointerControls, AnaglyphEffect(), Snapshot

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (4): AHIControl, CompassControl, Control, CursorControl

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (3): getCanvas(), CameraMove, Segments

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (4): GLTFMaterialsClearcoatExtension, GLTFMaterialsPBRSpecularGlossiness, GLTFMaterialsTransmissionExtension, GLTFMaterialsVolumeExtension

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (14): 🏔️ 1. Vrstevnice, ktoré vám konečne niečo povedia, 🗺️ 2. Mapy a povrchy s profesionálnou presnosťou, 📐 3. Merania (pre tých, čo chcú mať všetko pod kontrolou), 🎥 4. Filmové štúdio priamo v prehliadači, 📱 5. Mobilná verzia (pre jaskynných nomádov), 🔗 6. Zdieľanie ako u profíkov (Embed), 👤 7. Jaskyniar so svetlom a orezávaním, ✂️ 8. Rezy jaskyňou (Clipping) – Vidieť dovnútra nikdy nebolo jednoduchšie (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (8): equalArray(), getMinMax(), getPaddedArrayBuffer(), getPaddedBufferSize(), GLTFLightExtension, GLTFMaterialsUnlitExtension, isIdentityMatrix(), stringToArrayBuffer()

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (12): altClose, altToggles, caverStandingBtn, closeBtn, closeMenuBtn, criticalErrors, errors, langBtn (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (4): TextureCache, loxLoader, ImagePopup, PointIndicator

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (12): DankeZ Downloader (Freemap Tile Downloader), 🇬🇧 English version, Freemap Tile Downloader, Insights and Improvements, Kľúčové Vlastnosti, Key Features, New Features, Nové Funkcie (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (3): DepthMaterial, HeightMaterial, ExportGltf

### Community 40 - "Community 40"
Cohesion: 0.2
Nodes (3): buildScraps(), buildWallsSync(), Walls

### Community 43 - "Community 43"
Cohesion: 0.2
Nodes (3): Leg, OrbitControls, CameraManager()

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (6): Lrud, Scrap, Shot, Station, SurveyData, Xsect

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (6): code:html (<iframe), ⚠️ Dôležité upozornenie (CORS), 🚀 Hlavné funkcie, 🔗 LochViewer - Systém zdieľania a vkladania (Embed), 🛠️ Parametre URL adresy, 📦 Príklad vloženia do stránky

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (4): parseTh2(), Th2Line, Th2Point, Th2Scrap

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (5): Aktuálny stav (Current Progress), Core Requirements (Striktné pravidlá), graphify, Project Goal, Role: Speleological Software Engineer

### Community 77 - "Community 77"
Cohesion: 0.7
Nodes (3): fetchAltitudeFromZbgis(), jtskToWgs84(), wgs84ToJtsk()

## Knowledge Gaps
- **136 isolated node(s):** `AppState`, `LoadedFile`, `SUPPORTED`, `MemoizedStatusBadge`, `PLYProperty` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **72 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reconstructSurface()` connect `Community 0` to `Community 1`, `Community 23`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `parsePly()` connect `Community 11` to `Community 27`, `Community 5`, `Community 23`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `CommonTerrain` connect `Community 17` to `Community 48`, `Community 34`, `Community 60`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `AppState`, `LoadedFile`, `SUPPORTED` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._