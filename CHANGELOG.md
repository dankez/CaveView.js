# Changelog

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
