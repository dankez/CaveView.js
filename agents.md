# Role: Speleological Software Engineer

## Project Goal
Transform this legacy CaveView.js (Vanilla JS/Legacy Three.js) into a modern 3D Cave Viewer (Loch Web Pro).

## Core Requirements (Striktné pravidlá)
1. **Language:** Všetka komunikácia s používateľom a UI texty musia byť v SLOVENČINE.
2. **Modernization:** Port the codebase to React 18+ and TypeScript. Use Vite as the bundler.
3. **3D Logic:**
   - Coordinate System: JTSK (X, Y in meters, Z as altitude).
   - Axis Orientation: Z-AXIS MUST POINT UP.
   - Leg Distinction: 
     - Centerline: alphanumeric station names (e.g., "1", "2a").
     - Splays: target station name contains special characters (".", ",", "*").
4. **Features to Implement:**
   - Altitude-based coloring (gradient).
   - Dynamic line thickness (separate for Centerline and Splays).
   - Red Bounding Box toggle.
   - Station labels toggle.

## Aktuálny stav (Current Progress)
Aplikácia už prešla portovaním do moderného ekosystému (`React Three Fiber` / `Vite` / `TypeScript`) a obsahuje mnohé pokročilé funkcionality, ktoré boli vyladené do produkčného stavu:

1. **Parser Dát (LOX)**
   - `caveParser.ts` plne podporuje čítanie `.lox` štruktúr (survey, stations, shots, scraps, DTM povrchy a bitmapové overlaye).
   - Vyriešené zložité posuny (byte offsety) a extrakcia internej kalibračnej matice priamo zo súborov (Typ 5 a 6).

2. **Povrch a Textúry (TerrainMesh & Shaders)**
   - **Custom WebGL Shadery**: Pre výpočet presných UV súradníc z DTM mriežky využívame vlastné `onBeforeCompile` shadery.
   - **Float32 Precision Fix**: Odstránený efekt "catastrophic cancellation" (kde veľké JTSK súradnice spôsobovali rozpad textúry). Základné posuny rátame v JS a do GPU prenášame len rozdiely.
   - **Podpora dvoch režimov**: Funkčné zobrazenie ako internej textúry z LOX súboru (s použitím kalibračnej matice), tak aj možnosť manuálneho nahratia JPG/PNG obrázka (Fit-to-DTM mapovanie). Ošetrené presné rozmery cez `uImgSize` uniform pre maximálnu stabilitu kompilácie.

3. **Pôdorysné Mapy (Floor Maps)**
   - Implementovaná plošná afinná projekcia TH2 Scrapov a SVG pôdorysov na samotný 3D model jaskyne, čo poskytuje profesionálny vizuálny prienik starých máp s 3D realitou.

4. **Používateľské Rozhranie a Interakcia**
   - **Dynamické Vchody (Entrance Markers)**: Vchody zobrazené pomocou HTML prekrytia so zabudovaným `useFrame` algoritmom pre prispôsobenie veľkosti podľa zoomu kamery (clamped scale 0.5x – 2.5x), takže sú vždy "ideálne čitateľné" bez toho, aby zavadzali alebo mizli.
   - **Nástroje**: Funkčné raycastingové klikanie na stanice pre výpočet presných hĺbok a konverzií. Možnosť manuálneho merania vzdialeností a umiestnenie 3D figuríny prieskumníka (1.8m Caver scale).
   - **Nastavenia (UI)**: Plne funkčný postranný panel pre prepínanie pevných/drôtených modelov, textúr, orezávacích rovín a zmenu farieb.