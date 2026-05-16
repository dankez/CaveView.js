# Design Spec: CaveView 2.x NextGen (Engine Replacement)

**Dátum:** 2026-05-16
**Status:** Draft / Schválené používateľom
**Cieľ:** Nahradiť súčasný lineárny engine za hierarchický Point-Cloud engine schopný plynule zobrazovať milióny bodov (napr. model Erna, 190MB/6.2M bodov) pri zachovaní 100% parity funkcií z verzie 1.x.

## 1. Architektonické rozdelenie
Projekt bude rozdelený na dve hlavné vetvy pre zabezpečenie stability:
- `src/v1/`: Súčasný engine (Modernized). Zameraný na .lox (Therion) a mesh rekonštrukciu.
- `src/v2/`: Nový engine (NextGen). Zameraný na LiDAR, masívne mračná bodov a WebGPU/moderný WebGL.
- `src/shared/`: Spoločná biznis logika, UI komponenty (CalibrationModal, InfoCard), i18n a typy.

## 2. Jadro NextGen Engine (v2)
### 2.1. Dátový Procesing
- **PointCloudStreamer:** Nový parser v `src/v2/parsers/pointcloud.worker.ts`, ktorý implementuje:
  - **Spatial Octree:** Rozklad veľkých PLY súborov na hierarchické bloky.
  - **Streaming:** Postupné načítavanie dát do GPU bez blokovania UI.
- **Formáty:**
  - PLY (Binary/ASCII) s podporou RGB, Normál a Skalárnych polí (Intensity/Curvature).
  - Potree (Octree hierarchy) pre gigabajtové datasety.
  - LOX/3D/PLT (spätná kompatibilita cez v1 bridge).

### 2.2. Renderovacia Pipeline
- **Eye-Dome Lighting (EDL):** Post-processing shader na zvýraznenie hĺbky bez nutnosti komplexného tieňovania.
- **Perfect Square Shaders:** Renderovanie bodov ako pevných diskov/štvorcov so správnym orezávaním (Point Size Attenuation).
- **Three-geo Integration:** Automatické načítanie 3D terénu z Mapboxu na základe georeferencie jaskyne.

## 3. Funkčná Parita (Must-Have)
Všetky funkcie z v1 musia byť v NextGen implementované v rovnakej alebo vyššej kvalite:
- **Kalibrácia:** Presné umiestnenie v globálnom súradnicovom systéme.
- **Clipping (Rezy):** Bleskové orezávanie mračna bodov v reálnom čase cez GPU Clipping Planes.
- **Merania:** Raycasting na body zrýchlený cez BVH (Bounding Volume Hierarchy).
- **Export:** Možnosť exportu aktuálneho výrezu alebo pohľadu.

## 4. Implementačné fázy
1. **Fáza 1 (Upratovanie):** Reorganizácia adresárov (`src/v1`, `src/v2`, `src/shared`).
2. **Fáza 2 (v2 Loader):** Implementácia streamovacieho PLY parsera a Octree rozkladu.
3. **Fáza 3 (v2 Visuals):** Implementácia EDL a shaderov pre LiDAR.
4. **Fáza 4 (Integrácia):** Prepojenie so zdieľanými UI komponentmi a finalizácia three-geo Mapbox povrchu.

## 5. Úspech (Success Criteria)
- Model Erna (6.2M bodov) beží plynule pri 60 FPS.
- Prepnutie medzi v1 a v2 engine je pre používateľa transparentné alebo explicitne voliteľné.
- Jaskyňa je presne vizualizovaná pod reálnym 3D povrchom z Mapboxu.
