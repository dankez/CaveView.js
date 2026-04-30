# LochViewer - Modernized Speleological Viewer
**Release 1.1.6 (2026-04-30-04) - "Cave-to-Surface Calibration"**

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🚀 Novinky v Release 2026-04-30-04 (v1.1.6)

### 📐 Kalibrácia polohy jaskyne
*   **Interaktívny posun modelu**: Možnosť manuálne posúvať jaskynný model (polygonový ťah, stanice, steny) voči fixnému povrchu v osiach X, Y a Z.
*   **Jemné doladenie (0.5m)**: Kalibrácia prebieha v krokoch po 0.5 metra pre maximálnu presnosť pri pasovaní jaskyne pod terén.
*   **Plná integrácia**: Všetky analytické nástroje (meranie hĺbky nadložia, súradnice staníc) automaticky započítavajú kalibračný posun.

## 🚀 Novinky v Release 2026-04-30-03 (v1.1.5)

### 🗺️ Pokročilá kalibrácia textúr
*   **Manuálny posun**: Pridaná možnosť jemného doladenia polohy textúry priamo v sidebare (kroky po 0.5m). Ideálne pre rýchlu vizuálnu korekciu JPG/PNG máp.
*   **Therion Calibration Support**: Podpora pre externé kalibračné súbory `.txt` vo formáte Therion (`[x1 y1 lat1 lon1 x2 y2 lat2 lon2]`). Stačí nahrať obrázok a k nemu prislúchajúcu kalibráciu.
*   **Shader Fixes**: Kompletné prepracovanie vykresľovania textúr na GPU. Opravené predtým "neviditeľné" bitmapy v LOX súboroch aj pri manuálnom uploade JPG.
*   **Smart Visibility**: Terén zostáva viditeľný (shaded model) aj počas načítavania veľkých textúr, čo zlepšuje odozvu aplikácie pri pomalom pripojení.

## 🚀 Novinky v Release 2026-04-30-02 (v1.1.4)

### 🏔️ Inteligentné vrstevnice
*   **Popisky nadmorskej výšky**: Hlavné vrstevnice teraz obsahujú čitateľné číselné kóty nadmorskej výšky.
*   **Dynamické škálovanie**: Popisky automaticky menia svoju veľkosť podľa priblíženia kamery, pričom zostávajú čitateľné aj pri veľkom oddialení (min 0.7x).
*   **Garantovaná viditeľnosť**: Algoritmus zabezpečuje, že pre každú viditeľnú hlavnú vrstevnicu sú v zobrazenom poli vždy prítomné minimálne 1-3 popisky.
*   **Sidebar Toggle**: Pridaná možnosť zapnúť/vypnúť zobrazenie kót nezávisle od samotných vrstevníc v bočnom paneli.
*   **Precízne umiestnenie**: Čísla sú umiestňované presne na priesečníky mriežky s izohýpsami pre maximálnu presnosť.

## 🚀 Novinky v Release 2026-04-30-01 (v1.1.3)

### 🏔️ Pokročilá vizualizácia terénu
*   **Vrstevnice s vysokým kontrastom**: Implementovaná podpora pre dve nezávislé farby vrstevníc. Hlavné vrstevnice (napr. každých 10m) môžu mať teraz výraznejšiu farbu pre lepšiu orientáciu v strmom teréne.
*   **Fix: Vizuálna hierarchia (Depth Overlap)**: Vrstevnice sú teraz technicky nadradené tieňovanému modelu aj satelitným textúram. Už nedochádza k ich prekrývaniu alebo "zanikaniu" pri nižšej priehľadnosti modelu.
*   **Lokalizácia**: Kompletný slovenský a anglický preklad pre nové ovládacie prvky vrstevníc.

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
