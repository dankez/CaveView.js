# 📖 LochViewer - Kompletná používateľská príručka (v2.4.15)

*Webová 3D platforma pre vizualizáciu, speleologické meranie a analýzu jaskynných systémov a LiDAR dát.*  
*Oficiálny portál: [loch.sss.sk](https://loch.sss.sk)*

---

## 📑 Obsah
1. [Podporované formáty a načítanie dát](#1-podporované-formáty-a-načítanie-dát)
2. [Používateľské rozhranie (Horná lišta a nástroje)](#2-používateľské-rozhranie-horná-lišta-a-nástroje)
3. [Navigácia v priestore a technické pohľady](#3-navigácia-v-priestore-a-technické-pohľady)
4. [Modelovanie 3D stien z laserových lúčov (Splay SDF)](#4-modelovanie-3d-stien-z-laserových-lúčov-splay-sdf)
5. [Nástroje merania vzdialeností, plôch a štruktúrnej geológie (Tektonika)](#5-nástroje-merania-vzdialeností-plôch-a-štruktúrnej-geológie-tektonika)
6. [Priestorové rezy a profilové analýzy (Z-Clipping)](#6-priestorové-rezy-a-profilové-analýzy-z-clipping)
7. [Práca s LiDAR mračnami bodov (Engine v2 NextGen)](#7-práca-s-lidar-mračnami-bodov-engine-v2-nextgen)
8. [Povrchový terén, oficiálny GKÚ ZBGIS WMS a 3D kalibrácia](#8-povrchový-terén-oficiálny-gkú-zbgis-wms-a-3d-kalibrácia)
9. [Zdieľanie modelov a vkladanie cez Iframe (Embed)](#9-zdieľanie-modelov-a-vkladanie-cez-iframe-embed)
10. [Prehľad klávesových skratiek a gest](#10-prehľad-klávesových-skratiek-a-gest)

---

## 1. Podporované formáty a načítanie dát

LochViewer spracováva dáta priamo vo vašom internetovom prehliadači prostredníctvom WebGL a paralelných Web Workerov. Vaše dáta sa neposielajú na žiadny cudzí server – spracovanie je 100% lokálne a bezpečné.

### Podporované formáty súborov:
* **`.lox` (Therion / Loch)**: Základný štandard speleologických 3D modelov. Obsahuje polygónový ťah (centerline), stanice, laserové lúče (splays), ručne kreslené polygóny stien (scraps), povrchový terén (DTM) a mapové textúry.
* **`.3d` (Survex)**: Štandardný formát softvéru Survex. Podporuje podzemné aj povrchové polygónové ťahy a stanice.
* **`.plt` (Compass)**: Formát speleologického programu Compass obsahujúci polygonálne traverzy a shoty.
* **`.ply` (LiDAR Point Cloud)**: Binárne aj textové mračná bodov s podporou miliónov bodov, RGB farieb, intenzity odrazu a klasifikácií.
* **`.stl` (3D Mesh)**: Trojrozmerné triangulované siete jaskynných priestorov vytvorené laserovým skenovaním alebo fotogrametriou.
* **`.tif / .tiff` (GeoTIFF) + `.tfw`**: Digitálne modely reliéfu (DMR) a ortofotomapy v súradnicovom systéme S-JTSK Křovák alebo UTM.

### Spôsoby načítania modelu:
1. **Presunutie myšou (Drag & Drop)**: Potiahnite ľubovoľný podporovaný súbor zo svojho počítača a pustite ho priamo do okna prehliadača.
2. **Tlačidlo Otvoriť súbor**: Na úvodnej obrazovke kliknite na tlačidlo **„Vybrať 3D súbor“**.
3. **URL parameter**: Model je možné načítať priamo z webovej adresy pomocou parametra `?model=https://...` (napr. z Google Drive alebo vlastného servera).

---

## 2. Používateľské rozhranie (Horná lišta a nástroje)

Po načítaní modelu sa v hornej časti zobrazuje moderná piktogramová lišta umožňujúca okamžité ovládanie všetkých funkcií:

| Ikona | Názov nástroja | Popis funkcie |
| :--- | :--- | :--- |
| 📷 | **Exportovať snímku (PNG)** | Vytvorí snímku aktuálneho 3D pohľadu vo vysokom rozlíšení vrátane legendy, mierky a severky. |
| 🧊 / 📐 | **Projekcia kamery (O)** | Prepína medzi **Perspektívou** (realistická 3D hĺbka) a **Ortogonálnym zobrazením** (technická axonometria bez skreslenia vzdialeností). |
| ⛶ | **Prispôsobiť na stred (Fit)** | Automaticky vycentruje a priblíži celý jaskynný systém do zorného poľa kamery. |
| 📈 | **Polygonálny ťah (Centerline)** | Zapína / vypína zobrazenie kostry jaskynného ťahu so zameranými stanicami. |
| 🪨 | **Model stien (Walls)** | Prepína zobrazenie plných 3D stien jaskyne (Therion scraps, Splay SDF model, STL sieť). |
| 🏔️ | **Povrchový terén (Terrain)** | Zobrazuje / skrýva 3D model nadložného povrchu, DMR tieňovanie alebo satelitnú mapu. |
| 🔲 | **Ohraničujúci kváder (Box)** | Zobrazí priestorový bounding box s vyznačením rozmerov $X, Y, Z$ a celkového prevýšenia jaskyne. |
| ✂️ | **Horizontálny rez (Z-Clip)** | Otvorí plávajúci posuvník pre horizontálne zrezávanie modelu podľa nadmorskej výšky. |
| ⚡ | **Laserové lúče (Splays)** | Zobrazí všetky pomocné laserové lúče zamerané zo staníc k stenám jaskyne. |
| 📏 / 📐 | **Merací nástroj (3-Stavový)** | Cyklický prepínač merania: **Vypnuté** ➡️ **Vzdialenosť (2 body)** ➡️ **Plocha/Polygón (3+ body)**. |
| 🎨 | **Farebná schéma** | Prepína medzi speleologickým výškovým spektrom, jednofarebným technickým materiálom a gradientom. |
| 📊 | **Výškový systém (ABS / REL)** | Prepína výškové zobrazenie medzi absolútnou nadmorskou výškou ($m\ \text{n. m.}$) a relatívnou výškou k vchodu ($+120\ \text{m},\ -35\ \text{m}$). |
| ❓ | **Návod a Pomocník** | Otvorí interaktívneho sprievodcu funkciami a klávesovými skratkami priamo v aplikácii. |
| 🔗 | **Zdieľať (Share)** | Vygeneruje trvalý odkaz a HTML kód `<iframe>` pre vloženie modelu na webstránku. |
| ✖ | **Zavrieť model** | Uvoľní pamäť a vráti vás na úvodnú obrazovku. |

---

## 3. Navigácia v priestore a technické pohľady

### Základné ovládanie myšou:
* **Ľavé tlačidlo myši + potiahnutie**: Otáčanie modelu okolo stredu záujmu (Orbit).
* **Pravé tlačidlo myši (alebo Shift + Ľavé tlačidlo)**: Posun pohľadu (Pan).
* **Koliesko myši**: Plynulé približovanie a vzďaľovanie (Zoom).
* **Dvojklik na stanicu alebo stenu**: Hladký prelet kamery (Street View flight) k vybranému miestu.

### Smerová ružica (Severka & Živý azimut):
V ľavom hornom rohu 3D scény sa nachádza speleologická smerová ružica. Červená šípka neustále ukazuje smer ku geografickému Severu. Pod ružicou sa v reálnom čase zobrazuje presný azimut pohľadu (napr. `045° SV`). Kliknutím na ružicu sa kamera okamžite vyrovná na čistý pohľad zhora orientovaný na Sever.

### Rýchle technické pohľady (Klávesy 1 – 4):
Pre potreby presného mapovania a tvorby meračských máp obsahuje aplikácia klávesové skratky, ktoré okamžite prepnú ortogonálnu projekciu do štandardných speleologických rovín:
* **Kláves `1` — Pôdorys (Plan View)**: Kolmý pohľad zhora ($X-Y$), zarovnaný so severným poludníkom.
* **Kláves `2` — Pozdĺžny profil (Profile / Front)**: Čelný pohľad z juhu na sever ($X-Z$) v presnej mierke 1:1 bez perspektívneho skreslenia.
* **Kláves `3` — Priečny profil / Bokorys (Section / Side)**: Bočný profil zo západu na východ ($Y-Z$).
* **Kláves `4` — 3D Izometria (Axonometry)**: Priestorový trojosový pohľad pod uhlom $45^\circ$.

---

## 4. Modelovanie 3D stien z laserových lúčov (Splay SDF)

Tradičné jaskynné polygóny často obsahujú stovky až tisíce laserových zameraní (splays), ktoré bežné programy zobrazujú len ako „ježka“ z čiar. LochViewer obsahuje revolučný rekonštrukčný algoritmus **Splay Signed Distance Fields (SDF)**, ktorý beží na pozadí vo Web Workeri a vytvára hladkú, organickú a uzavretú 3D sieť jaskynných chodieb.

### Ako pracovať so Splay SDF stenami:
1. V bočnom paneli (záložka **Jaskyňa** $\to$ sekcia **Steny jaskyne**) aktivujte prepínač **Splay SDF Walls (3D)**.
2. V stavovom riadku sa zobrazí indikátor výpočtu. Akonáhle worker dopočíta sieť, model sa okamžite vykreslí v scéne.
3. **Session Cache**: Vygenerovaný model sa uloží do dočasnej pamäte prehliadača. Pri ďalšom zapnutí/vypnutí je zobrazenie okamžité bez čakania.

### Nastaviteľné parametre:
* **Vyhladenie (Smoothness / smin)**: Určuje mieru organického zliatia stien medzi jednotlivými lúčmi (nižšia hodnota = presnejšie a ostrejšie hrany, vyššia hodnota = hladší povrch).
* **Polomer kapsule (Capsule Radius / srad)**: Určuje hrúbku virtuálneho obalu okolo lúčov.
* **Farbenie podľa výšky (Color by height)**: Zafarbí SDF steny podľa hypsometrickej speleologickej škály.

---

## 5. Nástroje merania vzdialeností, plôch a štruktúrnej geológie (Tektonika)

Kliknutím na ikonu pravítka v hornej lište alebo v bočnom paneli aktivujete vyhradený merací režim s plávajúcim dokovateľným panelom (`MeasurementPanel`).

### 1. Meranie vzdialenosti (2 body):
* Kliknite na počiatočný bod $P_1$ a koncový bod $P_2$ (stanice alebo splay body).
* **Zobrazené veličiny**:
  * **3D priama vzdialenosť**: reálna dĺžka spojnice v metroch.
  * **Pôdorysná (horizontálna) vzdialenosť**: priemet do roviny $X-Y$.
  * **Prevýšenie ($\Delta H$)**: vertikálny rozdiel nadmorských výšok.
  * **Azimut spojnice**: smer v stupňoch ($0^\circ - 360^\circ$).
  * **Sklon spojnice**: uhol v stupňoch od vodorovnej roviny.

### 2. Meranie plochy a polygónu (3 a viac bodov):
* Postupným klikaním definujte obvod priestoru ($P_1, P_2, P_3 \dots$).
* **Zobrazené veličiny**:
  * **3D Plocha ($m^2$)**: skutočná plocha preloženej priestorovej roviny.
  * **Pôdorysná plocha ($m^2$)**: plošný priemet do mapy.
  * **Obvod polygónu ($m$)**: celková dĺžka trasy.

### 3. Štruktúrna geológia a Tektonické meranie (3-bodová rovina):
* Zvoľte 3 body na pukline, vrstvovej ploche alebo stene jaskyne.
* Aplikácia okamžite vypočíta geologické parametre diskontinuity:
  * **Dip (Sklon po spádnici)**: uhol sklonu geologickej vrstvy ($0^\circ$ vodorovná, $90^\circ$ zvislá).
  * **Dip Direction (Azimut spádnice)**: geografický smer, ktorým vrstva upadá ($0^\circ - 360^\circ$).
  * **Strike (Smerník / Smer vrstvy)**: smer kolmý na spádnicu ($\text{Dip Direction} \pm 90^\circ$).
  * **Normála roviny**: priestorový jednotkový vektor $\vec{n} = (n_x, n_y, n_z)$.
  * V 3D scéne sa zobrazí polopriehľadný disk preloženej roviny s vyznačenou spádnicou.

---

## 6. Priestorové rezy a profilové analýzy (Z-Clipping)

Pre detailné skúmanie poschodových jaskýň a horizontálnych úrovní slúži nástroj **Horizontálny rez (Z-Clip)**:
1. Kliknite na ikonu nožníc ✂️ v hornej lište.
2. V pravom hornom rohu sa vysunie **Plávajúci posuvník rezu**.
3. Pohybom jazdca plynulo zrezávate nadložie modelu.
4. Nad posuvníkom sa v reálnom čase zobrazuje presná **nadmorská výška rezu** v metroch (v absolútnom aj relatívnom móde).
5. Hrany pretínajúce steny a terén sú vizuálne zvýraznené žiarivou obrysovou líniou.

---

## 7. Práca s LiDAR mračnami bodov (Engine v2 NextGen)

Pre masívne laserové skeny a point cloud súbory (`.ply`) je integrovaný špecializovaný motor **Engine v2 NextGen**:

* **Octree LOD (Level of Detail)**: Umožňuje plynulé zobrazovanie modelov s desiatkami miliónov bodov pri 60 FPS vďaka hierarchickému dynamickému načítavaniu iba viditeľných častí.
* **Eye-Dome Lighting (EDL)**: Pokročilý post-processing shader, ktorý vykresľuje plastické tieňovanie a zvýrazňuje jemné reliéfne detaily stien (kvaple, pukliny, záseky) bez nutnosti náročného generovania sietí.
* **Interaktívne úpravy bodov (LiDAR Editor)**:
  * **Guma (Erase brush)**: Umožňuje kruhovým štetcom vymazať nežiaduce body (vegetáciu, šum, odrazy).
  * **Ponechať (Keep brush)**: Izoluje iba vybranú časť jaskyne a zvyšok zahodí.
* **Export 2D Mapy z LiDARu**: Nástroj v bočnom paneli vytvorí ortofotografický pôdorysný raster s vysokým rozlíšením priamo z hustoty bodov a umožní stiahnutie vo formáte PNG.

---

## 8. Povrchový terén, oficiálny GKÚ ZBGIS WMS a 3D kalibrácia

Jaskyňa neexistuje vo vákuu – pochopenie jej vzťahu k povrchovému reliéfu je kľúčové pre speleologický prieskum:

1. **Oficiálny WMS server GKÚ SR (ZBGIS)**:
   * Priame pripojenie na štátny mapový server Geodetického a kartografického ústavu SR.
   * Možnosť voľby: **Letecká ortofotomapa SR**, **Tieňovaný digitálny model reliéfu DMR 5.0** alebo **Základná topografická mapa**.
2. **Mapbox 3D Satelitný terén**:
   * Pre modely so zadanými GPS súradnicami automaticky stiahne 3D povrchový reliéf celého masívu.
3. **3D Kalibrácia polohy jaskyne voči povrchu**:
   * Nástroj **Kalibrácia** v bočnom paneli umožňuje jemný posun jaskyne v osiach $X, Y, Z$ s krokom $0.5\ \text{m}$ pre dokonalé zosúladenie vchodu s reálnym terénom.
   * Umožňuje export a opätovné načítanie kalibračného súboru.

---

## 9. Zdieľanie modelov a vkladanie cez Iframe (Embed)

Každé nastavenie scény (farby, natočenie kamery, zapnuté vrstvy, výška rezu, Splay SDF parametre) sa v reálnom čase kóduje do URL adresy.

### Vloženie modelu do webstránky (Iframe Embed):
Kliknite na tlačidlo **🔗 Zdieľať** v hornej lište a skopírujte pripravený HTML kód:
```html
<iframe 
  src="https://loch.sss.sk/?model=https://...&embed=true&theme=precision&sdf=1" 
  width="100%" 
  height="600" 
  style="border:0; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.4);" 
  allowfullscreen 
  loading="lazy" 
  title="LochViewer 3D">
</iframe>
```

---

## 10. Prehľad klávesových skratiek a gest

| Kláves / Gesto | Akcia |
| :--- | :--- |
| **`1`** | Pôdorys (Pohľad zhora, Plan View) |
| **`2`** | Pozdĺžny profil (Čelný pohľad, Profile View) |
| **`3`** | Priečny profil (Bočný pohľad, Cross Section) |
| **`4`** | 3D Izometrický pohľad (Axonometry) |
| **`O`** | Prepínač Perspektíva $\leftrightarrow$ Ortogonálna projekcia |
| **`F`** | Prispôsobiť zobrazenie na stred (Fit to screen) |
| **`C`** | Zapnúť / Vypnúť polygonálny ťah (Centerline) |
| **`W`** | Zapnúť / Vypnúť steny jaskyne (Walls) |
| **`T`** | Zapnúť / Vypnúť povrchový terén (Terrain) |
| **`S`** | Zapnúť / Vypnúť laserové lúče (Splays) |
| **`M`** | Cyklovať režimy merania (Off $\to$ Vzdialenosť $\to$ Plocha) |
| **`Z`** | Otvoriť / Zavrieť horizontálny rez (Z-Clip) |
| **`Ctrl + Z`** | Krok späť v histórii pohybu kamery (Undo flight) |
| **Dvojklik** | Rýchly hladký prelet kamery na kliknutý bod |
| **Klik na ružicu** | Vyrovnať rotáciu kamery na Sever ($0^\circ$) |

---
*Vytvorené pre Slovenskú speleologickú spoločnosť (SSS) a jaskyniarsku komunitu.*
