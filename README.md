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

## 🆕 Release Notes - 20.04.2026 (Spatial Analysis & BVH Update)

Update z 20.04.2026 transformuje aplikáciu na profesionálny analytický nástroj s vysokým výkonom interakcie.

- **BVH Priestorový Index (three-mesh-bvh):** Integrácia hierarchie ohraničujúcich objemov pre všetky steny jaskyne a modely terénu. To umožňuje bleskurýchly raycasting (detekcia klikov) aj na modeloch s miliónmi polygónov bez zásekov.
- **Dynamická priestorová mriežka (Grid):** Implementácia inteligentnej mriežky, ktorá automaticky mení svoju hustotu (`cellSize`) a mierku podľa aktuálneho zoomu. Poskytuje stabilný vizuálny referenčný rámec v každom detaile.
- **Viacvrstvový Bounding Box:**
  - Pridaná vizualizácia ohraničujúceho boxu celého systému v prémiovej Ferrari červenej farbe.
  - **Dynamický rozsah:** Box automaticky mení svoju veľkosť podľa viditeľnosti vrstiev (zväčší sa pre terén, stiahne sa len pre jaskyňu).
  - **Vertikálna optimalizácia:** Pridaná 10% výšková rezerva pre lepšiu vizuálnu kompozíciu.
- **Profesionálny Processing Overlay:** Implementácia asynchrónneho spracovania geometrie s vizuálnym indikátorom. Používateľ vidí stav generovania stien a indexovania BVH v reálnom čase (napr. *"Indexujem BVH priestor..."*).
- **Vylepšená stabilita parsera:** LOX parser bol upravený tak, aby ignoroval neznáme typy dátových blokov, čo zabezpečuje kompatibilitu s najnovšími verziami exportov z Therionu.
- **Záťažový test (Big Model):** Pridaný priamy prístup k modelu **Zádiel (32MB)** na úvodnú obrazovku pre overenie výkonu na masívnych dátach.

## 🛠️ TODO / Plán optimalizácie
*Aktuálny stav po Spatial update:*

- [x] **GPU Akcelerácia:** Presun výpočtu výškového farbenia do shaderov a optimalizácia renderovania.
- [x] **Instanced Rendering:** Tisíce staníc sú vykresľované pomocou `InstancedMesh`.
- [x] **LOD Systém:** Implementácia Level of Detail pre rozsiahle modely terénu a stien.
- [x] **Stabilná Mierka:** Presun mierky do UI vrstvy a fixácia polohy.
- [x] **Dynamic Colors:** Plná podpora pre užívateľský výber farieb pre všetky vrstvy.
- [x] **BVH Integrácia:** Implementácia `three-mesh-bvh` pre extrémne rýchly raycasting v zložitej geometrii.
- [x] **Asynchrónne spracovanie:** Vizualizácia stavu generovania modelu a BVH.
- [ ] **Web Workers:** Presun parsovania veľkých .LOX a .DTM súborov na pozadie.
- [ ] **Dátová kompresia:** Optimalizácia prenosu dát medzi parserom a GPU.

---
*Vyvinuté pre Slovak Speleological Society (SSS) v roku 2026.*
