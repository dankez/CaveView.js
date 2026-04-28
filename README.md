# LochViewer - Modernized Speleological Viewer
**Release 1.1.2 (2026-04-28-03) - "Legend Fix & Blog Expansion"**

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🚀 Novinky v Release 2026-04-28-03 (v1.1.2)

### 📊 Oprava a vylepšenie legendy
*   **Fix: Dynamická legenda výšok**: Opravená chyba, kedy sa nezobrazovala výšková legenda pri farbení podľa nadmorskej výšky.
*   **Čitateľnosť**: Popisky "Jaskyňa" a "Povrch" v legende dostali výrazný tieň a tučné písmo pre perfektnú čitateľnosť na akomkoľvek pozadí.
*   **Inteligentné podmienky**: Legenda sa teraz automaticky zobrazí pri všetkých relevantných režimoch (walls altitude, traverse altitude, terrain network).

### ✍️ Rozšírenie dokumentácie (Blog)
*   **Mobile First**: Do draftu blogu pribudol odsek o mobilnom rozhraní a dotykovom ovládaní.
*   **Rebranding**: Dokončené premenovanie na LochViewer vo všetkých lokalizačných súboroch a uvítacích správach.

## 🚀 Novinky v Release 2026-04-28-02 (v1.1.1)

### 🏷️ Rebranding na LochViewer
*   **Oficiálne premenovanie**: Projekt bol premenovaný z CaveView na **LochViewer** (skratka **LV**) pre lepšiu identitu v rámci platformy `loch.sss.sk`.
*   **UI Update**: Nové logo a názov v úvodnej obrazovke aj embed móde.

### 📐 Analytické nástroje (Meranie)
*   **Meranie vzdialeností**: Pridaná podpora pre presné meranie medzi bodmi v 3D priestore.
*   **Hrúbka nadložia**: Automatický výpočet vertikálnej vzdialenosti medzi jaskynným bodom a povrchom terénu.
*   **Blog Draft**: Pripravený podrobný článok pre verejnosť s vysvetlením všetkých funkcií.

## 🚀 Novinky v Release 2026-04-28-01 (v1.1.0)

### 🔗 Revolúcia v zdieľaní (Share & Embed)
*   **Google Maps Style Embed**: Možnosť vkladať 3D modely do ľubovoľných webových stránok pomocou `<iframe>`.
*   **URL State Persistence**: Všetky nastavenia sidebaru (témy, farby, rezy, terén, zapnuté vrstvy) sa automaticky ukladajú do URL. Keď niekomu pošlete odkaz, uvidí presne to isté, čo vy.
*   **Headless Embed Mode**: Špeciálne minimalistické zobrazenie bez menu a bočných panelov, ideálne pre blogy a vedecké články.
-   **Smart Share Dialog**: Integrovaný nástroj na generovanie iframe kódu s možnosťou:
    - Nastavenia rozmerov okna (iframe width/height).
    - Povolenia sidebaru pre návštevníkov.
    - Overenia dostupnosti modelu na verejnej URL (CORS check).
*   **Fullscreen via Embed**: Tlačidlo v embed lište pre okamžité otvorenie modelu na celú obrazovku v novom okne.

### 🏔️ Analýza & Rezy (Clipping)
*   **Deep State Sync**: Opravená serializácia rezov (clipping planes). Rezy sa teraz prenášajú aj cez zdieľané odkazy.
*   **Wireframe Color Sync**: Opravená synchronizácia farieb pre Wireframe mesh terénu v zdieľaných odkazoch.

## 🚀 Predchádzajúce novinky (2026-04-26)

### 🏔️ Masívne modely & Výkon
*   **Optimalizácia pre LIDAR**: Plná podpora pre veľké modely (testované na 50MB+ .lox súboroch).
*   **Exclusive Terrain Modes**: Logika prepínania povrchov (Shaded / Network / Texture), ktorá zabraňuje vizuálnym artefaktom.

### 🗺️ Povrch & Textúry
*   **Auto-Texture Loading**: Inteligentná extrakcia textúr priamo z LOX súborov (Typ 6).
*   **CPU Calibration**: Milimetrová presnosť prekrytia textúr vďaka afínnym transformáciám na CPU.

### 🎬 Prezentačný modul
*   **Video Recording**: Priame nahrávanie 3D scény v 60 FPS (VP9/VP8).
*   **Cinematic Auto-rotate**: Plynulé otáčanie s nastaviteľnou rýchlosťou.

## 🛠 Inštalácia a spustenie

1.  **Klonovanie repozitára**:
    ```bash
    git clone https://github.com/dankez/CaveView.js.git
    cd CaveView-modernized
    ```
2.  **Inštalácia závislostí**: `npm install`
3.  **Vývojový režim**: `npm run dev`
4.  **Produkčný Build**: `npm run build`

## 📂 Podporované formáty
*   `.lox` (Therion / Loch data - vrátane textúr a DTM)
*   `.3d` (Survex data)
*   `.plt` (Compass data)

---
© 2026 LochViewer Project. Vyvinuté pre profesionálne speleologické prezentácie a výskum.
