# Websupport Apache Deployment

CaveView uses remote map tiles when texturing LOX terrain surfaces. Local development works through the Vite `server.proxy` rules, but those rules are not included in the static production build. On Websupport hosting, deploy the generated `dist` folder with the included Apache/PHP proxy files.

## Required Files

After `npm run build`, verify that these files exist in `dist`:

```text
dist/.htaccess
dist/map-proxy.php
dist/index.html
dist/assets/
```

Upload the whole `dist` directory contents to the domain document root. Do not skip hidden files, because `.htaccess` is required by Apache.

## How It Works

Development mode keeps using the Vite routes:

```text
/xyz-proxy/...
/wms-proxy/...
```

Production builds use the same-origin PHP proxy:

```text
/map-proxy.php?source=zbgis&path=...
/map-proxy.php?source=freemap-orto&path=...
/map-proxy.php?source=geology&...
```

The proxy is restricted to known map providers and is not an open proxy.

## Quick Hosting Check

Open this on the deployed domain:

```text
https://your-domain.example/map-proxy.php?source=freemap-orto&path=15/18200/11200.jpg
```

Expected result is either a map image or a provider-level tile response. If you get a PHP error, check that PHP is enabled for the domain. If you get a 404 for `map-proxy.php`, the file was not uploaded to the same folder as `index.html`.

## Optional Overrides

The defaults are:

```text
local dev: VITE_MAP_PROXY_MODE=vite
production: VITE_MAP_PROXY_MODE=php
```

You can override the production proxy base when the PHP proxy lives on another domain:

```text
VITE_TILE_PROXY_BASE=https://tiles.example.com
```

Then rebuild before uploading.
