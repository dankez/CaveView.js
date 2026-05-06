# LochViewer - Modernized Speleological Viewer

[🇸🇰 Slovenská verzia nižšie / Slovak version below](#slovenská-verzia)

A modern web application for 3D visualization and analysis of cave systems, built with React, Three.js, and React-Three-Fiber.

## 🔒 Security & Audit
LochViewer prioritizes user security and data protection. An independent security audit (May 2026) confirmed:
- **Zero known vulnerabilities** in npm dependencies (`npm audit` clean).
- **Secure OAuth2 implementation** for Google Drive uploads (tokens are kept in-memory, never stored locally).
- **Safe file parsing** isolated in Web Workers to prevent main-thread DoS.
- **Secrets Management**: All API keys are securely managed via `.env` variables and `.gitignore`.
- Detailed audit report: [INDEPENDENT_SECURITY_AUDIT.md](INDEPENDENT_SECURITY_AUDIT.md)

## 🚀 Latest Features

### ☁️ Cloud Sharing (Google Drive) & Security
- **Direct Upload**: Users can seamlessly upload models directly to their own Google Drive from the application.
- **Auto-Permissions**: The app automatically sets the file to public and generates a CORS-friendly URL for iframe embedding.
- **Privacy-First**: Files are hosted on the user's account, giving them full control over their data without consuming the developer's server storage.
- **Protected Credentials**: Secure environment variable setup for Google Cloud API keys.

### 👤 Improved Caver Avatar (Scale)
- **Custom Lighting**: The caver character features an integrated `pointLight` and a glowing headlamp, making it clearly visible even in the darkest parts of the cave.
- **Clipping Support**: The caver is fully integrated into the clipping plane system.
- **Dynamic Calibration**: The caver moves synchronously with the cave during X, Y, Z calibration.

### 📐 Position Calibration
- **Interactive Model Shift**: Manually shift the cave model (traverse, stations, walls) relative to a fixed surface in X, Y, and Z axes.
- **Fine-tuning (0.5m)**: Calibration works in 0.5-meter steps for maximum precision when fitting the cave under the terrain.

### 🗺️ Advanced Texture & Terrain Visualization
- **High-Contrast Contours**: Support for two independent contour colors. Major contours feature legible elevation labels that scale dynamically.
- **Therion Calibration Support**: Support for external `.txt` calibration files in Therion format.
- **Smart Visibility**: Terrain remains visible (shaded model) while loading large textures.

### ☁️ LiDAR & Point Cloud Support (.ply)
- **High-Performance Parser**: Native binary PLY parser supporting millions of vertices with RGB color data.
- **Surface Reconstruction**: Convert raw point clouds into high-fidelity 3D shells.
  - **Organic (Silk)**: New "Silk/Fabric" membrane effect using high-tension Laplacian smoothing.
  - **Triangle Mesh (Accurate)**: Precision reconstruction using Taubin non-shrinking algorithm.
  - **Surface Nets**: Professional dual-contouring topology for seamless cave meshes.
  - **Bulge / Dilation Control**: Interactive slider to adjust model volume (dilation/erosion) for a better fit or visual clarity.
- **Pure Wireframe Mode**: Interactive triangular net visualization that hides raw points for a clean, structural view.
- **Analytical Coloring**: Support for elevation gradients (Color by height) on both solid surfaces and wireframes.
- **Customization**: Dedicated color picker for cave walls and LiDAR meshes in the sidebar.
- **Smart Ceiling Fix**: Optimized PLY processing that prevents automatic classification from cutting off cave ceilings, ensuring full vertical fidelity.

### 📏 Measurement Mode & Interaction Control
- **Strict Gating**: New toggle to switch between "Navigation" and "Measurement" modes.
- **Safety First**: In Navigation mode, the 3D model ignores LiDAR points and meshes, making it impossible to accidentally click on dense clouds.
- **Polygon Priority**: Only survey stations (LOX/PLT) are interactive when measurement is off, ensuring fast and precise cave traverse analysis.
- **Full Analysis**: Activating Measurement Mode restores full interaction with all layers (LiDAR, Terrain, Organic Shell).

### ✂️ Advanced Spatial Analysis (Clipping & Profiles)
- **Highlighted Intersection Edges**: Real-time rendering of intersection lines between clipping planes and 3D models (cave walls, terrain, organic LiDAR).
- **Custom Analysis Colors**: Independent color pickers for cave and terrain clipping highlights to improve visual distinction in complex cross-sections.
- **Vertical Cross-Sections**: Define precise vertical profiles by selecting two points on any model (legacy survey or LiDAR).

### 🎡 Adaptive Rotation Gizmo
- **Smart Orientation**: A professional visual aid for 3D rotation that appears dynamically during interaction.
- **Model-Relative Scaling**: The gizmo automatically adjusts its size and line thickness to match the dimensions of the specific cave model, ensuring perfect visibility across all scales.
- **Minimalist Aesthetic**: Ultra-thin rings and axis indicators provide a premium look without cluttering the viewport.
- **Interactive Feedback**: Tied to the movement state, it serves as a subtle guide during navigation and disappears when the model is stable.

### 🔗 Embedding & Sharing
- **Google Maps Style Embed**: Embed 3D models into any webpage using `<iframe>`.
- **URL State Persistence**: All sidebar settings (themes, colors, clipping planes, terrain) are automatically saved to the URL.

## 🛠 Installation and Running

1. **Clone the repository**:
    ```bash
    git clone https://github.com/dankez/CaveView.js.git
    cd CaveView-modernized
    ```
2. **Install dependencies**: `npm install`
3. **Environment Setup**: Copy `.env.example` to `.env` and fill in your Google Cloud credentials.
4. **Development mode**: `npm run dev`
5. **Production Build**: `npm run build`

## 📂 Supported Formats
* `.lox` (Therion / Loch data - including textures and DTM)
* `.3d` (Survex data)
* `.plt` (Compass data)
* `.ply` (Binary LiDAR Point Clouds)

---
<a name="slovenská-verzia"></a>
# LochViewer - Modernizovaný Speleologický Prehliadač

Moderná webová aplikácia pre 3D vizualizáciu a analýzu jaskynných systémov, postavená na technológiách React, Three.js a React-Three-Fiber.

## 🔒 Bezpečnosť a Audit
LochViewer kladie veľký dôraz na bezpečnosť používateľov a ochranu dát. Nezávislý bezpečnostný audit (Máj 2026) potvrdil:
- **Nulový počet známych zraniteľností** v npm závislostiach (čistý `npm audit`).
- **Bezpečná implementácia OAuth2** pre nahrávanie na Google Drive (tokeny zostávajú len v pamäti, nikdy sa neukladajú na disk).
- **Bezpečné spracovanie súborov** izolované vo Web Workeroch, čo chráni hlavné vlákno pred DoS útokmi.
- **Správa tajných kľúčov**: Všetky API kľúče sú bezpečne spravované cez `.env` premenné a chránené pred únikom pomocou `.gitignore`.
- Podrobná správa z auditu: [INDEPENDENT_SECURITY_AUDIT.md](INDEPENDENT_SECURITY_AUDIT.md)

## 🚀 Najnovšie funkcie

### ☁️ Zdieľanie cez Cloud (Google Drive) a Bezpečnosť
- **Priamy Upload**: Používatelia môžu plynule nahrať modely na svoj vlastný Google Disk priamo z aplikácie.
- **Automatické práva**: Aplikácia automaticky nastaví súbor ako verejný a vygeneruje URL adresu kompatibilnú s CORS pre vkladanie do iframov.
- **Dôraz na súkromie**: Súbory sú hostované na účte používateľa, čo mu dáva plnú kontrolu nad dátami bez toho, aby zaberali úložisko vývojára.
- **Ochrana prístupov**: API kľúče a OAuth identifikátory sú bezpečne chránené pomocou environmentálnych premenných.

### 👤 Vylepšený jaskyniar (Scale)
- **Vlastné osvetlenie**: Postava jaskyniara má teraz integrovaný `pointLight` a svietiacu čelovku. Je jasne viditeľná aj v najtmavších častiach jaskyne.
- **Podpora pre rezy (Clipping)**: Jaskyniar je plne integrovaný do systému orezávania. Pri použití rezov (profilov) sa postava správne oreže spolu s okolím.
- **Dynamická kalibrácia**: Jaskyniar sa pohybuje synchrónne s jaskyňou pri nastavovaní X, Y, Z kalibrácie.

### 📐 Kalibrácia polohy jaskyne
- **Interaktívny posun modelu**: Možnosť manuálne posúvať jaskynný model (polygonový ťah, stanice, steny) voči fixnému povrchu v osiach X, Y a Z.
- **Jemné doladenie (0.5m)**: Kalibrácia prebieha v krokoch po 0.5 metra pre maximálnu presnosť pri pasovaní jaskyne pod terén.

### 🗺️ Pokročilá vizualizácia textúr a terénu
- **Vrstevnice s vysokým kontrastom**: Podpora pre dve nezávislé farby vrstevníc. Hlavné vrstevnice obsahujú čitateľné dynamické kóty nadmorskej výšky.
- **Therion Calibration Support**: Podpora pre externé kalibračné súbory `.txt` vo formáte Therion.
- **Smart Visibility**: Terén zostáva viditeľný (shaded model) aj počas načítavania veľkých textúr.

### ☁️ Podpora LiDAR a mračien bodov (.ply)
- **Vysokovýkonný parser**: Natívny binárny PLY parser s podporou miliónov bodov vrátane RGB farieb.
- **Rekonštrukcia povrchu**: Premeňte surové mračno bodov na 3D model jediným kliknutím.
  - **Organický (Silk)**: Nový efekt „napnutej látky“ (hodvábu) pomocou Laplacian vyhladzovania.
  - **Trojuholník / Mesh**: Presná rekonštrukcia (Taubin algorithm) pre technickú analýzu.
  - **Surface Nets**: Profesionálna dual-contouring topológia pre plynulé modely.
  - **Vypuklosť (Bulge/Dilation)**: Interaktívny posuvník pre dodatočnú dilatáciu modelu, umožňujúci "nafúknutie" alebo zúženie rekonštruovanej jaskyne.
- **Čistý drôtený model**: Interaktívna trojuholníková sieť, ktorá skryje surové body pre lepšiu prehľadnosť geometrie.
- **Analytické vyfarbenie**: Podpora výškových gradientov (Farebné podľa výšky) pre plné modely aj drôtenú sieť.
- **Personalizácia**: Vlastný výber farieb pre LiDAR modely pomocou Color Pickera v sidebare.
- **Fixácia orezania stropov**: Optimalizovaný PLY processing, ktorý eliminuje chybu horizontálneho odrezávania horných častí jaskyne pri generovaní modelov.

### 📏 Režim merania a kontrola interakcie
- **Striktné bránenie (Gating)**: Nový prepínač medzi režimom navigácie a merania.
- **Zameranie na polygon**: Ak nie je meranie aktívne, 3D model ignoruje LiDAR a terén. To zabraňuje náhodnému klikaniu na milióny bodov pri prezeraní jaskynného ťahu.
- **Priorita jaskyne**: V základnom stave sú interaktívne IBA body polygonového ťahu (LOX/PLT), čo zaručuje bleskovú analýzu merania bez rušenia mračnom bodov.
- **Plná analýza**: Zapnutím merania sa aktivuje raycasting pre všetky vrstvy (LiDAR, terén, organický model).

### ✂️ Pokročilá priestorová analýza (Rezy a profily)
- **Zvýraznené hrany rezu**: Renderovanie priesečníkov medzi orezávacími rovinami a 3D modelmi (steny jaskyne, terén, organický LiDAR) v reálnom čase.
- **Vlastné farby analýzy**: Nezávislé výbery farieb pre zvýraznenie rezov jaskyne a terénu pre lepšiu prehľadnosť v zložitých profiloch.
- **Vertikálne rezy**: Definujte presné vertikálne profily výberom dvoch bodov na ľubovoľnom modeli (klasické meranie alebo LiDAR).

### 🎡 Adaptívny Rotačný Gizmo
- **Inteligentná orientácia**: Profesionálna vizuálna pomôcka pre 3D rotáciu, ktorá sa dynamicky zobrazuje počas interakcie s modelom.
- **Relatívna mierka**: Gizmo automaticky prispôsobuje svoju veľkosť a hrúbku čiar rozmerom konkrétnej jaskyne, čo zaručuje perfektnú viditeľnosť pri malých dómoch aj veľkých systémoch.
- **Minimalistická estetika**: Ultra-tenké prstence a indikátory osí poskytujú prémiový vzhľad bez vizuálneho šumu.
- **Interaktívna odozva**: Nástroj je prepojený so stavom pohybu – slúži ako jemný sprievodca počas navigácie a po zastavení zmizne, aby neprekrýval model.

### 🔗 Zdieľanie a Embedovanie
- **Google Maps Style Embed**: Možnosť vkladať 3D modely do ľubovoľných webových stránok pomocou `<iframe>`.
- **URL State Persistence**: Všetky nastavenia sidebaru sa automaticky ukladajú do URL. Keď niekomu pošlete odkaz, uvidí presne to isté.

## 🛠 Inštalácia a spustenie

1. **Klonovanie repozitára**:
    ```bash
    git clone https://github.com/dankez/CaveView.js.git
    cd CaveView-modernized
    ```
2. **Inštalácia závislostí**: `npm install`
3. **Nastavenie prostredia**: Skopírujte `.env.example` na `.env` a doplňte svoje údaje pre Google Cloud.
4. **Vývojový režim**: `npm run dev`
5. **Produkčný Build**: `npm run build`

## 📂 Podporované formáty
* `.lox` (Therion / Loch data - vrátane textúr a DTM)
* `.3d` (Survex data)
* `.plt` (Compass data)
* `.ply` (Binárne LiDAR mračná bodov)

---
## 📄 Documentation / Dokumentácia
Detailed guides and technical specifications are available in the [docs/](docs/) directory:
- [GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md): Google Cloud & API configuration guide.
- [TECHNICAL_DOCS.md](docs/TECHNICAL_DOCS.md): Project architecture and library overview.
- [ALGORITHMS.md](ALGORITHMS.md): Detailed mathematical formulas and 3D reconstruction logic (Taubin, Silk, Surface Nets).
- [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md): Security posture and audit results.

© 2026 LochViewer Project. Vyvinuté pre profesionálne speleologické prezentácie a výskum.
