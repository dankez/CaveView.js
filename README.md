# CaveView 3D - Modernized Speleological Viewer
**Release 2026-04-22-02 (Stable)**

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🚀 Kľúčové funkcie (Release 2.4.0)

### 🎬 Prezentačný modul (Cinematic Mode)
*   **Auto-rotácia**: Plynulé otáčanie modelu s nastaviteľnou rýchlosťou.
*   **Video Recording**: Priame nahrávanie 3D scény v 60 FPS s podporou kodekov VP9/VP8.
*   **Flexible Duration**: Možnosť nastavenia časovaného nahrávania (5-60s) alebo manuálneho režimu s tlačidlom STOP v hornej lište.
*   **Non-blocking UI**: Nahrávanie prebieha na pozadí, čo umožňuje manuálnu prácu s modelom počas zachytávania videa.

### 💎 Vizuálna identita & Rendering
*   **CATIA Gradient**: Dynamické pozadie s modrým gradientom pre profesionálnu inžiniersku estetiku (téma Precision).
*   **Geological Texture Suite**: Tri realistické vápencové textúry optimalizované pre speleológiu:
    *   *Vápenec (Limestone)* - Jasná biela
    *   *Dolomit (Dolomite)* - Svetlosivá
    *   *Sivý vápenec (Grey Limestone)* - Neutrálna sivá
*   **High-Visibility Materials**: Vylepšený jas a odrazivosť pre lepšiu orientáciu v spleti chodieb.

### 📐 Analýza & Meranie
*   **Profilové Rezy**: Pokročilé orezávanie modelu podľa osí alebo vlastných profilov.
*   **Interaktívne Meranie**: Presné meranie vzdialeností medzi bodmi v 3D priestore.
*   **Station Details**: Detailné informácie o meračských bodoch (súradnice, hĺbka, prepojenia).

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

## 📂 Štruktúra dát
Aplikácia podporuje speleologické formáty:
*   `.lox` (Loch data)
*   `.3d` (Survex data)
*   `.plt` (Compass data)

---
© 2026 CaveView Modernization Project. Vyvinuté pre profesionálne speleologické prezentácie a výskum.
