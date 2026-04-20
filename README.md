# CaveView 3D (Modernized)

Moderná webová aplikácia na 3D vizualizáciu jaskynných systémov, vybudovaná na technológiách **React**, **Three.js** a **React Three Fiber**. Aplikácia umožňuje speleológom interaktívne skúmať jaskynné dáta, merať vzdialenosti a vizualizovať podzemie v realistickom kontexte.

## ✨ Kľúčové funkcie

### 🔍 3D Prehliadač a Vizualizácia
- **Realistický Render Mód:** Možnosť aplikovať geologické textúry na steny jaskyne (Vápenec, Granit, Základná skala).
- **Výškové farbenie (Altitude):** Automatický farebný gradient podľa nadmorskej výšky pre steny, polygonové ťahy aj 3D rúrky.
- **Terén a Povrch:** Zobrazenie topografického povrchu s podporou tieňovania, sieťových modelov a satelitných textúr.
- **Splay vizualizácia:** Voliteľné zobrazenie a filtrovanie slepých zamerov (splays).

### 🛠️ Technické nástroje a Meranie
- **Interaktívne stanice:** Kliknutím na bod získate podrobné informácie: hĺbka pod povrchom, nadmorská výška a presné GPS súradnice (WGS84) prepočítané z UTM.
- **3D Mierka (Jaskyniar):** Možnosť umiestniť do modelu postavičku jaskyniara (stojaci 1.8m / plaziaci sa 0.5m) pre okamžité posúdenie veľkosti priestorov.
- **Dynamická grafická mierka:** Živý Scale-Bar v rohu obrazovky, ktorý sa prispôsobuje úrovni priblíženia (zoomu).
- **Relatívne meranie:** Po výbere dvoch bodov aplikácia vypočíta 3D vzdialenosť, azimut, sklon a prevýšenie medzi nimi.

### 📱 Optimalizované UI/UX
- **Mobile-First Design:** Plne responzívne rozhranie s hamburger menu pre smartfóny a tablety.
- **Inteligentné filtre:** Automatické ignorovanie "informačných" názvov bodov (bodka, čiarka, pomlčka) pre čistý vizuálny výstup.
- **Farebné kódovanie:** Jasné rozlíšenie medzi polygonovými bodmi (červené) a splay bodmi (žlté).

## 📂 Podporované formáty
- **Therion (.lox)**
- **Survex (.3d)**
- **Compass (.plt)**

## 🚀 Inštalácia a spustenie

1. Nainštalujte závislosti:
   ```bash
   npm install
   ```
2. Spustite vývojový server:
   ```bash
   npm run dev
   ```
3. Zostavenie produkčnej verzie:
   ```bash
   npm run build
   ```

## 🆕 Release Notes - 20.04.2026-02 (Performance & Adaptive Themes)

Tento update prináša zásadnú architektonickú zmenu zameranú na plynulosť a vizuálnu čistotu pri extrémnych záťažiach.

- **Web Workers (Background Parsing):** Parsovanie veľkých `.lox` súborov bolo presunuté do samostatného vlákna (Worker). Užívateľské rozhranie zostáva plne responzívne aj pri načítavaní 30MB+ modelov.
- **Tiled Terrain (OVR Subdivision):** Terén je teraz rozdelený na dlaždice (tiles) o veľkosti 128x128 bodov. To umožňuje efektívny **Frustum Culling** (GPU spracováva len viditeľné časti) a plynulý pohyb kamerou v rozsiahlych územiach.
- **Adaptive Multi-Theme System:** Implementácia troch nezávislých vizuálnych šablón prepínateľných v reálnom čase:
  - **Precision:** Neutrálna polnočná modrá so zlatými akcentmi (podľa GIS dizajnu).
  - **Classic:** Tradičný čierny mód s prvkami pripomínajúcimi Loch/Aven (biely ťah, zelená mriežka).
  - **Light:** Svetlá téma optimalizovaná pre prácu na priamom slnku.
- **Optimalizácia Priehľadnosti (X-ray View):**
  - Implementovaná prísna hierarchia vykresľovania (`renderOrder`).
  - Inteligentný `depthWrite` pre polopriehľadný terén zabezpečuje, že chodby jaskyne sú vždy jasne viditeľné a korektne vrstvené pod povrchom.
- **Zjednotené UI:** Nový prepínač tém v hornom paneli s okamžitou odozvou.

## 🛠️ TODO / Plán optimalizácie
*Aktuálny stav:*

- [x] **GPU Akcelerácia:** Presun výpočtu výškového farbenia do shaderov a optimalizácia renderovania.
- [x] **Instanced Rendering:** Tisíce staníc sú vykresľované pomocou `InstancedMesh`.
- [x] **LOD Systém:** Implementácia Level of Detail pre rozsiahle modely terénu a stien.
- [x] **Stable Scale Bar:** Dynamická grafická mierka v UI vrstve.
- [x] **Dynamic Colors:** Plná podpora pre užívateľský výber farieb pre všetky vrstvy.
- [x] **BVH Integrácia:** `three-mesh-bvh` pre extrémne rýchly raycasting.
- [x] **Asynchrónne spracovanie:** Vizualizácia stavu generovania modelu a BVH.
- [x] **Web Workers:** Parsovanie .LOX na pozadí (zero UI-freeze).
- [x] **Tiled Rendering:** Rozdelenie terénu na dlaždice pre lepší Frustum Culling.
- [ ] **Dátová kompresia:** Optimalizácia prenosu dát medzi parserom a GPU.

---
*Vyvinuté pre Slovak Speleological Society (SSS) v roku 2026.*
