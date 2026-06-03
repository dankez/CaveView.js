import proj4 from 'proj4';
import { SJTSK_DEF } from './geoUtils';

proj4.defs('EPSG:5514', SJTSK_DEF);
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs');

const TILE_SIZE = 256;

export interface Progress {
    current: number;
    total: number;
}

export interface DownloadFailure {
    z?: number;
    x?: number;
    y?: number;
    url: string;
    error: string;
}

export type WmsCrs = 'EPSG:3857' | 'EPSG:5514';

const gpsToTile = (lat: number, lon: number, zoom: number): { x: number; y: number } => {
  const n = Math.pow(2, zoom);
  const xtile = Math.floor((lon + 180.0) / 360.0 * n);
  const ytile = Math.floor((1.0 - Math.log(Math.tan(lat * Math.PI / 180.0) + 1 / Math.cos(lat * Math.PI / 180.0)) / Math.PI) / 2.0 * n);
  return { x: xtile, y: ytile };
};

const tileToGps = (x: number, y: number, zoom: number): { lat: number; lon: number } => {
    const n = Math.pow(2, zoom);
    const lon = (x / n) * 360.0 - 180.0;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = latRad * 180.0 / Math.PI;
    return { lat, lon };
};

const metersPerPixel = (lat: number, zoom: number): number => {
    return (2 * Math.PI * 6378137 / TILE_SIZE) * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
};

export interface DownloadResult {
    dataUrl: string;
    // The exact bounding box in S-JTSK of the stitched image!
    sjtskBbox: string;
    totalTiles?: number;
    successfulTiles?: number;
    failedTiles?: DownloadFailure[];
}

function parseSjtskBbox(sjtskBbox: string): [number, number, number, number] {
    const parts = sjtskBbox.split(',').map(Number);
    if (parts.length !== 4 || !parts.every(Number.isFinite)) {
        throw new Error(`Invalid S-JTSK bbox: ${sjtskBbox}`);
    }

    const [minX, minY, maxX, maxY] = parts;
    if (maxX <= minX || maxY <= minY) {
        throw new Error(`Invalid S-JTSK bbox extent: ${sjtskBbox}`);
    }

    return [minX, minY, maxX, maxY];
}

export async function downloadWmsImage(
    urlPattern: string,
    sjtskBbox: string, // S-JTSK bounding box
    width: number,
    height: number,
    format: string = 'image/jpeg',
    onProgress?: (p: Progress) => void,
    crs: WmsCrs = 'EPSG:3857'
): Promise<DownloadResult> {
    const parts = parseSjtskBbox(sjtskBbox);
    // Expand by 150 meters to ensure the texture is always larger than the 3D model
    const margin = 150;
    const minX = parts[0] - margin;
    const minY = parts[1] - margin;
    const maxX = parts[2] + margin;
    const maxY = parts[3] + margin;

    // Convert corners to EPSG:3857 (Web Mercator) since WMS uses crs=EPSG:3857
    const blGps = proj4('EPSG:5514', 'EPSG:4326').forward([minX, minY]);
    const trGps = proj4('EPSG:5514', 'EPSG:4326').forward([maxX, maxY]);

    // We update the BBox string to reflect the newly expanded area for exact calibration
    const expandedSjtskBbox = `${minX},${minY},${maxX},${maxY}`;

    let requestBbox = expandedSjtskBbox;
    if (crs === 'EPSG:3857') {
        const bl3857 = proj4('EPSG:4326', 'EPSG:3857').forward(blGps);
        const tr3857 = proj4('EPSG:4326', 'EPSG:3857').forward(trGps);
        requestBbox = `${Math.min(bl3857[0], tr3857[0])},${Math.min(bl3857[1], tr3857[1])},${Math.max(bl3857[0], tr3857[0])},${Math.max(bl3857[1], tr3857[1])}`;
    }

    const url = urlPattern
        .replace('{bbox}', requestBbox)
        .replace('{width}', width.toString())
        .replace('{height}', height.toString())
        .replace('{crs}', encodeURIComponent(crs));

    if (onProgress) onProgress({ current: 0, total: 1 });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, width, height);

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`WMS fetch failed: ${resp.status} ${resp.statusText}`);
        const blob = await resp.blob();
        const img = await createImageBitmap(blob);
        ctx.drawImage(img, 0, 0, width, height);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to fetch WMS image: ${message}`);
    } finally {
        if (onProgress) onProgress({ current: 1, total: 1 });
    }

    return {
        dataUrl: canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : 1.0),
        sjtskBbox: expandedSjtskBbox,
        totalTiles: 1,
        successfulTiles: 1,
        failedTiles: [],
    };
}

export async function downloadTiledXyz(
    urlPattern: string,
    sjtskBbox: string, // S-JTSK bounding box
    format: string = 'image/jpeg',
    onProgress?: (p: Progress) => void,
    forceZoom?: number
): Promise<DownloadResult> {
    const parts = parseSjtskBbox(sjtskBbox);
    const minX = parts[0];
    const minY = parts[1];
    const maxX = parts[2];
    const maxY = parts[3];
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const widthMeters = Math.abs(maxX - minX);
    const heightMeters = Math.abs(maxY - minY);

    // Convert center from S-JTSK to WGS84
    const centerGps = proj4('EPSG:5514', 'EPSG:4326').forward([centerX, centerY]);
    const lon = centerGps[0];
    const lat = centerGps[1];

    let zoom = forceZoom || 18;
    const maxMeters = Math.max(widthMeters, heightMeters);
    if (!forceZoom) {
        if (maxMeters > 3000) zoom = 15;
        else if (maxMeters > 1500) zoom = 16;
        else if (maxMeters > 500) zoom = 17;
    }

    const centerTile = gpsToTile(lat, lon, zoom);

    const mpp = metersPerPixel(lat, zoom);
    const metersPerTile = mpp * TILE_SIZE;

    // We pad by at least 1 tile in each direction to ensure coverage
    const paddingTiles = 1;
    
    // Calculate how many tiles we need from center
    const tileE = Math.ceil((widthMeters / 2) / metersPerTile) + paddingTiles;
    const tileW = Math.ceil((widthMeters / 2) / metersPerTile) + paddingTiles;
    const tileN = Math.ceil((heightMeters / 2) / metersPerTile) + paddingTiles;
    const tileS = Math.ceil((heightMeters / 2) / metersPerTile) + paddingTiles;

    const xMin = centerTile.x - tileW;
    const xMax = centerTile.x + tileE;
    const yMin = centerTile.y - tileN;
    const yMax = centerTile.y + tileS;

    const numTilesX = xMax - xMin + 1;
    const numTilesY = yMax - yMin + 1;

    // Calculate EXACT corner GPS coordinates of the stitched whole-tile image
    const blGps = tileToGps(xMin, yMax + 1, zoom);
    const trGps = tileToGps(xMax + 1, yMin, zoom);

    // Convert corners back to S-JTSK
    const blJtsk = proj4('EPSG:4326', 'EPSG:5514').forward([blGps.lon, blGps.lat]);
    const trJtsk = proj4('EPSG:4326', 'EPSG:5514').forward([trGps.lon, trGps.lat]);
    
    // Create actual returned BBOX. Note: Krovak bounds (X, Y)
    const exactSjtskBbox = `${Math.min(blJtsk[0], trJtsk[0])},${Math.min(blJtsk[1], trJtsk[1])},${Math.max(blJtsk[0], trJtsk[0])},${Math.max(blJtsk[1], trJtsk[1])}`;

    const canvas = document.createElement('canvas');
    canvas.width = numTilesX * TILE_SIZE;
    canvas.height = numTilesY * TILE_SIZE;
    
    const ctx = canvas.getContext('2d')!;
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const total = numTilesX * numTilesY;
    let current = 0;
    let successfulTiles = 0;
    const failedTiles: DownloadFailure[] = [];

    const fetchTile = async (tx: number, ty: number) => {
        let url = urlPattern
            .replace('{z}', zoom.toString())
            .replace('{x}', tx.toString())
            .replace('{y}', ty.toString())
            .replace('{width}', TILE_SIZE.toString())
            .replace('{height}', TILE_SIZE.toString());
        
        if (url.includes('{bbox}')) {
            // Calculate tile bbox in EPSG:3857
            const bl = tileToGps(tx, ty + 1, zoom);
            const tr = tileToGps(tx + 1, ty, zoom);
            const bl3857 = proj4('EPSG:4326', 'EPSG:3857').forward([bl.lon, bl.lat]);
            const tr3857 = proj4('EPSG:4326', 'EPSG:3857').forward([tr.lon, tr.lat]);
            const bboxStr = `${bl3857[0]},${bl3857[1]},${tr3857[0]},${tr3857[1]}`;
            url = url.replace('{bbox}', bboxStr);
        }
        
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Tile fetch failed: ${resp.status} ${resp.statusText}`);
            const blob = await resp.blob();
            const img = await createImageBitmap(blob);
            
            const dx = (tx - xMin) * TILE_SIZE;
            const dy = (ty - yMin) * TILE_SIZE;
            ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
            successfulTiles++;
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            failedTiles.push({ z: zoom, x: tx, y: ty, url, error });
            console.warn(`Failed to fetch tile ${zoom}/${tx}/${ty}`, e);
        } finally {
            current++;
            if (onProgress) onProgress({ current, total });
        }
    };

    const queue: [number, number][] = [];
    for (let ty = yMin; ty <= yMax; ty++) {
        for (let tx = xMin; tx <= xMax; tx++) {
            queue.push([tx, ty]);
        }
    }

    const concurrency = 6;
    for (let i = 0; i < queue.length; i += concurrency) {
        const batch = queue.slice(i, i + concurrency);
        await Promise.all(batch.map(([tx, ty]) => fetchTile(tx, ty)));
    }

    if (successfulTiles === 0) {
        const firstFailure = failedTiles[0];
        const detail = firstFailure ? ` First failure: ${firstFailure.error}` : '';
        throw new Error(`No map tiles downloaded (${failedTiles.length}/${total} failed).${detail}`);
    }

    return {
        dataUrl: canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : 1.0),
        sjtskBbox: exactSjtskBbox,
        totalTiles: total,
        successfulTiles,
        failedTiles,
    };
}
