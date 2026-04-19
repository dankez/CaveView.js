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

## 🆕 Release Notes - 19.04.2026 (GPU Optimization Update)

Tento update sa zameral na plynulosť práce s extrémne veľkými modelmi (napr. Zádiel - státisíce trojuholníkov).

- **Inteligentný LOD Systém (Draft/Stable):** Aplikácia dynamicky prepína medzi plným detailom a odľahčeným modelom (20x subsampling) počas pohybu.
- **Aggressive Detection:** Draft mód sa aktivuje okamžite pri kliknutí (`mousedown`), čím sa eliminuje "seknutie" pri prvom pohybe.
- **Sticky Draft & Cooldown:** Draft mód zostáva aktívny počas celého držania tlačidla myši a doostruje model až 1 sekundu po ukončení pohybu pre maximálnu plynulosť.
- **Optimalizácia React stromu:** Implementácia `React.memo` a `Visibility Toggling` pre popisy staníc. Prepínanie režimov je teraz okamžité bez ohľadu na počet bodov.
- **Vizuálny status:** Pridaný indikátor stavu modelu (DRAFT/STABLE) v hornej lište pre okamžitú spätnú väzbu o režime renderovania.
- **WebGL Fine-tuning:** Nastavenie `high-performance` priority pre GPU a optimalizácia renderovacej slučky.

## 🆕 Release Notes - 19.04.2026 (UI & Viewport Optimization)

Druhý update dňa 19.04.2026 sa zameral na vizuálnu čistotu, presnosť merania a užívateľský komfort.

- **Stabilná mierka (UI Scale Bar):** Mierka bola presunutá z 3D scény priamo do hlavného rozhrania (UI layer). Už sa "nehýbe" s modelom, je pevne prilepená na spodnom okraji obrazovky, čím pôsobí ako profesionálny GIS nástroj.
- **Inteligentný Auto-Fit:** Refaktorovaná logika počiatočného zoomu. Pri otvorení modelu sa kamera automaticky nastaví tak, aby bol v zábere **celý model** vrátane terénu a všetkých odľahlých častí jaskyne (Fit to screen).
- **Zjednotený Color Picker systém:** Každá vrstva (Splay, 3D ťah, Body, Steny, Terén) má teraz v Sidebare vlastnú ikonku palety pre okamžitú zmenu farby bez nutnosti reštartu aplikácie.
- **Kompaktný Sidebar:** Odstránené rozmerné palety farieb pod terénom a nahradené elegantným výsuvným Color Pickerom, čo šetrí miesto na menších obrazovkách.
- **Optimalizácia priblíženia:** Zvýšený limit maximálneho oddialenia pre prácu s rozsiahlymi povrchmi pohorí.

## 🛠️ TODO / Plán optimalizácie
*Aktuálny stav po GPU update:*

- [x] **GPU Akcelerácia:** Presun výpočtu výškového farbenia do shaderov a optimalizácia renderovania.
- [x] **Instanced Rendering:** Tisíce staníc sú vykresľované pomocou `InstancedMesh`.
- [x] **LOD Systém:** Implementácia Level of Detail pre rozsiahle modely terénu a stien.
- [x] **Stabilná Mierka:** Presun mierky do UI vrstvy a fixácia polohy.
- [x] **Dynamic Colors:** Plná podpora pre užívateľský výber farieb pre všetky vrstvy.
- [ ] **BVH Integrácia:** Implementácia `three-mesh-bvh` pre extrémne rýchly raycasting v zložitej geometrii.
- [ ] **Web Workers:** Presun parsovania veľkých .LOX a .DTM súborov na pozadie.
- [ ] **Dátová kompresia:** Optimalizácia prenosu dát medzi parserom a GPU.

---
*Vyvinuté pre Slovak Speleological Society (SSS) v roku 2026.*
