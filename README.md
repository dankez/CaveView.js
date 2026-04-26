# CaveView 3D - Modernized Speleological Viewer
**Release 2026-04-26 (Stable)**

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🚀 Novinky v Release 2026-04-26

### 🏔️ Masívne modely & Výkon
*   **Optimalizácia pre LIDAR**: Plná podpora pre veľké modely (testované na 50MB+ .lox súboroch).
*   **Memory Efficiency**: Prechod na `Float32Array` v parseroch a generátoroch geometrie, čo eliminuje pády prehliadača pri miliónoch vrcholov.
*   **Smart Decimation**: Automatické vypnutie náročných funkcií (ako vyhladzovanie stien) pri extrémne veľkých modeloch pre zachovanie plynulosti 60 FPS.

### 🗺️ Povrch & Textúry
*   **Auto-Texture Loading**: Inteligentná extrakcia a automatické nanášanie textúr priamo z LOX súborov. 
*   **CPU Calibration**: Prepočet UV súradníc prebieha na CPU pomocou afínnych transformácií, čo zaručuje milimetrovú presnosť prekrytia satelitných snímok na terén.
*   **Custom Overlays**: Možnosť manuálneho nahrania vlastných JPG/PNG textúr pre akýkoľvek terénny model.

### ⛏️ Progres & Feedback
*   **Real-time Progress Bar**: Detailné informácie o priebehu načítavania (parsovanie staníc, meraní, generovanie stien, generovanie terénu).
*   **Status Panel**: Vizuálna informácia o stave modelu (DRAFT / STABLE) a detekcia chýb v reálnom čase.

### 🎬 Prezentačný modul (Cinematic Mode)
*   **Auto-rotácia**: Plynulé otáčanie modelu s nastaviteľnou rýchlosťou.
*   **Video Recording**: Priame nahrávanie 3D scény v 60 FPS s podporou kodekov VP9/VP8.
*   **Non-blocking UI**: Nahrávanie prebieha na pozadí bez prerušenia interaktivity.

## 🛠 Inštalácia a spustenie

1.  **Klonovanie repozitára**:
    ```bash
    git clone https://github.com/dankez/CaveView.js.git
    cd CaveView-modernized
    ```
2.  **Inštalácia závislostí**:
    ```bash
    npm install
    ```
3.  **Vývojový režim**:
    ```bash
    npm run dev
    ```
4.  **Produkčný Build**:
    ```bash
    npm run build
    ```

## 📂 Podporované formáty
Aplikácia podporuje kľúčové speleologické formáty:
*   `.lox` (Therion / Loch data - vrátane textúr a DTM)
*   `.3d` (Survex data)
*   `.plt` (Compass data)

---
© 2026 CaveView Modernization Project. Vyvinuté pre profesionálne speleologické prezentácie a výskum.
