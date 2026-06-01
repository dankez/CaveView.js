# Changelog

## [2.1.0] - 2026-06-01
### Parting Line Segmentácia & Stabilizácia
- **Mold Parting Line (Nový algoritmus):** Úplne nová logika segmentácie podlahy a stropu. Namiesto hľadania medzier používa geometrický stred (midpoint) vertikálnych stĺpcov. Tým sa eliminujú neprirodzene vysoké steny v úzkych vysokých meandroch.
- **Deliaca čiara [-1.0, 1.0]:** Body sú teraz mapované lineárne od dna (-1) po strop (+1). UI posuvník "Výška rezu" teraz funguje ako dynamický posun tejto deliacej roviny.
- **Typová čistka (TS Strict):** Zjednotená definícia `Vec3` naprieč celým projektom. Odstránené kritické `any` a `as any` z NextGen enginu. Zavedené rozhranie `LiDARWorkerMessage` pre typovo bezpečnú komunikáciu s Workerom.
- **Optimalizácia prenosu dát:** Implementované **Transferable Objects** pri komunikácii s Workerom, čo zrýchľuje načítavanie masívnych modelov bez lagovania UI.
- **Čistá konzola:** Odstránené varovania o duplicite Three.js a chyby CORS/429 pri geolokácii (nahradené natívnou detekciou prehliadača).
- **Unit Testy:** Pridané matematické overenie segmentácie v `src/v2/parsers/__tests__/segmentation.test.ts`.

## [2.0.2] - 2026-05-17
### UI Reorganizácia & Stabilizácia
- **Master Switch UI:** NextGen engine (v2) je teraz integrovaný priamo v sekcii "Steny jaskyne" ako hlavný prepínač. Tým sa zjednotilo ovládanie a vyčistila horná lišta.
- **Kontextové Sidebar Menu:** Sidebar dynamicky zobrazuje len relevantné nastavenia podľa zvoleného motora (LiDAR vs Mesh).
- **Nezávislé vrstvy:** Drôtený model (Wireframe) a vrstevnice na povrchu teraz fungujú nezávisle od ostatných vizuálnych režimov.
- **Vylepšený Organic mód:** Zvýšená agresivita vyhladzovania (Taubin smoothing) pre "blanket look" efekt bez ostrých hrotov.
- **Oprava navigácie:** Fixnutá logika `isMoving`, ktorá predtým blokovala vykresľovanie rúrok (Tubes) po zastavení pohybu.
- **Calibration Fix (v2):** Opravený prepočet súradníc pre meranie staníc v NextGen engine pri aktívnej kalibrácii.

## [2.0.1] - 2026-05-17
### Custom Farby & Analytické Rezy
- **Vlastná farba (Color Picker):** Implementovaná možnosť manuálneho výberu farby mračna bodov v NextGen engine so zachovaním plného tieňovania.
- **Ladenie plasticity:** Pridaný posuvník pre dynamickú kontrolu hĺbky tieňov a sýtosti detailov mračna.
- **Zvýraznenie rezov:** Dynamické farebné zvýraznenie (Clipping Highlight) hrán rezov pre lepšiu orientáciu v rezoch.
- **Synchronizácia s v1:** Plné prepojenie orezávacej logiky s nastaveniami "Vynechať jaskyňu z rezu" a farbou hrany z UI.
- **Precízna hustota:** Jemnejší krok nastavenia veľkosti bodov (0.05) pre dokonalé vyladenie hustoty.
- **Dokumentácia:** Vytvorený podrobný technický rozbor tieňovacej logiky v `docs/v2_SHADING_LOGIC.md`.

## [release-2026-05-16] - 2026-05-16
### NextGen Engine & LiDAR LOD (v2.0.0)
- **NextGen Engine (v2):** Predstavenie úplne nového vykresľovacieho motora optimalizovaného pre masívne LiDAR dáta a plynulý výkon.
- **Octree LOD & Streaming:** Implementácia hierarchického priestorového indexovania, ktoré umožňuje plynulé prezeranie miliárd bodov bez preťaženia RAM/GPU.
- **Eye-Dome Lighting (EDL):** Pridaný pokročilý post-processing shader pre mračná bodov, ktorý dodáva vizuálnu hĺbku a zvýrazňuje detaily stien (vzhľad podobný Potree).
- **Mapbox 3D Terrain:** Integrácia `three-geo` pre automatické načítavanie satelitného 3D terénu nad jaskyňou na základe jej GPS polohy.
- **Street View Navigácia:** Implementovaný plynulý "let" k bodu po dvojkliku s inteligentným odstupom od stien a históriou pohybu (Undo/Ctrl+Z).
- **Architektonický Refaktoring:** Kód rozdelený na `v1` (Standard), `v2` (NextGen) a `shared` moduly. Zjednotené typy a rozhrania pre cross-engine kompatibilitu.
- **Inteligentné Predvoľby:** Automatické nastavenie jasu a veľkosti bodov na základe hustoty nahrávaného modelu.

## [release-2026-05-12-01] - 2026-05-12
### Refaktoring & Optimalizácia (v1.6.0)
- **Koordináty & Moduly:** Presun funkcií `tryUtmToWgs84` a `tryJtskToWgs84` do dedikovaného modulu `src/utils/coords.ts` pre lepšiu znovupoužiteľnosť a čistotu kódu v `App.tsx`.
- **Výkon parsovania:** Optimalizácia parsovania `CaveData` a stabilizácia E2E testov pre veľké modely.
- **Oprava XYZ Scrapingu:** Vyriešený bug v UV mapovaní a stabilizácia sťahovača XYZ dlaždíc pre ortofotomapy.

## [release-2026-05-09-1] - 2026-05-09
### Georeferencovanie & XYZ Scraping (v1.5.0)
- **XYZ Scraping:** Integrácia sťahovania ortofotomáp a DMR5 dát pomocou XYZ dlaždíc pre realistické povrchy.
- **Manuálna GPS kalibrácia:** Pridané rozhranie pre manuálne zadávanie GPS súradníc staníc a sťahovanie nadmorskej výšky zo ZBGIS.
- **Stabilita:** Vyriešené chyby v `CaveViewer3D` týkajúce sa rozsahu premenných `texWidth`/`texHeight`.
- **WMS optimalizácia:** Zrýchlená vizualizácia WMS terénov a úprava hrúbky rotačného gizma.


## [release-2026-05-07-01] - 2026-05-07
### Branding & Signature (v1.4.3)
- **Rebranding:** Premenovanie skratky aplikácie v lište z `CV 3D` na `LV 3D` (LochViewer).
- **Podpis autora:** Pridaný text "by DankeZ" na úvodnú obrazovku pod názov aplikácie a do legendy výškového odstupňovania.
- **Oprava UI:** Odstránené duplicitné zobrazenie verzie na úvodnej obrazovke.

## [release-2026-05-06-02] - 2026-05-06
### Podmienená interakcia & LiDAR Bulge (v1.4.1)
- **Režim merania (Measurement Mode):** Implementovaný striktný gating interakcie. V základnom režime navigácie sú interaktívne IBA polygonové body (LOX/PLT), čím sa eliminuje náhodné klikanie na LiDAR mračná a terén.
- **Vypuklosť / Dilation (Bulge):** Pridaný nový ovládací prvok pre organické modely, umožňujúci interaktívne nafúknutie alebo zúženie rekonštruovaného povrchu (offset vrcholov v smere normál).
- **Fixácia LiDAR stropov:** Opravená kritická chyba v `parser.worker.ts`, kde heuristická klasifikácia odrezávala horné steny jaskýň. PLY súbory bez natívnej klasifikácie sú teraz spracovávané v plnom vertikálnom rozsahu.
- **Optimalizácia interakcie:** Gating bol aplikovaný na `PointCloud`, `OrganicShell`, `TerrainMesh` a `ClickableStations` pre maximálnu presnosť pri práci s polygonovým ťahom.

## [release-2026-05-06-01] - 2026-05-06
### LiDAR Progresívny LOD & Optimalizácia (v1.4.0)
- **Progresívne zjemňovanie (Refinement):** Implementovaný systém plynulého dovykresľovania bodov (stride 16 -> 8 -> 4 -> 2 -> 1) po zastavení pohybu pre maximálny detail.
- **Voxelová mriežka (1M bodov):** Zvýšený limit na 1 000 000 bodov pri zachovaní špičkového výkonu vďaka novej `Uint8Array` mriežke (namiesto pomalého BigInt Setu).
- **Rovnomerná decimácia:** Opravené orezávanie modelu pri načítaní; body sú teraz distribuované rovnomerne po celom povrchu jaskyne pomocou nového voxelového kľúča.
- **Vysoko-rýchlostná rekonštrukcia:** Kompletný refaktoring BFS algoritmu a triangulácie, zrýchľujúci generovanie meshu o 500-800%.

## [release-2026-05-05-1] - 2026-05-05
### LiDAR Výkon & Organická Rekonštrukcia (v1.3.3)
- **Google Maps Loading:** Implementované postupné načítavanie mračien bodov (najprv hrubý obrys, potom detaily) pre okamžitú spätnú väzbu pri veľkých PLY súboroch.
- **Dynamický LOD:** Agresívna decimácia bodov (5% hustota) počas rotácie a pohybu kamery pre maximálnu plynulosť na slabšom hardvéri.
- **Jemná Organickosť:** Prekalibrovaná citlivosť posuvníka "Úroveň organickosti" (krok 0.1), umožňujúca precízne vyhladzovanie od nuly bez skokových zmien.
- **Zjednodušenie UI:** Odstránenie experimentálneho panelu LiDAR Analýza pre čistejšie používateľské prostredie.

## [release-2026-05-03-2] - 2026-05-03
### Optimalizácia & Finalizácia
- **UI Consistency:** Zjednotenie verziových štítkov na v1.3.2 naprieč celou aplikáciou.
- **Responsive Depth:** Pridanie vizuálnej hĺbky (centrálny glow) na úvodnú obrazovku pre prémiový vzhľad na ultra-širokých monitoroch.
- **Mobile Navigation:** Vylepšená stabilita bočného menu pri prechode medzi mobilným a desktopovým zobrazením.

## [release-2026-05-03-1] - 2026-05-03
### Opravy & LiDAR Interakcia
- **PLY Interaction:** Opravené meranie a klikanie na mračná bodov (PLY) zvýšením thresholdu raycastingu na 0.5m.
- **Silk Smoothing:** Vylepšený "Silk" efekt rekonštrukcie povrchu (vyšší Laplacian tension 0.6) pre organické modely.
- **UI Refinement:** Responzívnejšia úvodná obrazovka s širokým rozložením a zobrazením verzie v1.3.1.
- **Sidebar:** Zvýraznené hlavičky sekcií v bočnom paneli pre lepšiu navigáciu.
- **Close Button:** "Zavrieť" je teraz vpravo hore, červené a výrazné.

## [1.3.0] - 2026-05-03
### Pridané
- **Silk/Fabric Reconstruction:** Nový algoritmus pre organické modely simulujúci napätie membrány.
- **Angle-Weighted Normals:** Prémiové tieňovanie povrchu eliminujúce viditeľné hrany na hladkých modeloch.
- **Surface Nets:** Stabilná implementácia dual contouringu pre LiDAR dáta.
### Opravené
- **Triangle Mesh:** Návrat k vysokej presnosti pomocou Taubin vyhladzovania (non-shrinking).
- **UI Cleanup:** Odstránené ikony a "NEW" tagy zo sidebaru pre profesionálnejší vzhľad.

## [1.2.0] - 2026-05-01
- Google Drive integrácia a podpora pre externé hostovanie modelov.
