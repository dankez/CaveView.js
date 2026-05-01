# Security Audit / Bezpečnostný audit

Independent security assessment of LochViewer (v1.1.7).
Nezávislé bezpečnostné posúdenie aplikácie LochViewer (v1.1.7).

---

## 🇸🇰 Slovenská verzia

### 1. Ochrana citlivých údajov
- Všetky API kľúče boli presunuté do `.env` súboru, ktorý je ignorovaný Gitom (`.gitignore`).
- Prístupové tokeny pre Google Drive žijú iba v pamäti počas trvania uploadu.

### 2. Bezpečnosť závislostí
- `npm audit` hlási **0 zraniteľností**. Všetky rizikové knižnice (pdfjs, tar, postcss) boli aktualizované na bezpečné verzie.

### 3. Klientska bezpečnosť
- Žiadne použitie `eval()` alebo `dangerouslySetInnerHTML`.
- Spracovanie binárnych súborov prebieha vo Web Workeri, čo chráni hlavné vlákno pred pádmi.

---

## 🇺🇸 English Version

### 1. Secrets Protection
- All API keys have been moved to a `.env` file, which is ignored by Git (`.gitignore`).
- Google Drive access tokens reside only in memory during the upload process.

### 2. Dependency Security
- `npm audit` reports **0 vulnerabilities**. All critical libraries (pdfjs, tar, postcss) have been updated to secure versions.

### 3. Client-side Security
- No usage of `eval()` or `dangerouslySetInnerHTML`.
- Binary file parsing is performed in a Web Worker, protecting the main thread from potential crashes.
