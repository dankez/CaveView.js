# Google Cloud Setup Guide / Návod na nastavenie Google Cloud

This guide explains how to obtain and configure the keys required for Google Drive integration.
Tento návod vysvetľuje, ako získať a nakonfigurovať kľúče potrebné pre integráciu s Google Drive.

## 🔑 Required Variables / Potrebné premenné
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY`

---

## 🇸🇰 Slovenský návod

### 1. Vytvorenie projektu
1. Choď na [Google Cloud Console](https://console.cloud.google.com/).
2. Vytvor nový projekt (napr. `LochViewer`).
3. V menu **APIs & Services > Library** vyhľadaj a povoľ:
   - **Google Drive API**
https://console.cloud.google.com/apis/library/drive.googleapis.com?organizationId=0&project=lochviewer


### 2. OAuth Consent Screen (Súhlas)
1. Choď na **APIs & Services > OAuth consent screen**.
2. Vyber **External** a klikni Create.
3. Vyplň názov aplikácie a kontaktný email.
4. V sekcii **Scopes** pridaj manuálne rozsah:
   - `https://www.googleapis.com/auth/drive.file`
5. V sekcii **Test users** pridaj svoj email, aby si sa mohol prihlásiť počas vývoja.

### 3. Vytvorenie prístupových údajov
#### A. OAuth 2.0 Client ID
1. Choď na **APIs & Services > Credentials**.
2. Klikni na **Create Credentials > OAuth client ID**.
3. Typ: **Web application**.
4. **Authorized JavaScript origins**: Pridaj `http://localhost:5173` a tvoju produkčnú URL (napr. `https://lochviewer.com`).
5. Skopíruj vygenerované Client ID do `.env` ako `VITE_GOOGLE_CLIENT_ID`.

#### B. API Key (pre CORS)
1. Klikni na **Create Credentials > API key**.
2. **Dôležité: Obmedz kľúč!** Klikni na kľúč a v nastaveniach:
   - **API restrictions**: Vyber "Restrict key" a zvoľ **Google Drive API**.
   - **Application restrictions**: Vyber "Websites" a pridaj svoju doménu.
3. Skopíruj kľúč do `.env` ako `VITE_GOOGLE_API_KEY`.

---

## 🇺🇸 English Guide

### 1. Create a Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `LochViewer`).
3. In the **APIs & Services > Library** menu, search for and enable:
   - **Google Drive API**

### 2. OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** and click Create.
3. Fill in the App name and support email.
4. In the **Scopes** section, manually add:
   - `https://www.googleapis.com/auth/drive.file`
5. In the **Test users** section, add your email address to allow yourself to log in during development.

### 3. Creating Credentials
#### A. OAuth 2.0 Client ID
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Type: **Web application**.
4. **Authorized JavaScript origins**: Add `http://localhost:5173` and your production URL (e.g., `https://lochviewer.com`).
5. Copy the generated Client ID to `.env` as `VITE_GOOGLE_CLIENT_ID`.

#### B. API Key (for CORS)
1. Click **Create Credentials > API key**.
2. **Important: Restrict the key!** Click on the key and in settings:
   - **API restrictions**: Select "Restrict key" and choose **Google Drive API**.
   - **Application restrictions**: Select "Websites" and add your domain.

---

## 🚀 Produkčné nasadenie / Production Deployment

### 🇸🇰 Slovenský postup pre produkciu
Keď ste pripravení spustiť aplikáciu na doméne `https://loch.sss.sk/`:

1. **OAuth Consent Screen**:
   - V menu **APIs & Services > OAuth consent screen** kliknite na **Publish App**. Tým sa aplikácia prepne z testovacieho režimu do produkcie.
2. **Authorized JavaScript Origins**:
   - V nastaveniach vášho **OAuth client ID** pridajte do zoznamu: `https://loch.sss.sk`.
3. **API Key Security**:
   - V nastaveniach **API Key** (Application restrictions) zvoľte **Websites** a pridajte: `https://loch.sss.sk/*`.
4. **Environment Variables**:
   - Pri nasadení na váš hosting (napr. cez GitHub Actions, Vercel alebo manuálne) nastavte premenné `VITE_GOOGLE_CLIENT_ID` a `VITE_GOOGLE_API_KEY` v konfiguračnom paneli hostingu.

---

### 🇺🇸 English Production Steps
When you are ready to launch the app at `https://loch.sss.sk/`:

1. **OAuth Consent Screen**:
   - In the **APIs & Services > OAuth consent screen** menu, click **Publish App**. This moves the app from Testing to Production.
2. **Authorized JavaScript Origins**:
   - In your **OAuth client ID** settings, add the following to the list: `https://loch.sss.sk`.
3. **API Key Security**:
   - In your **API Key** settings (under Application restrictions), select **Websites** and add: `https://loch.sss.sk/*`.
4. **Environment Variables**:
   - When deploying to your host (e.g., via GitHub Actions, Vercel, or manually), set the `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` variables in your hosting's configuration panel.
