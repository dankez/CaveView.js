# Technical Documentation / Technická dokumentácia

LochViewer is a modern, web-based 3D speleological data viewer.
LochViewer je moderný webový 3D prehliadač speleologických dát.

---

## 🇸🇰 Slovenská verzia

### 🛠 Technológie
- **React & TypeScript**: Hlavný framework a typová bezpečnosť.
- **Vite**: Moderný nástroj na zostavenie aplikácie (build tool).
- **Three.js & React-Three-Fiber (R3F)**: 3D renderovanie pomocou WebGL.
- **React-Three-Drei**: Pomocné nástroje pre R3F (ovládanie kamery, HTML v 3D).
- **Three-Mesh-BVH**: Zrýchlenie kolízií a výpočtov (napr. meranie hĺbky nadložia).
- **Proj4js & coords.ts**: Transformácie súradnícových systémov (UTM, S-JTSK na WGS84). Všetka geodetická logika je centralizovaná v `src/utils/coords.ts`.
- **XYZ Tile Streaming**: Integrácia sťahovania ortofotomáp v reálnom čase.


### 🏗 Architektúra (v2.0+)
Aplikácia využíva duálnu architektúru motorov (Dual-Engine) s čistým oddelením modulov:
- **`src/v1/` (Standard Engine):** Optimalizovaný pre klasické speleologické dáta (.lox, .3d) a rekonštrukciu povrchov (Surface Nets).
- **`src/v2/` (NextGen Engine):** Špeciálne navrhnutý pre masívne LiDAR mračná bodov. Využíva hierarchické **Octree LOD** indexovanie a streamovanie dát.
- **`src/shared/`:** Centralizované úložisko pre zdieľané typy, UI komponenty a geodetickú logiku.
- **Web Workers:** Binárne spracovanie a Octree rozklad prebiehajú na pozadí (`pointcloud.worker.ts`), čo umožňuje plynulé prezeranie modelov s miliónmi bodov.
- **Post-Processing:** Implementácia **Eye-Dome Lighting (EDL)** pre realistickú hĺbku mračna bodov a integrácia `three-geo` pre dynamické 3D Mapbox povrchy.

### 📂 Podporované formáty
- **.lox (Therion)**: Najlepšia podpora vrátane stien jaskyne, textúr a terénu.
- [ALGORITHMS.md](../ALGORITHMS.md) - Podrobný popis matematických algoritmov (Surface Nets, Laplacian Silk).
- [CHANGELOG.md](../CHANGELOG.md) - História zmien.
- **.3d (Survex)**: Podpora pre polygonové ťahy (v3 až v8).
- **.plt (Compass)**: Základná podpora pre dáta z Compassu.
- **.ply (LiDAR)**: Pokročilá rekonštrukcia povrchu (Organický model s Laplacovským vyhladením a presný Mesh model).

---

## 🇺🇸 English Version

### 🛠 Technologies
- **React & TypeScript**: Core framework and type safety.
- **Vite**: Modern build tool and development server.
- **Three.js & React-Three-Fiber (R3F)**: WebGL-based 3D rendering.
- **React-Three-Drei**: Helper utilities for R3F (camera controls, HTML in 3D).
- **Three-Mesh-BVH**: Acceleration for collisions and calculations (e.g., depth measurement).
- **Proj4js & coords.ts**: Coordinate system transformations (UTM, S-JTSK to WGS84). Geodetic logic is centralized in `src/utils/coords.ts`.
- **XYZ Tile Streaming**: Real-time integration of orthophoto and terrain tiles.


### 🏗 Architecture (v2.0+)
The application uses a Dual-Engine architecture with clean module separation:
- **`src/v1/` (Standard Engine):** Optimized for classic survey data (.lox, .3d) and surface reconstruction (Surface Nets).
- **`src/v2/` (NextGen Engine):** Specifically designed for massive LiDAR point clouds. Utilizes hierarchical **Octree LOD** indexing and data streaming.
- **`src/shared/`:** Centralized repository for shared types, UI components, and geodetic logic.
- **Web Workers:** Binary processing and Octree decomposition are offloaded to background threads (`pointcloud.worker.ts`), enabling smooth viewing of models with millions of points.
- **Post-Processing:** **Eye-Dome Lighting (EDL)** for realistic point cloud depth and `three-geo` integration for dynamic 3D Mapbox surfaces.

### 📂 Supported Formats
- **.lox (Therion)**: Full support including cave walls, textures, and DTM terrain.
- **.3d (Survex)**: Support for centerlines (v3 through v8).
- **.plt (Compass)**: Basic support for Compass plot data.
- **.ply (LiDAR)**: Advanced surface reconstruction (Organic model with Laplacian smoothing and Accurate Mesh model).
