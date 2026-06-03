export type MapProxySource =
  | 'zbgis'
  | 'freemap-orto'
  | 'freemap-shading'
  | 'geology'
  | 'zbgis-wms-orto'
  | 'zbgis-wms-shadow';

export type MapProxyMode = 'vite' | 'php';

export type MapProxyParams = Record<string, string | number | boolean | undefined>;

interface BuildUrlOptions {
  mode?: MapProxyMode;
  proxyBase?: string;
  appBase?: string;
}

function normalizeBase(base: string | undefined): string {
  const value = (base || '').trim();
  if (!value || value === '/') return '';
  return value.replace(/\/+$/, '');
}

function encodeQueryValue(value: string | number | boolean): string {
  return encodeURIComponent(String(value))
    .replace(/%7B/gi, '{')
    .replace(/%7D/gi, '}');
}

function queryString(params: MapProxyParams): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeQueryValue(value as string | number | boolean)}`)
    .join('&');
}

function getConfiguredMode(): MapProxyMode {
  const mode = String(import.meta.env.VITE_MAP_PROXY_MODE || '').toLowerCase();
  if (mode === 'php' || mode === 'vite') return mode;
  return import.meta.env.DEV ? 'vite' : 'php';
}

function getProxyBase(options?: BuildUrlOptions): string {
  const configuredBase = options?.proxyBase ?? import.meta.env.VITE_TILE_PROXY_BASE;
  if (configuredBase) return normalizeBase(configuredBase);
  return normalizeBase(options?.appBase ?? import.meta.env.BASE_URL);
}

export function buildPhpProxyUrl(
  source: MapProxySource,
  upstreamPath: string,
  params: MapProxyParams = {},
  options?: BuildUrlOptions
): string {
  const base = getProxyBase(options);
  const proxyParams: MapProxyParams = { source };
  if (upstreamPath) proxyParams.path = upstreamPath;
  const query = queryString({ ...proxyParams, ...params });
  return `${base}/map-proxy.php?${query}`;
}

export function buildMapProxyUrl(
  source: MapProxySource,
  upstreamPath: string,
  params: MapProxyParams,
  viteProxyPath: string,
  options?: BuildUrlOptions
): string {
  const mode = options?.mode || getConfiguredMode();
  if (mode === 'php') return buildPhpProxyUrl(source, upstreamPath, params, options);
  return `${getProxyBase(options)}${viteProxyPath}`;
}
