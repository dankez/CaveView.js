# Security Audit / Bezpečnostný audit

Independent security assessment of LochViewer (v1.1.7) with current hardening notes.
Nezávislé bezpečnostné posúdenie aplikácie LochViewer (v1.1.7) s aktuálnymi poznámkami k spevneniu.

Last hardening update / Posledná stabilizačná aktualizácia: 2026-06-02.

---

## 🇸🇰 Slovenská verzia

### 1. Ochrana citlivých údajov
- Konfigurácia pre Google a Mapbox je čítaná z `.env` súboru, ktorý je ignorovaný Gitom (`.gitignore`).
- Hodnoty s prefixom `VITE_` sú verejné v klientskom browser bundle. Nepovažujú sa za serverové tajomstvá a musia byť chránené obmedzeniami u poskytovateľa, napríklad povolenými referrermi, scope a kvótami.
- Prístupové tokeny pre Google Drive žijú iba v pamäti počas trvania uploadu.

### 2. Bezpečnosť závislostí
- `npm audit` hlási **0 zraniteľností**. Všetky rizikové knižnice (pdfjs, tar, postcss) boli aktualizované na bezpečné verzie.

### 3. Klientska bezpečnosť
- Žiadne použitie `eval()` alebo `dangerouslySetInnerHTML`.
- Generovaný iframe embed kód escapuje HTML atribúty a orezáva rozmery, aby názov súboru alebo custom URL nemohli vložiť nežiaduce atribúty.
- Spracovanie binárnych súborov prebieha vo Web Workeri, čo chráni hlavné vlákno pred pádmi.

---

## 🇺🇸 English Version

### 1. Secrets Protection
- Google and Mapbox configuration is read from a `.env` file, which is ignored by Git (`.gitignore`).
- `VITE_` values are public in the browser bundle. They are not server-side secrets and must be protected with provider-side restrictions such as allowed referrers, scopes, and quotas.
- Google Drive access tokens reside only in memory during the upload process.

### 2. Dependency Security
- `npm audit` reports **0 vulnerabilities**. All critical libraries (pdfjs, tar, postcss) have been updated to secure versions.

### 3. Client-side Security
- No usage of `eval()` or `dangerouslySetInnerHTML`.
- Generated iframe embed code escapes HTML attributes and clamps dimensions so a file name or custom URL cannot inject unwanted attributes.
- Binary file parsing is performed in a Web Worker, protecting the main thread from potential crashes.
