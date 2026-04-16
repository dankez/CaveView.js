# CaveView 3D

**CaveView 3D** je zmodernizovaný webový prehliadač speleologických dáta a modelov jaskýň priamo v prehliadači. Aplikácia je prepísaná do moderného React ecosystému, využívajúca plnú silu hardvérovej akcelerácie cez Three.js a React-Three-Fiber.

![Welcome Screen](public/screenshots/welcome.png)

## 🎯 Hlavné Funkcie a Možnosti

Prehliadač obsahuje interaktívny bočný panel, ktorý poskytuje absolútnu kontrolu nad všetkými grafickými vrstvami scény.

### 1. Podporované Formáty Súborov
- **Therion LOX (`.lox`)** – Natívna podpora vrátane ťahov, stien (scraps), povrchov (terén + textúry), a staníc.
- **Survex 3D (`.3d`)** – Merania, Splay, polygonové ťahy, popisy staníc.
- **Compass PLT (`.plt`)** – Základné línie a polygónové trasy v 3D.
- Aplikácia nepracuje s dátami na serveri, všetko sa spracuváva lokálne (Client-Side) v zlomku sekundy.

### 2. Rendering Jaskynných Štruktúr
- **Základný Polygónový Ťah** (Tubes / Lines) – vykreslenie nosnej štruktúry.
- **Merania / Splay** – možnosť vypnúť/zapnúť pomocné slepé zamerania.
- **Trojuholníkový Mesh a "Scraps"** – vizualizácia plných solid stien vypočítaných z nákresov.
- **Drôtený model (Wireframe)** – štruktúrovaná siet obrysov stien nezávisle nastaviteľná a viditeľná cez plné textúry.
- **Altitude Colormap (Výškové prechody)** – farebné tieňovanie podľa nadmorskej výšky (tzv. "tepelná mapa" výšok) plynulo pre steny aj polygónový ťah.

### 3. Vizualizácia Terénu (DTM) a Overlay Textúr
Rozsiahla správa vonkajšieho terénu so zachovaním ideálneho depth-sorting (jaskynný model zostáva viditeľný popod vrstvou, terén sa navzájom neprekrýva).
- **Solid Tieňovaný model** terénu.
- **Drôtená sieť (Terén)**.
- **Farebný výškový network model**.
- **Ortofotomapa (JPG/PNG textura overlay)** ak je k DTM mriežke priradená mapa.

![Ukážka zobrazenia Viewer](public/screenshots/viewer_main.png)
![Farebné tieňovanie (Altitude)](public/screenshots/altitude.png)

### 4. Detailné informácie o stanici a interakcia (Raycasting)
Aplikácia buduje hit-sférický strom. Ak myškou ťukneš na ktorúkoľvek biele bodovú značku (Stanicu), applikácia extrahuje údaje:
- Pôvodné ID/Meno meračského bodu.
- Nadmorskú výšku (m n.m.).
- Zameriavacie "X / Y" voči mriežke (napríklad S-JTSK).
- **Lokácia GPS (WGS84)**: Autokorekcia a prepočet z UTM metrického lokálneho systému automaticky na GPS Latitude/Longitude s možnosťou prekliku priamo do Google Maps.
- **Hĺbka pod Zemou**: Aplikácia dynamicky bilineárne preráta vertikálnu vzdialenosť vybranej stanice k výškovému rastru (DTM) a odpovie aká je hĺbka pre dany bod.

![Station Detail Card](public/screenshots/detail_card.png)

---

## 🛠️ Architektúra Systému a Použité Technológie
Aplikácia beží na čisto modernom stacku:
1. **React 18** – Komponentový a responzívny prístup.
2. **Three.js** & **@react-three/fiber** – Manažment komplexnej 3D Scény (komponentizácia).
3. **@react-three/drei** – Pomocné wrappery (OrbitControls, Html overlay, Wireframe).
4. **Vite** – Rýchly kompilátor a deveserver.
5. **TypeScript** – prísna typová kultúra a detekcia chýb naprieč parsermi a GUI (žiadne voľné `any`).

## 🚀 Spustenie a Development (Start)

Najprv si nainštaluj prerekvizity (Node.js prostredie).

```bash
# Otvor prislusny priecinok
cd CaveView-modernized

# Nainstaluj balicky / zavislosti
npm install

# Spusti lokalny server
npm run dev
```
Následne otvor prehliadač na [http://localhost:5173/].

## 📦 Produkčný Build
```bash
npm run build
```
Zložkovú štruktúru `dist/` vieš nahrať na hociktorú statickú doménu (GitHub Pages, Netlify alebo hocijaký bežný web server). Nespúšťa žiadne procesy typu Node/PHP za oponou.
