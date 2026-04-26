# Technický návod na dekódovanie súborov

Tento dokument popisuje nízkoúrovňovú štruktúru speleologických dátových formátov používaných v projekte CaveView-modernized.

## 1. Therion (.lox)
LOX je binárny formát založený na chunkoch (blokoch). Každý chunk má hlavičku a sadu záznamov.

### Štruktúra hlavičky chunku (16 bajtov)
| Offset | Typ | Popis |
| :--- | :--- | :--- |
| 0 | Uint32 | **Typ chunku** (pozri nižšie) |
| 4 | Uint32 | **Celková veľkosť záznamov** (totalRecSize) |
| 8 | Uint32 | **Počet záznamov** (recCount) |
| 12 | Uint32 | **Veľkosť mimoriadnych dát** (dataSize) |

Po hlavičke nasledujú záznamy fixnej dĺžky. Ak má chunk `dataSize > 0`, tieto dáta sa nachádzajú hneď za blokom fixných záznamov.

### Typy chunkov
- **Typ 1 (Survey)**: Metaúdaje o prieskumoch.
- **Typ 2 (Station)**: Súradnice staníc (52 bajtov/záznam). Obsahuje ID, SurveyID, Pointery na meno/komentár a súradnice X, Y, Z (Float64).
- **Typ 3 (Shot)**: Merania medzi stanicami (92 bajtov/záznam). Obsahuje FromID, ToID, LRUD dáta a príznaky (splay, surface, atď.).
- **Typ 4 (Scrap)**: 3D steny jaskyne. Obsahuje pointery na zoznam vrcholov (Vertices) a zoznam trojuholníkov (Faces).
- **Typ 5 (Surface)**: Digitálny model terénu (DTM). Obsahuje šírku, výšku, kalibračnú maticu a pointer na Float64 pole výšok.
- **Typ 6 (Surface BMP)**: Textúra terénu (JPG/PNG) s kalibráciou.

### Dátové pointery (DataPtr - 8 bajtov)
Používajú sa na odkazovanie do oblasti mimoriadnych dát (`dataSize`):
- **Position (Uint32)**: Offset od začiatku dátovej oblasti chunku.
- **Size (Uint32)**: Dĺžka dát v bajtoch.

---

## 2. Survex (.3d)
Binárny formát založený na sekvencii bajtkódových príkazov (príkazy menia stav "kurzora").

### Hlavička
Prvé riadky sú textové:
1. Identifikátor (`Survex 3D Image File`)
2. Verzia (napr. `v8`)
3. Popis/Názov

### Príkazy (Bajty)
- `0x00`: Koniec mena stanice (reset labelu).
- `0x01 - 0x0E`: Odstránenie n znakov z konca aktuálneho labelu.
- `0x0F`: Nasleduje XYZ pozícia (3x Int32, jednotky sú cm).
- `0x40 - 0x7F`: MOVE + LINE. Prvých 6 bitov sú príznaky (0x01 surface, 0x04 splay). Nasleduje XYZ.
- `0x80 - 0xFF`: Označenie stanice (Station Label).

### Správa mien staníc (Label Compression)
Survex šetrí miesto tým, že ukladá len zmeny v mene stanice. Ak sa stanica volá `A.1` a ďalšia `A.2`, príkaz povie "odstráň 1 znak a pridaj '2'".

---

## 3. Compass (.plt)
Jednoduchý textový (ASCII) formát. Každý riadok začína príkazovým písmenom.

### Príkazy
- **M (Move)**: Presun na súradnice bez kreslenia čiary (začiatok nového polygonálneho ťahu).
- **D (Draw)**: Nakreslenie čiary z predchádzajúceho bodu na aktuálne súradnice.

### Štruktúra riadku
`Kód X Y Z [Meno_Stanice]`
- Súradnice sú zvyčajne v stopách (feet), v našom parseri ich násobíme `0.3048` pre prevod na metre.
- **X**: Východná súradnica (Easting).
- **Y**: Severná súradnica (Northing).
- **Z**: Nadmorská výška (Altitude).

---

## 4. Spoločné spracovanie (Post-processing)
Po načítaní akéhokoľvek formátu aplikácia vykonáva:
1. **Centering**: Výpočet geometrického stredu a posun všetkých bodov tak, aby model začínal na `[0,0,0]`. Pôvodný posun sa ukladá do `centerOffset`.
2. **Axis Mapping**: Prevod súradníc pre Three.js:
   - `Three.X = File.X`
   - `Three.Y = File.Z` (Výška je v Three.js os Y)
   - `Three.Z = -File.Y` (Sever/Juh je os Z, otočená)
3. **Bounding Box**: Výpočet min/max hraníc pre správne nastavenie kamery.
