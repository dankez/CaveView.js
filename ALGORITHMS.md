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

### 2.2 Vertikálne profilovanie (Clipping)
V LochViewer implementujeme analytické rezanie cez `clippingPlanes`.
- **Rovnica roviny**:
  $$ax + by + cz + d = 0$$
  Pre profilový rez definujeme normálu roviny pomocou dvoch vybraných bodov (meracích staníc) a vertikálneho vektora.

---

## 4. Používateľské rozhranie (UI)

### 4.1 Adaptívny Rotačný Gizmo (Adaptive Rotation Gizmo)
Nový vizuálny nástroj pre presnú orientáciu v 3D priestore.
- **Geometria**: Skladá sa z troch torusov (prstencov) a valcov pre každú os ($x, y, z$).
- **Dynamické škálovanie**: Gizmo automaticky prispôsobuje svoju veľkosť podľa celkových rozmerov modelu (diagonála bounding boxu).
  - **Vzorec mierky**:
    $$S_{gizmo} = \text{Diagonal}(Cave) \cdot 0.45$$
- **Smart Visibility**: Aktivuje sa len počas detekcie pohybu v scéne, aby nerušil statický náhľad na model.
- **Tenké línie**: Hrúbka čiar je normalizovaná voči mierke modelu ($S \cdot 10^{-4}$), čo zabezpečuje konzistentný "premium" vzhľad.

---
## 5. Odstraňovanie stropu (Ceiling Removal)

Analytický nástroj pre lepšiu vizualizáciu interiérov jaskynných chodieb pri LiDAR skenoch aj LOX modeloch.

### 5.1 Normálové filtrovanie (Normal-based Discarding)
Tento algoritmus využíva smer normály povrchu na identifikáciu častí modelu, ktoré tvoria strop.
- **Princíp**: V GPU shaderi sa pre každý fragment (pixel) vypočíta svetová normála. Ak jej vertikálna zložka ($y$) klesne pod definovanú hranicu (cutoff), fragment sa zahodí (`discard`).
- **Logika**:
  - **Podlaha**: Normála smeruje hore ($y \approx 1.0$).
  - **Steny**: Normála smeruje do strán ($y \approx 0.0$).
  - **Strop**: Normála smeruje dole ($y \approx -1.0$).
- **Prahová funkcia**:
  $$\text{Render}(f) = \begin{cases} \text{render} & \text{ak } N_{y} \ge \text{Cutoff} \\ \text{discard} & \text{ak } N_{y} < \text{Cutoff} \end{cases}$$
- **Využitie**: Primárne pre LiDAR rekonštrukcie (OrganicShell) a LOX steny, kde umožňuje "odkryť" jaskyňu a vidieť dno chodby bez nutnosti manuálneho nastavovania orezových rovín. Tento prístup zachováva dno a spodnú časť stien, čím vytvára efekt "odrezanej strechy".

---
*Dokumentácia verzie: release-2026-05-06-04*
