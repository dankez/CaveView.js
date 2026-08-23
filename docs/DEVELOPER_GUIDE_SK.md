# 🛠️ LochViewer - Vývojárska a matematická dokumentácia (v2.4.15)

*Kompletná technická špecifikácia, matematický aparát, architektúra a flow diagramy pre vývojárov.*

---

## 📑 Obsah
1. [Systémová architektúra a Dual-Engine koncept](#1-systémová-architektúra-a-dual-engine-koncept)
2. [Matematický aparát a geodetické transformácie](#2-matematický-aparát-a-geodetické-transformácie)
3. [Algoritmy rekonštrukcie stien a Signed Distance Fields (Splay SDF)](#3-algoritmy-rekonštrukcie-stien-a-signed-distance-fields-splay-sdf)
4. [Výpočet štruktúrnej geológie a tektoniky (Dip & Strike)](#4-výpočet-štruktúrnej-geológie-a-tektoniky-dip--strike)
5. [Kamerové projekcie a algoritmus Zoom-to-Fit](#5-kamerové-projekcie-a-algoritmus-zoom-to-fit)
6. [Post-processing shadery (Eye-Dome Lighting & SSAO)](#6-post-processing-shadery-eye-dome-lighting--ssao)
7. [Paralelné Web Workery a prenos dát (ArrayBuffers)](#7-paralelné-web-workery-a-prenos-dát-arraybuffers)
8. [URL schéma a stavová hydratácia](#8-url-schéma-a-stavová-hydratácia)

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

## 6. Post-processing shadery (Eye-Dome Lighting & SSAO)

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
*LochViewer Developer Team — Dokumentácia je automaticky udržiavaná a synchronizovaná pri každej zmene kódu.*
