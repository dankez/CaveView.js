# 🔗 LochViewer - Systém zdieľania a vkladania (Embed)

Tento modul umožňuje vkladať 3D modely jaskýň priamo do vašich webstránok alebo blogov pomocou `<iframe>`, podobne ako Mapy Google.

## 🚀 Hlavné funkcie

- **Iframe Embed**: Jednoduchý HTML kód pre vašu stránku.
- **Perzistencia stavu**: Všetky nastavenia (farby, rezy, terén, zapnuté vrstvy) sú zakódované priamo v URL adrese.
- **Embed Mód**: Špeciálne "čisté" zobrazenie bez bočných panelov a menu, optimalizované pre malé okná.
- **Kontrola Sidebaru**: Možnosť povoliť návštevníkom prístup k nastaveniam modelu aj v embed móde.
- **Overenie dostupnosti**: Integrovaný nástroj v dialógu overí, či je model na zadanej adrese skutočne prístupný (CORS/Existence check).

## 🛠️ Parametre URL adresy

Aplikácia podporuje širokú škálu parametrov pre konfiguráciu zobrazenia bez nutnosti manuálneho nastavovania:

| Parameter | Hodnoty | Popis |
| :--- | :--- | :--- |
| `model` | URL / Cesta | Cesta k `.lox` súboru (povinné) |
| `embed` | `true` | Aktivuje minimalistický režim |
| `sidebar` | `1` | Zobrazí ovládací panel aj v embed móde |
| `theme` | `classic`, `precision`, `light` | Výber vizuálnej témy |
| `terrain` | `shaded`, `network`, `texture` | Režim zobrazenia povrchu |
| `clip` | `1` | Aktivuje horizontálny rez (clipping) |
| `cliph` | číslo | Výška rezu v metroch |
| `rot` | `1` | Aktivuje automatické otáčanie |

## 📦 Príklad vloženia do stránky

```html
<iframe 
  src="https://loch.sss.sk/?model=https://domena.sk/model.lox&embed=true&theme=precision&terrain=texture" 
  width="800" 
  height="500" 
  style="border:0; border-radius:12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" 
  allowfullscreen 
  loading="lazy">
</iframe>
```

## ⚠️ Dôležité upozornenie (CORS)

Ak hostujete `.lox` súbory na vlastnom serveri, musíte povoliť **CORS** (Cross-Origin Resource Sharing), aby ich webová aplikácia LochViewer mohla stiahnuť.
V konfigurácii servera (napr. `.htaccess` pre Apache) pridajte:
`Header set Access-Control-Allow-Origin "*"`
