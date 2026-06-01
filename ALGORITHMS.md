# Technická Dokumentácia Algoritmov LochViewer

Tento dokument popisuje matematické a technické princípy spracovania priestorových dát (PLY, LOX) v aplikácii LochViewer.

## 1. Rekonštrukcia povrchu (Surface Reconstruction)

Aplikácia podporuje tri hlavné režimy rekonštrukcie pre mračná bodov (LiDAR).

### 1.1 Surface Nets (Dual Contouring)
Moderný algoritmus na generovanie uzavretých sietí z voxelových dát.
- **Princíp**: Pre každú voxelovú bunku, ktorá obsahuje body, sa vypočíta ťažisko (centroid). Ak susedná bunka je prázdna (vzhľadom na exteriérovó záplavu), vygeneruje sa štvoruholník medzi centroidmi okolitých buniek.
- **Vzorec pre centroid**:
  $$C = \frac{1}{N} \sum_{i=1}^{N} P_i$$
  kde $P_i$ sú body vo vnútri voxelu.

### 1.2 Silk/Fabric Smoothing (Laplacian)
Algoritmus na dosiahnutie efektu "hodvábu" natiahnutého na jaskynný model.
- **Princíp**: Každý vrchol sa posúva smerom k priemernému stredu svojich susedov s vysokým koeficientom napätia.
- **Iteračný vzorec**:
  $$V_{new} = V_{old} + \lambda \cdot (\text{Average}(V_{neighbors}) - V_{old})$$
  V LochViewer používame $\lambda = 0.6$ pre silný vyhladzovací efekt (tzv. "silk effect").

### 1.3 Taubin Smoothing (Volume Preserving)
Používa sa pre presné (Accurate) modely na odstránenie šumu bez straty objemu.
- **Princíp**: Dvojfázový cyklus s kladným ($\lambda$) a záporným ($\mu$) krokom.
- **Vzorce**:
  1. $V' = V + \lambda \cdot \Delta V$
  2. $V'' = V' + \mu \cdot \Delta V'$
  kde $\lambda > 0$ a $\mu < -\lambda$ (typicky $\lambda = 0.5, \mu = -0.53$).

### 1.4 Dilation / Bulge (Model Offset)
Umožňuje "nafúknutie" alebo "zúženie" výsledného meshu posunom vrcholov v smere ich normál.
- **Princíp**: Každý vrchol $V$ sa posunie o hodnotu $d$ (dilation) v smere normály $N$.
- **Vzorec**:
  $$V_{final} = V_{smooth} + (d \cdot N)$$
  Kde $N$ je vážený priemer normál okolitých trojuholníkov.

---

## 2. Spracovanie a Interakcia

### 2.1 LiDAR Raycasting & LOD (Level of Detail)
Aplikácia používa progresívny systém zjemňovania pre plynulosť pri obrovských dátach.
- **Dynamický Stride**: Počas pohybu kamery sa vykresľuje len každý 16. bod (stride=16).
- **Progresívne zjemňovanie**: Po zastavení kamery sa v 4 krokoch dopĺňajú zvyšné body (16 -> 8 -> 4 -> 2 -> 1), kým model nedosiahne plnú vernosť.
- **Voxelová mriežka**: Pre rýchlu detekciu duplicity a rovnomernú decimáciu používame 3D hash mriežku s limitom 1 000 000 unikátnych bodov pre GPU buffer.

### 2.2 Režim merania a Gating interakcie
Implementovali sme striktnú logiku filtrovania udalostí na ochranu pred náhodným výberom LiDAR dát.
- **Navigation Mode**: Raycaster ignoruje vrstvy `PointCloud`, `OrganicShell` a `TerrainMesh`.
- **Polygon Filtering**: V komponente `ClickableStations` sú povolené len stanice s príznakom `isPolygon` (t.j. stanice s menom z LOX/PLT).
- **Measurement Mode**: Aktivuje všetky vrstvy a umožní presné meranie vzdialeností a súradníc na ľubovoľnom povrchu.

### 2.3 Vertikálne profilovanie (Clipping)
V LochViewer implementujeme analytické rezanie cez `clippingPlanes`.
- **Rovnica roviny**:
  $$ax + by + cz + d = 0$$
  Pre profilový rez definujeme normálu roviny pomocou dvoch vybraných bodov (meracích staníc) a vertikálneho vektora.

### 2.4 Adaptívny Rotačný Gizmo (Adaptive Rotation Gizmo)
Nový vizuálny nástroj pre presnú orientáciu v 3D priestore.
- **Geometria**: Skladá sa z troch torusov (prstencov) a valcov pre každú os ($x, y, z$).
- **Dynamické škálovanie**: Gizmo automaticky prispôsobuje svoju veľkosť podľa celkových rozmerov modelu (diagonála bounding boxu).
  - **Vzorec mierky**:
    $$S_{gizmo} = \text{Diagonal}(Cave) \cdot 0.45$$
- **Smart Visibility**: Aktivuje sa len počas detekcie pohybu v scéne, aby nerušil statický náhľad na model.
- **Tenké línie**: Hrúbka čiar je normalizovaná voči mierke modelu ($S \cdot 10^{-4}$), čo zabezpečuje konzistentný "premium" vzhľad.

---

## 3. Georeferencovanie a Transformácie
Spracovanie rôznych súradnicových systémov pre správne pasovanie jaskyne a terénu.

### 3.1 UTM (Universal Transverse Mercator)
Konverzia metrických súradníc na WGS84 stupne (lat/lon).
- **Zóny**: Aplikácia automaticky deteguje zóny 33N a 34N (Slovensko), pričom podporuje celý rozsah 1-60.
- **Vzorec**: Používa sa Krügerova séria pre výpočet meridiánového oblúka a následnú transformáciu na sféroid WGS84.

### 3.2 S-JTSK (Krovák)
Špeciálna kónická konformná projekcia používaná v SR/ČR.
- **Implementácia**: Používa `proj4js` s definíciou EPSG:5514. 
- **Heuristika**: Ak sú súradnice v rozsahu záporných hodnôt (typické pre Therion .lox v našom regióne), aplikácia automaticky skúša Krovákovu projekciu.

---

## 4. Terénny XYZ Scraping a Interpolácia
Sťahovanie a vizualizácia externých ortofotomáp a DMR5 modelov.

### 4.1 XYZ Tile Downloader
Sťahovanie dlaždíc v pyramídovom systéme (napr. Google/Bing maps štýl).
- **Vzorec pre súradnice dlaždice (z lat/lon)**:
  $$x = \lfloor \frac{lon + 180}{360} \cdot 2^z \rfloor$$
  $$y = \lfloor (1 - \frac{\ln(\tan(lat \cdot \frac{\pi}{180}) + \frac{1}{\cos(lat \cdot \frac{\pi}{180})})}{\pi}) \cdot 2^{z-1} \rfloor$$
  kde $z$ je úroveň priblíženia (zoom level).

### 4.2 Bilineárna interpolácia výšky
Pre výpočet presnej výšky bodu medzi bodmi rastra DTM/GeoTIFF.
- **Vzorec**:
  $$z = z_{00}(1-f_c)(1-f_r) + z_{10}f_c(1-f_r) + z_{01}(1-f_c)f_r + z_{11}f_cf_r$$
  kde $f_c, f_r$ sú relatívne pozície (0-1) v rámci bunky rastra.

---

## 5. Manuálna Kalibrácia Polohy
Umožňuje používateľovi korigovať nesprávne exportované dáta priamo v UI.

### 5.1 Shift Transfomácia (X, Y, Z)
Lineárny posun celého jaskynného systému (vrátane staníc a mračien bodov).
- **Matematicky**: $P_{new} = P_{old} + O$, kde $O$ je vektor offsetu $[x, y, z]$.
- **Krok**: 0.5 metra pre jemné doladenie v reálnom čase.

---
## 6. Autonómna LiDAR Segmentácia (Mold Parting Line)

Tento pokročilý algoritmus umožňuje úplne autonómne oddelenie podlahy a stropu priamo z 3D mračna bodov (PLY) **bez akejkoľvek závislosti na stredovej línii (centerline) alebo `.lox` súboroch**.

### 6.1 Midpoint Analysis (CPU - Web Worker)
Počas načítania PLY súboru vo Web Workeri rozdelíme 3D priestor jaskyne do vertikálnych stĺpcov (2D mriežka) s veľkosťou bunky $d_{cell} = 0.5 \text{ metra}$.

Pre každý stĺpec $(gx, gy)$ analyzujeme vertikálne rozloženie bodov:
1. **Extrémy**: Zistíme minimálnu a maximálnu nadmorskú výšku v stĺpci $[Z_{min}, Z_{max}]$.
2. **Deliaca čiara (Midpoint)**: Vypočítame geometrický stred chodby $Z_{mid} = \frac{Z_{min} + Z_{max}}{2}$.
3. **Relatívna výška**: Pre každý bod $P$ v stĺpci vypočítame relatívnu pozíciu $d_{rel}$ voči stredu:
   $$d_{rel} = \frac{P_z - Z_{mid}}{H_{half}}$$
   kde $H_{half} = \frac{Z_{max} - Z_{min}}{2}$. Výsledná hodnota $d_{rel} \in [-1.0, 1.0]$ sa odošle do GPU.
   - **-1.0**: Bod leží presne na dne (podlaha).
   - **0.0**: Bod leží presne v strede výšky chodby (deliaca čiara).
   - **1.0**: Bod leží presne na strope.

Tento prístup "formy" zaručuje, že aj v úzkych vysokých meandroch bude podlaha končiť presne v polovici výšky, čím sa eliminujú neprirodzene vysoké bočné steny.

### 6.2 Dynamická GPU Filtrácia (Shader)
Do Fragment Shaderu prenášame pre každý bod relatívnu výšku `vRelHeight` ($d_{rel}$) a model-space normálu `vModelNormal` ($\vec{N}_{model}$).
V shaderi vyhodnocujeme viditeľnosť v reálnom čase pomocou používateľských prahov:
* $H_{threshold}$ (`uHeightThreshold`): posun deliacej roviny (predvolene $0.0$).
* $A_{threshold}$ (`uAngleThreshold`): filtrácia strmosti stien (predvolene $0.3$).

1. **Podmienka pre Podlahu (Floor):**
   $$\text{isFloor} = (d_{rel} < H_{threshold}) \land (\neg hasNormals \lor N_{model, y} > A_{threshold})$$
2. **Podmienka pre Strop (Ceiling):**
   $$\text{isCeiling} = (d_{rel} > H_{threshold}) \land (\neg hasNormals \lor N_{model, y} < -A_{threshold})$$

---
*Dokumentácia verzie: release-2026-06-01-01*

