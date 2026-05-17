# NextGen (v2) Shading Logic

Tento dokument popisuje pokročilý algoritmus tieňovania mračien bodov (Point Cloud), ktorý bol implementovaný vo verzii 2.0.0 a je považovaný za referenčný pre dosiahnutie maximálnej vizuálnej kvality a priestorovej predstavivosti.

## 1. Architektúra "Engine v2"
Základom je prechod od klasického `PointsMaterial` k vlastnému `ShaderMaterial`, ktorý umožňuje priamu manipuláciu s každým jedným bodom na úrovni GPU.

## 2. Vertex Shader (Geometria a Atribúty)
Vertex shader pripravuje dáta pre fragment shader a rieši kľúčové vylepšenia:
- **Point Size Attenuation:** Veľkosť bodov sa dynamicky mení podľa vzdialenosti od kamery (`gl_PointSize = pointSize * (300.0 / -mvPosition.z)`). To zabezpečuje, že blízke body nepôsobia ako obrovské fľaky a vzdialené body nevytvárajú diery.
- **Normal Matrix:** Normály z LiDAR-u sa transformujú do "view space", čo je nevyhnutné pre interaktívne nasvietenie.
- **World Altitude:** Výška bodu (v našom prípade os Y) sa odovzdáva pre farebné schémy podľa výškového členenia.

## 3. Fragment Shader (Tieňovanie a Plasticita)
Toto je srdce "geniálneho" vizuálu. Algoritmus kombinuje tri nezávislé zložky:

### A. Headlight Effect (Nasvietenie)
Simulujeme svetlo prichádzajúce priamo z pohľadu kamery (ako jaskyniarska čelovka).
```glsl
vec3 lightDir = normalize(vec3(0.2, 0.2, 1.0));
float dotNL = dot(vNormal, lightDir);
float diffuse = (length(vNormal) > 0.01) ? max(dotNL, 0.0) : 0.6;
```
- Ak normály chýbajú, prepne sa na stabilný základ (0.6).

### B. Intensity Mapping
LiDARové skenery vracajú silu odrazu (intenzitu). My ju využívame na zvýraznenie textúry skaly.
```glsl
float brightIntensity = 0.5 + vIntensity * 0.5;
```

### C. Plasticita (Finálny vzorec)
Kombináciou ambientného svetla, difúzneho odrazu a intenzity vzniká plastický povrch.
```glsl
float light = (ambient + (diffuse * 0.5 * plasticity)) * brightness;
vec3 finalColor = baseColor * light * brightIntensity;
```

### D. Gamma Korekcia
Zabezpečuje, že prechody medzi svetlom a tieňom sú plynulé a detaily v tmavých kútoch sú čitateľné.
```glsl
finalColor = pow(finalColor, vec3(0.85));
```

## 4. Post-processing: Eye-Dome Lighting (EDL)
EDL je finálny filter, ktorý robí mračno bodov zrozumiteľným. Funguje tak, že analyzuje hĺbkovú mapu a pridáva jemné tmavé kontúry tam, kde je prudká zmena hĺbky (napr. hrany chodieb, výčnelky). Bez EDL by mračno bodov pôsobilo ako "farebná hmla", s EDL vyzerá ako pevný kamenný povrch.

## 5. Odporúčané hodnoty (LiDAR Defaults)
- **Husté modely (Erna):** Size 0.3, Brightness 1.2, Plasticity 1.0
- **Redšie modely:** Size 0.5, Brightness 1.2, Plasticity 1.0
