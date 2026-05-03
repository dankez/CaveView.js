# Changelog

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
