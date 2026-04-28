# CaveView 3D - Modernized Speleological Viewer
**Release 1.1.0 (2026-04-28) - "The Sharing Update"**

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🚀 Novinky v Release 2026-04-28 (v1.1.0)

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
© 2026 CaveView Modernization Project. Vyvinuté pre profesionálne speleologické prezentácie a výskum.
