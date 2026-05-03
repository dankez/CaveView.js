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

---

## 2. Spracovanie a Interakcia

### 2.1 LiDAR Raycasting (Point Cloud Hit Detection)
Aby bolo možné merať vzdialenosti na mračnách bodov s miliónmi prvkov, používame adaptívny raycasting.
- **Threshold**: Nastavený na $0.5m$ (v porovnaní so štandardným $0.1m$), čo zabezpečuje spoľahlivé zachytenie bodov aj pri redších skenoch.
- **LOD (Level of Detail)**: Dynamické vykresľovanie drawRange podľa vzdialenosti kamery pre udržanie 60 FPS.

### 2.2 Vertikálne profilovanie (Clipping)
V LochViewer implementujeme analytické rezanie cez `clippingPlanes`.
- **Rovnica roviny**:
  $$ax + by + cz + d = 0$$
  Pre profilový rez definujeme normálu roviny pomocou dvoch vybraných bodov (meracích staníc) a vertikálneho vektora.

---

## 3. Formáty dát

### 3.1 PLY (Polygon File Format)
- Podporujeme binárne aj ASCII kódovanie.
- **Vertex Extraction**: Automatická detekcia atribútov `x, y, z` a `red, green, blue` pre vizualizáciu textúr.

### 3.2 LOX (Loch Viewer XML)
- Proprietárny XML formát pre jaskynné polygóny.
- **Indexovanie**: Prevod lokálnych súradníc staníc na globálny jaskynný priestor s centrovaním na ťažisko modelu.

---
*Dokumentácia verzie: release-2026-05-03-1*
