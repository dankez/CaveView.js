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
- **Proj4js**: Transformácie súradnícových systémov (UTM, S-JTSK na WGS84).

### 🏗 Architektúra
- **Web Workers**: Parsovanie binárnych súborov prebieha na samostatnom vlákne (`parser.worker.ts`), aby sa nezasekávalo používateľské rozhranie.
- **State Management**: Využíva React `useState` a `useMemo` pre efektívne aktualizácie 3D scény.
- **Persistent States**: Nastavenia zobrazenia sa ukladajú priamo do URL parametrov, čo umožňuje okamžité zdieľanie presného náhľadu.

### 📂 Podporované formáty
- **.lox (Therion)**: Najlepšia podpora vrátane stien jaskyne, textúr a terénu.
- **.3d (Survex)**: Podpora pre polygonové ťahy (v3 až v8).
- **.plt (Compass)**: Základná podpora pre dáta z Compassu.

---

## 🇺🇸 English Version

### 🛠 Technologies
- **React & TypeScript**: Core framework and type safety.
- **Vite**: Modern build tool and development server.
- **Three.js & React-Three-Fiber (R3F)**: WebGL-based 3D rendering.
- **React-Three-Drei**: Helper utilities for R3F (camera controls, HTML in 3D).
- **Three-Mesh-BVH**: Acceleration for collisions and calculations (e.g., depth measurement).
- **Proj4js**: Coordinate system transformations (UTM, S-JTSK to WGS84).

### 🏗 Architecture
- **Web Workers**: Binary file parsing is offloaded to a background thread (`parser.worker.ts`) to maintain UI responsiveness.
- **State Management**: Uses standard React `useState` and `useMemo` for efficient 3D scene updates.
- **Persistent States**: Viewport settings are serialized into URL parameters, allowing instant sharing of the exact view.

### 📂 Supported Formats
- **.lox (Therion)**: Full support including cave walls, textures, and DTM terrain.
- **.3d (Survex)**: Support for centerlines (v3 through v8).
- **.plt (Compass)**: Basic support for Compass plot data.
