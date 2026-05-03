# Technická Dokumentácia Algoritmov (LochViewer v1.3.1)

Táto dokumentácia popisuje matematické a technické postupy použité pri generovaní 3D modelov jaskýň z mračien bodov (LiDAR) a prieskumných dát (LOX).

---

## 1. Rekonštrukcia Povrchu (Triangle Mesh)

Základná metóda pre generovanie škrupiny jaskyne z bodov.

### A. Voxelizácia a Extrakcia Plôch
Bodové mračno je diskretizované do 3D mriežky (Grid) s veľkosťou bunky $\Delta$. 
- **Presný model:** $\Delta = 0.2m$
- **Organický model:** $\Delta = 0.5m$ (prirodzené filtrovanie šumu)

Bunka je označená ako obsadená ($V_{i,j,k} = 1$), ak obsahuje aspoň jeden bod. 
Plocha (Face) je generovaná na hranici medzi obsadenou a prázdnou bunkou:
$$ \partial V = \{ f_{face} \mid \text{Cell}_{occupied} \cap \text{Cell}_{empty} \} $$

### B. Taubin Smoothing (Non-shrinking)
Používa sa pre **Triangle Mesh** (Presný model). Klasický Laplacian spôsobuje zmenšovanie (shrinking) modelu. Taubin tento efekt eliminuje pomocou dvoch krokov s opačnými koeficientmi $\lambda$ a $\mu$.

1. **Lambda krok (Smršťovanie):** $X' = X + \lambda \cdot L(X)$
2. **Mu krok (Expandovanie):** $X'' = X' + \mu \cdot L(X')$

Kde:
- $L(X)$ je diskrétny Laplacian: $L(x_i) = \frac{1}{|N_i|} \sum_{j \in N_i} (x_j - x_i)$
- Parametre: $\lambda = 0.5$, $\mu = -0.53$ (musí platiť $\mu < -\lambda < 0$)

### C. Silk Laplacian (Membrane Effect)
Používa sa pre **Organický / Vyhladený** model. Algoritmus simuluje povrchové napätie membrány natiahnutej cez body.

Vzorec pre každú iteráciu:
$$ X_{new} = X + k_{organic} \cdot \left( \frac{1}{|N|} \sum_{j \in N} X_j - X \right) $$

Kde $k_{organic}$ je koeficient organickosti (štandardne $0.5$). 
Počet iterácií $I$ závisí od nastavenia posuvníka:
$$ I = 5 + 2 \cdot \text{OrganicLevel} $$
Vyšší počet iterácií spôsobuje plynulejšie, „hodvábne“ prechody pripomínajúce latku alebo pavučinu.

---

## 2. Surface Nets (Dual Contouring)

Metóda generujúca plynulejšiu topológiu priamo počas extrakcie.

### A. Dual Grid Centroids
Namiesto generovania stien na hraniciach voxelov, Surface Nets umiestňuje vrcholy (Vertices) do ťažísk voxelov na rozhraní.
$$ V_{centroid} = \text{Center}(V_{i,j,k}) $$

### B. Morfologická Dilatácia (Hole Filling)
Pre LiDAR dáta s dierami používame rozšírenie mriežky:
$$ V_{new} = V \oplus B = \{ z \mid (\hat{B})_z \cap V \neq \emptyset \} $$
Toto vyplní medzery menšie ako 0.5m, čím vytvorí súvislý model bez dier.

---

## 3. Angle-Weighted Normals (Premium Shading)

Pre hladký vzhľad používame vážený priemer normál podľa uhlov pri vrcholoch.
Výsledná normála vrcholu $\vec{n}_v$:
$$ \vec{n}_v = \frac{\sum_{i \in F_v} \alpha_i \vec{n}_{f,i}}{\|\sum_{i \in F_v} \alpha_i \vec{n}_{f,i}\|} $$

Kde $\alpha_i$ je vnútorný uhol plochy pri vrchole:
$$ \alpha_i = \arccos \left( \frac{\vec{e}_1 \cdot \vec{e}_2}{\|\vec{e}_1\| \|\vec{e}_2\|} \right) $$

---

## 4. Súradnicový Systém a Zarovnanie

LochViewer používa konzistentné mapovanie pre krížovú kompatibilitu medzi LOX a PLY:
- **X-os:** Východ (East)
- **Y-os:** Výška (Altitude / Z v jaskynných dátach)
- **Z-os:** Sever (North)

Transformácia z PLY/LiDAR $(x, y, z)$ do LochViewer $(X, Y, Z)$:
$$ X_{lv} = x_{ply} $$
$$ Y_{lv} = z_{ply} $$
$$ Z_{lv} = -y_{ply} $$

Tento štandard zabezpečuje, že modely vygenerované z rôznych zdrojov sa v 3D scéne automaticky zarovnajú na seba.
