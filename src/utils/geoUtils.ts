import proj4 from 'proj4';

// S-JTSK Coordinate System Definition
export const SJTSK_DEF = "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs";

/**
 * Converts WGS84 [lat, lon] to S-JTSK [x, y]
 */
export function wgs84ToJtsk(lat: number, lon: number): [number, number] | null {
    try {
        const jtsk = proj4("WGS84", SJTSK_DEF, [lon, lat]);
        return [jtsk[0], jtsk[1]];
    } catch (e) {
        console.warn("Conversion to S-JTSK failed:", e);
        return null;
    }
}

/**
 * Converts S-JTSK [x, y] to WGS84 [lat, lon]
 */
export function jtskToWgs84(x: number, y: number): { lat: number; lon: number } | null {
    try {
        const wgs = proj4(SJTSK_DEF, "WGS84", [x, y]);
        return { lat: wgs[1], lon: wgs[0] };
    } catch (e) {
        console.warn("Conversion to WGS84 failed:", e);
        return null;
    }
}

/**
 * Fetches altitude from ZBGIS (LLS_DMR5) for a given WGS84 location.
 * Uses the ArcGIS Identify service.
 */
export async function fetchAltitudeFromZbgis(lat: number, lon: number): Promise<number | null> {
    const jtsk = wgs84ToJtsk(lat, lon);
    if (!jtsk) return null;
    const [x, y] = jtsk;

    // We use a small extent around the point for the identify task
    const extent = `${x - 0.5},${y - 0.5},${x + 0.5},${y + 0.5}`;
    const geometry = JSON.stringify({ x, y, spatialReference: { wkid: 5514 } });
    
    // Using zbgis-proxy or direct if possible. 
    // Usually zbgis services need a proxy for CORS, but MapServer/identify is sometimes open.
    // However, for consistency with the rest of the app, we can use a proxy if needed.
    // For now we'll try direct.
    // We use the proxy defined in vite.config.ts to avoid CORS issues
    const url = `/xyz-proxy/zbgis/LLS_DMR5/MapServer/identify?f=json&geometry=${encodeURIComponent(geometry)}&geometryType=esriGeometryPoint&sr=5514&layers=all&tolerance=1&mapExtent=${extent}&imageDisplay=100,100,96`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const json = await resp.json();
        
        if (json.results && json.results.length > 0) {
            // Identify returns attributes. For raster layers, look for "Pixel Value"
            const result = json.results[0];
            const val = parseFloat(result.attributes['Pixel Value'] || result.value);
            if (!isNaN(val) && val > -500 && val < 9000) {
                return val;
            }
        }
    } catch (e) {
        console.error("Elevation fetch failed:", e);
    }
    return null;
}
