# NextGen (v2) Shading Logic

Tento dokument popisuje pokročilý algoritmus tieňovania mračien bodov (Point Cloud), ktorý bol implementovaný vo verzii 2.0.0 a ďalej vylepšený vo verzii 2.0.1.

## 1. Architektúra "Engine v2"
Základom je prechod od klasického `PointsMaterial` k vlastnému `ShaderMaterial`, ktorý umožňuje priamu manipuláciu s každým jedným bodom na úrovni GPU.

## 2. Vertex Shader (Geometria a Atribúty)
Vertex shader pripravuje dáta pre fragment shader a rieši kľúčové vylepšenia:
- **Point Size Attenuation:** Veľkosť bodov sa dynamicky mení podľa vzdialenosti od kamery (`gl_PointSize = pointSize * (300.0 / -mvPosition.z)`). To zabezpečuje, že blízke body nepôsobia ako obrovské fľaky a vzdialené body nevytvárajú diery. Rozsah nastavenia v UI je 0.00 až 2.00 s krokom 0.05.
- **Normal Matrix:** Normály z LiDAR-u sa transformujú do "view space", čo je nevyhnutné pre interaktívne nasvietenie.
- **World Altitude:** Výška bodu (v našom prípade os Y) sa odovzdáva pre farebné schémy podľa výškového členenia.

## 3. Fragment Shader (Tieňovanie a Plasticita)
Toto je srdce vizuálu. Algoritmus kombinuje tri nezávislé zložky:

### A. Base Color (Výber farby)
Podporujeme tri režimy:
1.  **PLY (Original):** Použije vertex farby zo súboru.
2.  **Výška (Elevation):** Dynamický farebný gradient Blue -> Red podľa nadmorskej výšky.
3.  **Vlastná (Custom):** Používateľom definovaná farba cez Color Picker.

### B. Headlight Effect (Nasvietenie)
Simulujeme svetlo prichádzajúce priamo z pohľadu kamery (ako jaskyniarska čelovka).
```glsl
vec3 lightDir = normalize(vec3(0.2, 0.2, 1.0));
float dotNL = dot(vNormal, lightDir);
float diffuse = (length(vNormal) > 0.01) ? max(dotNL, 0.0) : 0.6;
```

### C. Intensity Mapping
LiDARové skenery vracajú silu odrazu (intenzitu). Využívame ju na zvýraznenie textúry skaly podľa vzorca:
`float baseIntensityEffect = 0.4 + vIntensity * 0.6;`

### D. Plasticita a Finálne Tieňovanie
Kombináciou ambientného svetla, difúzneho odrazu (ovplyvneného plasticitou) a intenzity vzniká plastický povrch.
```glsl
float brightIntensity = mix(1.0, baseIntensityEffect, plasticity);
float light = (0.4 + (diffuse * 0.6 * plasticity)) * brightness;
vec3 finalColor = baseColor * light * brightIntensity;
```

### E. Gamma Korekcia
Zabezpečuje, že prechody sú plynulé: `finalColor = pow(finalColor, vec3(0.8));`

## 4. Analytické nástroje (Clipping Highlight)
Pri aktívnom orezávaní (Clipping) shader vypočítava vzdialenosť k orezávacej rovine. Body v blízkosti hrany (do 15 cm) sú zvýraznené používateľom zvolenou farbou ("Hrana rezu jaskyne"):
```glsl
if (hasClip && minClipDist < 0.15) {
    float highlightStrength = 1.0 - (minClipDist / 0.15);
    finalColor = mix(finalColor, highlightColor, highlightStrength * 0.9);
}
```

## 5. Post-processing: Eye-Dome Lighting (EDL)
EDL filter analyzuje hĺbkovú mapu a pridáva jemné tmavé kontúry tam, kde je prudká zmena hĺbky. Bez EDL by mračno bodov pôsobilo ako "farebná hmla", s EDL vyzerá ako pevný kamenný povrch.
