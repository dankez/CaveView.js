# 🛠️ LochViewer - Vývojárska a matematická dokumentácia (v2.4.34)

*Kompletná technická špecifikácia, matematický aparát, architektúra a flow diagramy pre vývojárov.*

### Výber staníc, meranie a rýchla lišta (2.4.34)

`StationLabel.pos`, `SelStation.pos` a voliteľný bod `StationClick` používajú **centrované meračské XYZ so Z nahor**. Scéna používa `T(p) = (x + cx, z + cz, -y - cy)` s kalibráciou `c`; `sceneToSurvey` pri v2 zásahu vykoná inverziu práve raz. Pôvodné súradnice sú `p + cave.centerOffset`. Bod terénu sa pred vykreslením inverzne prevedie do lokálneho rámca skupiny jaskyne. Vzdialenosti aj polygón počítajú v rovnakom rámci ako značky a čiary, aj pri kalibrovanom posune jaskyne voči terénu.

`SurveyPointPicker` pri zachytenom natívnom kliknutí premietne zapnuté stanice/splay body, prijme najbližší bod do 10 CSS pixelov (pri zhode rozhoduje bližšia hĺbka) a spotrebuje udalosť pred mesh handlermi. Pohyb nad 5 px znamená otáčanie, nie výber. Nepribudlo snímkové prehľadávanie, pomocné GPU ciele ani zmena worker protokolu. v2 povoľuje voľný výber len zo skupiny mračna, ignoruje pomocnú geometriu a presný vrchol obnoví z `Intersection.index` a `matrixWorld`. Siete/terén reagujú na klik, nie začiatok ťahania.

`measureDistance`: `d3 = hypot(dx,dy,dz)`, `dXY = hypot(dx,dy)`, sklon `atan2(dz,dXY)`, sieťový azimut `atan2(dx,dy) mod 360°`. `measurePolygon` počíta plochu usporiadaného rovinného polygónu `A = |Σ((pi-p0) × (pi+1-p0))|/2` a uzavretý 3D obvod. Nerovinný obvod dáva vektorovú/projekčnú plochu, nie plochu triangulovaného povrchu. Tektonickú orientáciu naďalej určuje prvá trojica. Hĺbka je `DTM(X+caveOffsetXY-surfaceOffsetXY)+surfaceOffsetZ-Z-caveOffsetZ` len pri pokrytí konečnými hodnotami DTM.

LOX zachováva `isFixed` (`m_flags & 0x04`) a `qualifiedName` (`stanica@survey.parent`); hierarchia survey má ochranu pred cyklom. `ViewerOptions` pridáva voliteľné `showFixedStations`, `showCenterline` (undefined znamená viditeľné) a `stationLabelMode: off|short|full|altitude|gps`. Staré prepínače mien/výšok zrušia explicitný režim. Bez GPS údajov sa GPS krok cyklu preskočí.

Zdieľané URL zachovávajú tieto voľby ako `cline=0`, `fixed=1` a `labels=off|short|full|altitude|gps`; neznáme režimy popisov sa ignorujú. Oba obaly Canvas izolujú CSS stacking context, aby premietnuté HTML popisy neprekrývali merací panel ani ostatné ovládanie aplikácie.

Predvolené pohľady animujú samostatný vektor polohy a priebežne ho aplikujú na aktuálnu R3F kameru. Zmena projekcie môže nahradiť kameru bez straty animácie pôdorysu/profilu; nový pohľad alebo odmontovanie zruší predchádzajúci tween. Pôdorys v lište cyklí `top`/`bottom`, Nárys `front` (z juhu, kamera na +Z) → `east` (+X) → `back` (−Z) → `side` (−X); všetky sú hodnoty `ViewPreset` z `@shared/types`. `bottom` dáva kameru na −Y s `up = (0,0,−1)`, sever ostáva hore a východ/západ sú zrkadlové. Pri pomalých softvérových GL snímkach GSAP lag smoothing natiahne 0,65 s tween, preto E2E čaká až 20 s.

`ViewerToolbar` používa typované navigačné callbacky a existujúce SVG Lucide. Obrazový dialóg a snímky reprezentácií vrstiev sú lokálne a nemenia App/Canvas. Vrstvové akcie zámerne menia spoločné options; Steny/Povrch si uložia reprezentácie, skryjú ich a opätovne obnovia. Reload parsuje uchované pôvodné bajty cez existujúci parser worker. `MeasurementOverlay` má priehľadné čiary bez depth-testu v neskorej render-order skupine a neinteraktívne HTML značky A/B. Bez novej runtime závislosti.

### Zjednotená navigácia (2.4.33)

`src/shared/components/NavigationSidebar/` obsahuje obal panela, accordiony s natívnymi tlačidlami, typované väzby a sekcie Project/View/Layers/Surface/Analysis/System. Surface je podskupinou Vrstiev, nie šiestou kategóriou. Kalibrácia jaskyne/povrchu je výhradne tam; WebM záznam a jeho dĺžka sú výhradne v Súbor → Zdieľanie a dostupné exporty.

`App` ponecháva stav datasetu, `ViewerOptions`, workery a handlery ovplyvňujúce scénu. `NavigationBindings` je typované rozhranie UI; sekcie používajú potrebné polia. Aktívnu kategóriu, zbalenie na počítači a mobilný drawer vlastní lokálne obal panela; rozbalenie vlastní každý accordion. Tieto lokálne zmeny nerenderujú App ani susedný Canvas. Zmena parametra scény renderer zámerne aktualizuje; zmena rozmerov plátna pri zbalení môže vyvolať resize a vykreslenie snímky.

Neaktívne sekcie zostávajú namontované a skryté, čím sa zachovajú referencie súborových vstupov aj rozbalené nastavenia. Hlavné prepínače sú mimo zbalených detailov; SDF detaily vyžadujú zapnutú vrstvu, LiDAR zachováva podmienky PLY. Pri šírke ≤768 px drawer uzamyká Tab/Shift+Tab, označí súrodencov scény ako inert, spracuje Escape a obnoví fokus. Zdieľanie/pomoc najprv zatvoria drawer a až potom otvoria externý dialóg. Menný priestor `navigation` pokrýva SK/EN/FR/DE. Protokoly workerov, geometrické algoritmy a závislosti sa nemenia.

---

## 📑 Obsah
1. [Systémová architektúra a Dual-Engine koncept](#1-systémová-architektúra-a-dual-engine-koncept)
2. [Matematický aparát a geodetické transformácie](#2-matematický-aparát-a-geodetické-transformácie)
3. [Algoritmy rekonštrukcie stien a Signed Distance Fields (Splay SDF)](#3-algoritmy-rekonštrukcie-stien-a-signed-distance-fields-splay-sdf)
4. [Výpočet štruktúrnej geológie a tektoniky (Dip & Strike)](#4-výpočet-štruktúrnej-geológie-a-tektoniky-dip--strike)
5. [Kamerové projekcie a algoritmus Zoom-to-Fit](#5-kamerové-projekcie-a-algoritmus-zoom-to-fit)
6. [Post-processing shadery (Eye-Dome Lighting)](#6-post-processing-shadery-eye-dome-lighting)
7. [Paralelné Web Workery a prenos dát (ArrayBuffers)](#7-paralelné-web-workery-a-prenos-dát-arraybuffers)
8. [URL schéma a stavová hydratácia](#8-url-schéma-a-stavová-hydratácia)
9. [Stitch CAD dizajnový systém a CSS tokeny](#9-stitch-cad-dizajnový-systém-a-css-tokeny)
10. [Optimalizácia výkonu, React Render Decoupling a WebGL Render Loop](#10-optimalizácia-výkonu-react-render-decoupling-a-webgl-render-loop)

---

## 1. Systémová architektúra a Dual-Engine koncept

Aplikácia je postavená na báze **React 18**, **Three.js** a **React-Three-Fiber** a využíva prísne oddelenú **Dual-Engine** architektúru:

```
                          ┌─────────────────────────────┐
                          │   Vstupný súbor / URL       │
                          │ (.lox, .ply, .3d, .plt, STL)│
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │     parser.worker.ts        │
                          │  (Paralelný Web Worker)     │
                          └──────────────┬──────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
         ┌─────────────────────────────┐   ┌─────────────────────────────┐
         │     ENGINE v1 (Standard)    │   │     ENGINE v2 (NextGen)     │
         │  src/v1/CaveViewer3D.tsx    │   │ src/v2/CaveViewerNextGen.tsx│
         ├─────────────────────────────┤   ├─────────────────────────────┤
         │ • LOX, 3D, PLT, STL siete   │   │ • Masívne PLY LiDAR mračná  │
         │ • Therion Scraps polygóny   │   │ • Octree LOD partitioning   │
         │ • Splay SDF Marching Cubes  │   │ • WebGL EDL & point shaders │
         │ • Three.js Mesh pipeline    │   │ • 60 FPS pre > 10M bodov    │
         └──────────────┬──────────────┘   └──────────────┬──────────────┘
                        │                                 │
                        └────────────────┬────────────────┘
                                         ▼
                          ┌─────────────────────────────┐
                          │    Spoločné UI a Analýzy    │
                          │   (Meranie, Rezy, HUD)      │
                          └─────────────────────────────┘
```

### Princíp delenia:
* **Engine v1 (`src/v1/`)**: Zameraný na speleologické vektorové dáta, polygonálne ťahy, ručne kreslené steny (scraps) a parametrické SDF siete.
* **Engine v2 (`src/v2/`)**: Špecializovaný na mračná bodov (LiDAR), kde je kľúčový Octree streaming (`pointcloud.worker.ts`) a GPU post-processing (Eye-Dome Lighting).
* **Shared Layer (`src/shared/`)**: Zdieľané dátové typy (`@shared/types`), matematické knižnice (`tectonics.ts`, `surfaceReconstruction.ts`), lokalizácie (`i18n`) a komponenty používateľského rozhrania (`MeasurementPanel`, `CompassRose`, `FloatingClippingSlider`).

### 1.2 Prepínanie motorov a izolácia LiDAR dát (`isPlyLidarData`)
Aby nedochádzalo k miešaniu logiky Engine v1 a v2, aplikácia používa striktnú klasifikáciu:
- `isPlyLidarData(ext, cave)`: Vyhodnocuje sa ako `true` výhradne pre súbory `.ply` alebo explicitné mračná bodov (`isLiDAR: true` bez polygónových segmentov).
- **Parser Survey dát (`caveParser.ts`)**: Pre bežné súbory (`.lox`, `.3d`, `.plt`) nastavuje `pointCount: 0`. Stanice sa neinterpretujú ako body mračna.
- **UI Guarding**: Prepínač motora `LiDAR NEXTGEN`, panel `LiDAR editácia`, karta `LiDAR detektor komínov` a prekryvná vrstva štetca sa renderujú iba ak `isPlyLidar === true`.
- **Failsafe**: Pri načítaní non-PLY súborov sa motor vždy automaticky resetuje na `v1` (aj v prípade prítomnosti URL parametra `?eng=v2`).

---

## 2. Matematický aparát a geodetické transformácie

### 2.1 Eliminácia numerickej chyby plávajúcej rádovej bodky (Centroid Subtraction)
Súradnice v kartografických systémoch (napr. S-JTSK) dosahujú hodnoty okolo $X \approx -500\,000\ \text{m}$, $Y \approx -1\,200\,000\ \text{m}$. Grafické karty (GPU) počítajú v 32-bitovej plávajúcej rádovej bodke (`float32`), kde má mantisa presnosť iba 24 bitov (~7 dekadických číslic). Použitie globálnych súradníc priamo v shaderoch spôsobuje trasenie (jittering) geometrie.

**Riešenie**:
V parseri sa vypočíta ťažisko modelu $P_{\text{offset}} = (x_0, y_0, z_0)$ v 64-bitovej presnosti (`float64`). Všetky vrcholy sú do GPU posielané v lokálnych súradniciach:
$$P_{\text{local}} = P_{\text{world}} - P_{\text{offset}}$$
Globálne súradnice sa spätne dopočítavajú iba pri zobrazení hodnôt v UI kartách a meracích paneloch.

### 2.2 Transformácia súradníc S-JTSK (EPSG:5514) $\leftrightarrow$ WGS-84 (EPSG:4326) $\leftrightarrow$ UTM
Pre transformáciu rastrov a vektorov sa využíva knižnica `proj4` s definíciou Křovákovho konformného kužeľového zobrazenia:
```ts
const S_JTSK = "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";
```

---

## 3. Algoritmy rekonštrukcie stien a Signed Distance Fields (Splay SDF)

Moduly `splayWall.worker.ts` a `splayMath.ts` transformujú zamerané splay lúče do objemového skalárneho poľa vzdialeností (SDF) a následne generujú polygónovú sieť pomocou algoritmu **Marching Cubes**.

### 3.1 Vzdialenosť bodu od 3D úsečky (Capsule SDF)
Pre každý bod v priestore $P \in \mathbb{R}^3$ a úsečku definovanú stanicou $A$ a koncom lúča $B$:
$$h = \text{clamp}\left(\frac{(P - A) \cdot (B - A)}{\|B - A\|^2},\ 0,\ 1\right)$$
Vzdialenosť k úsečke je definovaná ako:
$$d(P, A, B, r) = \|P - (A + h(B - A))\| - r$$
kde $r$ je polomer virtuálnej kapsule (`splayCapsuleRadius`).

### 3.2 Hladké zlučovanie telies (Polynomial Smooth-Min)
Jednotlivé kapsuly sa nezlučujú ostrou binárnou operáciou $\min(d_1, d_2)$, ale polynomickým vyhladením s parametrom $k = \text{splaySmoothK}$:
$$h = \max(k - |d_1 - d_2|,\ 0) / k$$
$$\text{smin}(d_1, d_2, k) = \min(d_1, d_2) - \frac{h^2 \cdot k}{4}$$

### 3.3 Bisektorová deliaca rovina (Bisector Normal Plane)
Aby sa zabránilo kolíziám lúčov medzi susednými stanicami $A$ a $B$, je v strede spojnice $M = \frac{A + B}{2}$ definovaná deliaca normálová rovina so smerovým vektorom $\vec{u} = \frac{B - A}{\|B - A\|}$. Splay body zo stanice $A$ sú orezané podmienkou $\vec{u} \cdot (P - M) \le 0$.

---

## 4. Výpočet štruktúrnej geológie a tektoniky (Dip & Strike)

Modul `src/shared/utils/tectonics.ts` počíta orientáciu geologických rovín z 3 bodov $P_1, P_2, P_3 \in \mathbb{R}^3$:

### 4.1 Výpočet normály roviny
$$\vec{v}_1 = P_2 - P_1,\quad \vec{v}_2 = P_3 - P_1$$
$$\vec{N} = \vec{v}_1 \times \vec{v}_2 = (N_x, N_y, N_z)$$
Jednotková normála:
$$\vec{n} = \frac{\vec{N}}{\|\vec{N}\|}$$
Orientáciu normalizujeme tak, aby smerovala nahor ($n_z \ge 0$). V prípade $n_z < 0$ invertujeme $\vec{n} \leftarrow -\vec{n}$.

### 4.2 Uhol sklonu roviny (Dip $\theta$)
Uhol medzi rovinou a horizontálou:
$$\theta = \arccos(|n_z|) \times \frac{180^\circ}{\pi}$$

### 4.3 Smer spádnice (Dip Direction $\alpha$)
Azimut najstrmšieho poklesu vrstvy:
$$\alpha = \left(\text{atan2}(n_x,\ n_y) \times \frac{180^\circ}{\pi} + 360^\circ\right) \bmod 360^\circ$$

### 4.4 Smer vrstvy (Strike $\beta$)
Smerová priamka kolmá na spádnicu (podľa pravidla pravej ruky):
$$\beta = (\alpha + 90^\circ) \bmod 360^\circ$$

---

## 5. Kamerové projekcie a algoritmus Zoom-to-Fit

Funkcia `calculateFitParams` v `ProjectionController.tsx` zabezpečuje presné vyplnenie obrazovky (~85% viewportu) pre oba režimy kamery:

### 5.1 Perspektívna kamera
Pre ohraničujúcu guľu modelu s polomerom $R$ a zorný uhol $\text{FOV}$:
$$d_{\text{target}} = \frac{R}{\sin(\text{FOV} / 2)} \times 1.15$$

### 5.2 Ortogonálna kamera
Pre ortogonálnu kameru sa zoom faktor vypočíta z rozmerov plátna $W, H$:
$$\text{zoom}_{\text{ortho}} = \frac{\min(W, H)}{2 \cdot R \cdot 1.15}$$

---

## 6. Post-processing shadery (Eye-Dome Lighting)

### 6.1 Eye-Dome Lighting (EDL) Shader
EDL je screen-space tieňovací algoritmus pre bodové mračná. Vypočítava hĺbkový gradient $F(u, v)$ z 4 susedných pixelov v tvare kríža vo vzdialenosti $d$:
$$F(u, v) = \sum_{i=1}^4 \max\left(0,\ \ln(z(u, v)) - \ln(z(u + \delta x_i,\ v + \delta y_i))\right)$$
Výsledná intenzita pixelu:
$$I = I_0 \cdot \exp(-F(u, v) \cdot k_{\text{exp}})$$
kde $k_{\text{exp}}$ je parameter plasticity.

---

## 7. Paralelné Web Workery a prenos dát (ArrayBuffers)

Všetky výpočtovo náročné operácie bežia mimo hlavného UI vlákna:
* `parser.worker.ts`: Parsovanie binárnych súborov `.lox`, `.ply`, `.stl`.
* `pointcloud.worker.ts`: Tvorba Octree priestorových stromov a LOD streaming.
* `splayWall.worker.ts`: Generovanie 3D sietí zo splayov cez Marching Cubes.
* `lidarPlanMap.worker.ts`: 2D rastrové projekcie a hustotné mapy.

### Zero-Copy Transferable Objects:
Dáta medzi vláknami neprechádzajú pomalou JSON serializáciou, ale priamym odovzdaním vlastníctva pamäte:
```ts
self.postMessage({
  type: 'SPLAY_WALL_READY',
  positions: positionsArray.buffer,
  normals: normalsArray.buffer,
  colors: colorsArray.buffer
}, [positionsArray.buffer, normalsArray.buffer, colorsArray.buffer]);
```

---

## 8. URL schéma a stavová hydratácia

Stav aplikácie je plne serializovaný v reťazci URL parametrov:

| Parameter | Dátový typ | Popis |
| :--- | :--- | :--- |
| `model` | `string` (URL) | Priamy odkaz na načítavaný 3D súbor. |
| `embed` | `boolean` (`1`/`0`) | Aktivuje čistý iframe režim bez vonkajších líšt. |
| `proj` | `orthographic` / `perspective` | Nastavenie typu kamerovej projekcie. |
| `theme` | `precision` / `dark` / `light` | Farebná téma scény a materiálov. |
| `sdf` | `boolean` (`1`/`0`) | Aktivácia Splay SDF stien. |
| `smin` | `number` (napr. `0.12`) | Vyhladzovací parameter SDF stien. |
| `srad` | `number` (napr. `0.14`) | Polomer kapsuly okolo splayov. |
| `scraps` | `boolean` (`1`/`0`) | Zobrazenie Therion ručných stien. |
| `terrain` | `none` / `shaded` / `satellite` | Režim povrchového terénu. |
| `alt` | `abs` / `rel` | Absolútny vs. relatívny výškový systém. |
| `clip` | `number` | Vertikálna rovina Z-rezu. |

---

## 9. Stitch CAD dizajnový systém a CSS tokeny

Vo verziách 2.4.22 až 2.4.25 bol integrovaný a kalibrovaný dizajnový systém **Precision Speleology & 3D Geospatial Engine** odvodený zo špecifikácie Google Stitch (`DESIGN.md`):

* **CSS premenné (`:root` a `.theme-light`):**
  * Základňa: `--cv-bg: #0b0f17` (Deep Abyss) / `--cv-bg: #f7f3eb` (Fieldwork Sand).
  * Kontajnery a karty: `--cv-surface-card: #1c2028`, `--cv-surface-high: #262a33`, `--cv-surface-low: #141820` (v `.theme-light`: nízka elevácia `#f2ece2`, vyššia `#e8ded0`).
  * Primárny akcent: `--cv-primary: #00d2ff` (Electric Cyan) / `--cv-primary: #0284c7` (Fieldwork Blue).
  * Sekundárny akcent: `--cv-secondary: #10b981` (Subterranean Emerald) / `#059669`.
  * Písmo: `--cv-font-sans: 'Inter'` pre UI, `--cv-font-mono: 'JetBrains Mono'` s `font-variant-numeric: tabular-nums` pre súradnice a telemetriu.
* **Three.js sRGB Color Space a gradienty pozadia (v2.4.24 - v2.4.25):**
  * Téma `precision` využíva technický modrý vertikálny gradient: zhora tmavšia nočná modrá (`#103258`) prechádzajúca do svetlejšej technickej modrej (`#1d5b9b`).
  * Téma `light` využíva vertikálny pieskový gradient zhora nadol: svetlá slonovinová piesková (`#f7f3eb`) prechádzajúca do tmavšej vápencovej pieskovej (`#d5c4ad`).
* **Oprava mapového zdroja Freemap a detekcia placeholderov (v2.4.26):**
  * Zastaraný endpoint `tiles.freemap.sk/o/{z}/{x}/{y}.jpg` (vracajúci 1843-bajtový PNG s textom "no map data") bol nahradený za oficiálny produkčný `https://ortofoto.tiles.freemap.sk/{z}/{x}/{y}.jpg`.
  * Konfigurácie v `public/map-proxy.php` a `vite.config.ts` boli aktualizované na `ortofoto.tiles.freemap.sk`.
  * `XyzTileDownloader.ts` obsahuje explicitnú validáciu dlaždíc proti 1843-bajtovým placeholderom: pri ich detekcii odmietne dlaždicu ako chybnú a automaticky prepne na proxy fallback.
  * Inkrementovaná verzia cache kľúčov v `tileCache.ts` na `KEY_VERSION = 'v2'`, čo zabezpečilo okamžitú invalidáciu chybných "no map data" dlaždíc u všetkých používateľov.
* **Oprava prepínania a layoutu bočného panelu (v2.4.25):**
  * Kontajner `.canvas-wrap` má explicitne definovaný `min-width: 0`, čo umožňuje CSS flexboxu korektne zmenšiť šírku 3D plátna pri opätovnom vysunutí bočného panelu (`.sidebar-container`), namiesto jeho vytlačenia mimo viditeľnú plochu obrazovky.
  * Pridané plávajúce tlačidlo `.sidebar-reopen-tab` pre okamžité znovuotvorenie panela priamo z pravého horného rohu 3D scény.
  * Mobilná lišta nastavení je obmedzená cez `@media (max-width: 768px)` a `.mobile-drawer-header`, čím je zamedzené jej nechcené zobrazovanie na desktopových rozlíšeniach.
* **Exkluzivita LiDAR ovládačov pre PLY formát (v2.4.24):**
  * Prepínač motora `LiDAR NEXTGEN` (Engine v2) a súvisiace editačné panely sa podmienečne vykresľujú iba pri prítomnosti skutočných mračien bodov (`isPointcloud && isPlyFormat`).
  * `caveParser.ts` v `buildResult` zachováva meračským polygónovým súborom (`.lox`, `.3d`, `.plt`) reálny počet `pointCount = 0`, čím eliminuje nesprávne zapnutie LiDAR rozhrania.
* **Architektúra bočného panelu a hierarchia kariet:**
  * **`.sidebar-pinned-header`**: Trvalo ukotvený blok (`position: sticky; top: 0; z-index: 50; flex-shrink: 0`) obsahujúci súhrnné dáta datasetu (`.sidebar-stat-card`) a navigačné prepínače záložiek (`.sidebar-tab-bar`), čím je zaručené, že navigačný kontext neodroluje pri posune ovládačov.
  * **`.cad-card`**: Primárne modulárne kontajnery pre logické celky (orez, meračská sieť, Splay SDF, povrchy, tektonika).
  * **`.cad-subcard`**: Sekundárne vložené informačné boxy adaptujúce sa cez CSS premenné (`background: var(--cv-surface-low)`), nahrádzajúce staré hardcoded tmavé bloky (`#0f172a`, `bg-slate-800`).
  * **`.cad-slider`, `.cad-tool-btn`, `.btn-mini`, `.cad-select`**: Štandardizované interaktívne prvky s vysokokontrastnou odozvou pre oba motívy.
* **Prepínače a komponenty:**
  * Kompaktné CAD prepínače `.switch` s akcentom `box-shadow: 0 0 8px rgba(0,210,255,0.35)`.
  * Dynamická väzba šablón na kontajner `.viewer-shell.theme-{currentTheme}`.

---

## 10. Optimalizácia výkonu, React Render Decoupling a WebGL Render Loop

Vo verzii **v2.4.27** bola zrealizovaná komplexná výkonnostná stabilizácia a optimalizácia jadra aplikácie (sub-16ms latencia, 60 FPS odozva pri interakcii a nulové vyťaženie CPU/GPU pri nečinnosti):

### 1. Riešenie priehľadnosti povrchov a stien pri rotácii kamery:
- V komponentoch `CaveViewer3D` (`TerrainMesh`), `Scraps` a `SplayCaveWalls` bolo odstránené dynamické prepínanie priehľadnosti na hodnotu `1.0` pri pohybe kamery (`isMoving` / `!isFullyIdle`). Priehľadnosť zadaná používateľom ostáva stála bez nežiaduceho preblikávania do plnej farby.
- `TerrainTile` vylúčil `props.isMoving` z výpočtu `terrainSubsample`. Tým sa eliminoval synchrónny prepočet geometrie a prestavba BVH stromu na hlavnom vlákne pri štarte a zastavení rotácie.
- `props.opacity` bolo vyňaté z poľa závislostí `useMemo` shaderového materiálu `contourMat`, čím sa predišlo rekompilácii GLSL shaderov počas animácie; `depthWrite` je nastavené dynamicky na `props.opacity === 1`.

### 2. Eliminácia 10Hz re-render kaskády v `App.tsx`:
- `CameraMonitor` v `CaveViewer3D` a `CaveViewerNextGen` aktualizuje stav `cameraData` v rodičovskom komponente len vtedy, keď sa zmenil horizontálny azimut o viac ako $1^\circ$, nastala zmena kategórie vrstevníc `distBucket` alebo translácia pozície prekročila $0.25\ \text{m}^2$ (s časovým throttlom 150 ms). Tým sa zabránilo re-renderovaniu 6500-riadkového stromu `App.tsx` 10-krát za sekundu počas rotácie scény.
- Nekonečný animačný cyklus `requestAnimationFrame` častíc na úvodnom plátne (`bg-canvas`) je automaticky zastavený v režime 3D prehliadača (`appState === 'viewer'`).

### 3. Stabilizácia referencií props (React.memo):
- Spätné volania `onProcessingEnd`, `onTextureReady`, `onSurfaceOffsetChange` a objekt `manualConnection` boli memoizované cez `useCallback` a `useMemo`, vďaka čomu manipulácia s bočným panelom, posuvníkmi a kartami nespúšťa zbytočné re-rendery komponentov `<CaveViewer3D>` a `<CaveViewerNextGen>`.

### 4. Zlúčenie geometrie v `Scraps.tsx` (50 % úspora):
- Namiesto separátneho generovania `currentSolid` a `currentAlt` (ktoré 2× spúšťalo `mergeVertices`, `applyTaubinSmoothing`, výpočet normál a BVH strom) sa generuje jediná `BufferGeometry` s atribútom `color`. Tri Three.js materiály bez `vertexColors` atribút farby automaticky ignorujú.

### 5. Zero-Copy Worker I/O & VRAM Lifecycle Management:
- `parser.worker.ts` odovzdáva buffery `surf.dtm.data.buffer` a `surf.bitmapData.buffer` cez `Transferable` zoznam v `self.postMessage()`.
- Odstránené redundantné klonovania `buf.slice(0)` v `App.tsx`.
- Komponenty `CaveLegs`, `PointCloud`, `OrganicShell`, `TerrainMesh` a `Scraps` dôsledne volajú `dispose()` na všetkých geometriách, textúrach a BVH stromoch (`disposeBoundsTree`) pri odmontovaní a zmene parametrov.

### 6. Okamžitý on-demand prechod:
- Timeout nečinnosti (`idleTimeoutRef`) bol skrátený z 1500 ms na 180 ms, čím sa WebGL renderovacia slučka (`frameloop="demand"`) stabilizuje do pasívneho režimu s nulovou spotrebou okamžite po pustení myši.

---

## 11. Priehľadnosť tieňovaného povrchu, 2D obojsmerné vrstevnice a Axonometria (v2.4.28)

### 1. Priehľadnosť tieňovaného povrchu a výškovej siete:
- V `src/App.tsx` bol pridaný vyhradený posuvník pre `opts.surfaceOpacity` pri zapnutom `opts.showSurfaceMesh` alebo `opts.showSurfaceNetwork`.
- V `CaveViewer3D.tsx` (`TerrainTile`) je priehľadnosť prepojená priamo na Three.js materiál: `transparent={props.opacity < 1}`, `opacity={props.opacity}` a `depthWrite={props.opacity === 1}` s korektným polygónovým odsadením (`polygonOffset`).

### 2. Dvojitá 2D detekcia hrán pre kóty vrstevníc (`ContourLabels`):
- Pôvodná hrubá $16 \times 16$ mriežka s testovaním iba horizontálnych hrán bola nahradená jemnejším rastrom $36 \times 36$ s obojsmernou interpoláciou:
  - Horizontálne hrany: $(r, c) \leftrightarrow (r, c+\Delta c)$
  - Vertikálne hrany: $(r, c) \leftrightarrow (r+\Delta r, c)$
- Pre každú hlavnú vrstevnicu $z_{\text{major}}$ sa vypočíta presný priesečník $t = \frac{z_{\text{target}} - z_1}{z_2 - z_1}$.
- Výber bodov je priestorovo riadený minimálnou vzdialenosťou $d_{\min} = \max(30\ \text{m}, \frac{\text{maxDim}}{14})$, čo zaručuje minimálne jednu dobre čitateľnú hodnotu v zornom poli používateľa bez zhlukovania štítkov.

### 3. Podmienené zobrazenie Splay SDF stien:
- Karta *Splay SDF steny (2D/3D)* v `src/App.tsx` sa podmieňuje cez `{cave && splayCount > 0 && (...)}`. Pri modeloch bez pomocných splay lúčov je karta úplne skrytá.

### 4. Jednotné prepínanie splay lúčov a bodov:
- `ViewerOptions.showSplay` riadi súčasne `CaveLegs` (splay úsečky) aj splay bodovú geometriu v `Stations`.
- `showStations` riadi iba bežné stanice polygónového ťahu; vypnutie tejto vrstvy neodpojí splay body od prepínača splay lúčov.

### 5. Trojuholníková sieť a axonometrický režim (`Scraps.tsx`):
- Prepínač *Trojuholník. mesh* (`options.accurateScraps`) bol integrovaný do oboch 3D prehliadačov (`CaveViewer3D` aj `CaveViewerNextGen`):
  - Montáž stien `<Scraps>` je aktívna pri `(o.showScraps || o.accurateScraps || o.scrapsWireframe)`, čo umožňuje samostatné spustenie.
  - V `Scraps.tsx` sa zapína `flatShading={options.accurateScraps || !smooth}` pre ostré fazetové tieňovanie stien.
  - Drôtená sieť `(showWire || options.accurateScraps)` sa vykresľuje v `renderOrder={10}` s farbou `options.colorScrapsWire` a `depthWrite={!showSolid && !showAltitude}` pre autentický speleologický axonometrický vzhľad.
- v2.5.0: `LayersSection.tsx` zobrazuje prepínač *Trojuholník. mesh* iba pri `isPlyLidar`. Pri ostatných modeloch `wireOn = scrapsWireframe || (!isPlyLidar && accurateScraps)` a kliknutie nastaví `{ scrapsWireframe: !wireOn, accurateScraps: false }` (staré URL s `acc=1` zostávajú čitateľné). Prepínače `traverseAltitude` / `scrapsAltitude` sú v slote `primary` accordionu; duplicitná karta *Mierka (Jaskyniar)* odstránená — `placedCaver` nastavuje `StationDetailCard`.

---
## 12. Pamäťové a sieťové optimalizácie (v2.4.30)

- Mapovanie bodov podkladovej mapy na stanice používa `Map<string, StationLabel>`; pri duplicitných názvoch sa zachová prvá stanica ako pri pôvodnom `Array.find()`. Párovanie je O(P + S) namiesto O(P × S).
- Pri odmontovaní `PointCloudLOD` alebo zmene URL sa požiadavka preruší pomocou `AbortController`; pole normál sa vytvorí a pripojí k geometrii iba pri dostupných platných normálach. Zmena referencie `cave.pointNormals` invaliduje memoizovanú geometriu.
- Splay geometria sa ukladá do LRU cache s limitom 256 MiB, počítaným ako súčet `byteLength` polí pozícií, normál a indexov. Čítanie aj zápis obnovujú položku ako najnovšiu; najstaršie sa odstraňujú pri prekročení limitu a nadlimitná geometria sa neuloží.
- Každý pokus o načítanie XYZ dlaždice má 15-sekundový timeout. Po jeho vypršaní `AbortController` zruší požiadavku a downloader skúsi ďalší zdroj; časovač sa vždy vyčistí.

## 13. Odložené načítanie Mapbox terénu (v2.4.31)

- `CaveViewerNextGen` načítava `MapboxTerrain` cez `React.lazy()` a `React.Suspense`; komponent sa importuje len pri splnení podmienky GPS súradníc, zapnutého terénu a dostupného tokenu.
- `three-geo` je izolované v chunke `vendor-mapbox-terrain` za dynamickým importom a nie je vynútene zahrnuté v `optimizeDeps`, takže sa nespracúva pri štarte Vite ani nenačítava do hlavnej produkčnej cesty.
- Nepoužívaná priama závislosť `pdfjs-dist` bola odstránená z manifestu a lockfile.

## 14. Prístupné prepínače a jazyk dokumentu (v2.4.32)

- Ovládacie prvky `.switch` sú `<button type="button" role="switch">` s `aria-checked` a lokalizovaným `aria-label`; natívna aktivácia tlačidla zabezpečuje klávesy Enter a Space bez vlastného `onKeyDown`.
- Efekt v `App.tsx` synchronizuje stav `lang` s `document.documentElement.lang`, aby ho správne oznamovali asistenčné technológie.
- `index.html` poskytuje názov, popis, Open Graph metadáta a lokálny SVG favicon.

## 15. Priamy vertikálny rez a odhalenie v bočnom paneli z lišty (v2.5.1)

- `App.tsx` drží `profilePicking`. `startProfilePick()` zapne `showProfileClipping`, vymaže `activeProfilePoints` a využije `measurementMode = 'distance'` (rovnaký snap aj A/B overlay). Efekt prevezme prvé dva `selectedStations` do `activeProfilePoints` a ukončí meranie. `setProfileClipping(on)` obnoví existujúcu líniu alebo spustí výber, ak žiadna nie je. Rovina rezu ostáva $\mathbf{n} = \widehat{(p_2 - p_1) \times \hat{y}}$, $d = -\mathbf{n}\cdot p_1 - \text{offset}$ v oboch enginoch.
- `NavigationSidebar/reveal.ts` posiela udalosť `cv-nav-reveal` s `{ category, target }`. Nástroje `ViewerToolbar` majú `reveal={[kategória, cieľ]}`; `NavigationSidebar` lokálne prepne kategóriu, na desktope sa rozbalí (mobilný drawer ostáva zatvorený) a zvýrazní `[data-nav-target]` (najbližší `.toggle-row`) triedou `.nav-reveal`. `SidebarAccordion` má prop `navTarget`.
- Posúva sa iba `.nav-panel-content` (`scrollBy`), nie `scrollIntoView`: posun nadradených kontajnerov menil veľkosť R3F plátna a refit v2 posúval cieľ kamery počas animácie pohľadu.

---
*LochViewer Developer Team — Dokumentácia je automaticky udržiavaná a synchronizovaná pri každej zmene kódu.*
