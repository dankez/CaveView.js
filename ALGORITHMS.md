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
## 6. Autonómna LiDAR Segmentácia (Floor & Ceiling Voxelization)

Tento pokročilý algoritmus umožňuje úplne autonómne oddelenie podlahy a stropu priamo z 3D mračna bodov (PLY) **bez akejkoľvek závislosti na stredovej línii (centerline) alebo `.lox` súboroch**.

### 6.1 Height Bucket Clustering & Gap Detection (CPU - Web Worker)
Počas načítania PLY súboru vo Web Workeri rozdelíme 3D priestor jaskyne do vertikálnych stĺpcov (2D mriežka v rovine X-Y súradníc JTSK) s jemnou veľkosťou bunky $d_{cell} = 0.5 \text{ metra}$.

Pre každý stĺpec $(gx, gy)$ analyzujeme vertikálne rozdelenie výšok (súradnica Z v JTSK) pomocou **výškových vedierok (buckets)** s veľkosťou $h_{bucket} = 0.2 \text{ metra}$ (20 cm):

1. Zistíme rozsah výšok $[Z_{min}, Z_{max}]$ v stĺpci.
2. Ak je celková výška stĺpca $Z_{max} - Z_{min} < 0.4 \text{ metra}$, ide o plochý úsek a celá bunka sa prehlási za podlahu aj strop súčasne bez potreby analýzy medzier.
3. Inak vytvoríme binárne pole obsadenosti vedierok $B$ s veľkosťou $M = \lceil \frac{Z_{max} - Z_{min}}{h_{bucket}} \rceil + 1$:
   $$B[j] = \begin{cases} 1 & \text{ak v stĺpci existuje bod } P_z \in [Z_{min} + j \cdot h_{bucket}, Z_{min} + (j+1) \cdot h_{bucket}) \\ 0 & \text{inak} \end{cases}$$
4. **Detekcia súvislej podlahy (zdola nahor):**
   Postupujeme od najnižšieho vedierka $j = 0$ nahor. Hľadáme prvú súvislú prázdnu medzeru $\ge 0.4 \text{ metra}$ (dve po sebe idúce prázdne vedierka $B[k] = 0 \land B[k+1] = 0$). Na tomto indexe $k$ sa podlaha zastaví:
   $$Z_{floor\_max} = Z_{min} + k \cdot h_{bucket}$$
   Všetky body ležiace pod $Z_{floor\_max}$ sú klasifikované ako skutočná podlaha (vrátane spadnutých balvanov a stupňov na zemi).
5. **Detekcia súvislého stropu (zhora nadol):**
   Postupujeme od najvyššieho vedierka $j = M-1$ nadol. Hľadáme prvú súvislú prázdnu medzeru $\ge 0.4 \text{ metra}$. Na tomto indexe $m$ sa strop zastaví:
   $$Z_{ceil\_min} = Z_{min} + m \cdot h_{bucket}$$
   Všetky body ležiace nad $Z_{ceil\_min}$ sú klasifikované ako skutočný strop (vrchná klenba jaskyne).
6. **Výpočet relatívnej výšky bodu ($d_{rel} \in [-1.0, 1.0]$):**
   Pre každý bod $P$ v stĺpci vypočítame relatívnu výšku, ktorá sa odošle do GPU:
   $$d_{rel} = \begin{cases} -1.0 + 0.8 \cdot \frac{P_z - Z_{min}}{Z_{floor\_max} - Z_{min}} & \text{pre } P_z \le Z_{floor\_max} \\ 0.2 + 0.8 \cdot \frac{P_z - Z_{ceil\_min}}{Z_{max} - Z_{ceil\_min}} & \text{pre } P_z \ge Z_{ceil\_min} \\ 0.0 & \text{pre body vo vzdušnej medzere (previsy, stalaktity vo vzduchu)} \end{cases}$$

### 6.2 Stabilná Model Space filtrácia a ošetrenie modelov bez normál (GPU)
Do Fragment Shaderu prenášame pre každý bod relatívnu výšku `vRelHeight` ($d_{rel}$) a surovú model-space normálu `vModelNormal` ($\vec{N}_{model}$).
V shaderi vyhodnocujeme podmienky rezu v reálnom čase na základe používateľom nastavených posuvníkov citlivosti:
* $H_{threshold}$ (`uHeightThreshold`): rozsah $[-0.8, 0.8]$, predvolene $0.1$.
* $A_{threshold}$ (`uAngleThreshold`): rozsah $[0.0, 0.9]$, predvolene $0.3$.

1. **Detekcia normál:** Ak súbor PLY nemá normály, ich dĺžka v shaderi je takmer nulová:
   $$hasNormals = \|\vec{N}_{model}\| > 0.1$$
2. **Podmienka pre Podlahu (Floor):**
   $$\text{isFloor} = (d_{rel} < H_{threshold}) \land (\neg hasNormals \lor N_{model, y} > A_{threshold})$$
3. **Podmienka pre Strop (Ceiling):**
   $$\text{isCeiling} = (d_{rel} > -H_{threshold}) \land (\neg hasNormals \lor N_{model, y} < -A_{threshold})$$
4. **Vrstevnicový algoritmus (1m Contours):**
   V režime vrstevníc na podlahe vykresľujeme ostré izolínie pomocou gradientnej interpolácie:
   $$t_{fract} = \text{fract}(P_{world\_y} + 0.5) - 0.5$$
   $$I_{contour} = 1.0 - \text{smoothstep}(0.0, W_{contour}, |t_{fract}|)$$
   Kde $W_{contour} = 0.03 \text{ metra}$ (šírka čiary 3 cm). Pre hlavnú zvýraznenú vrstevnicu každých 5 metrov ($I_{index\_contour}$):
   $$t_{index} = \text{fract}\left(\frac{P_{world\_y}}{5.0} + 0.5\right) - 0.5$$
   $$I_{index\_contour} = 1.0 - \text{smoothstep}(0.0, W_{contour} \cdot 1.5, |t_{index}| \cdot 5.0)$$
   Výsledná farba bodu sa zmieša s tmavou bridlicovou základnou farbou a zlatou (indexovou) alebo striebornou farbou vrstevnice na základe vypočítaných intenzít.

---
*Dokumentácia verzie: release-2026-05-25-01*

