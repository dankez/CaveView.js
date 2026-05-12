import proj4 from 'proj4';

// EPSG:5514 is S-JTSK Krovak East-North. Wait, usually proj4 returns -Y, -X for Krovak.
// Let's use the user's provided proj4 string.
proj4.defs('EPSG:5514', '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

const TILE_SIZE = 256;

interface Progress {
    current: number;
    total: number;
}

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

proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs');

export interface DownloadResult {
    dataUrl: string;
    // The exact bounding box in S-JTSK of the stitched image!
    sjtskBbox: string; 
}

export async function downloadWmsImage(
    urlPattern: string,
    sjtskBbox: string, // S-JTSK bounding box
    width: number,
    height: number,
    format: string = 'image/jpeg',
    onProgress?: (p: Progress) => void
): Promise<DownloadResult> {
    const parts = sjtskBbox.split(',').map(Number);
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

    const bl3857 = proj4('EPSG:4326', 'EPSG:3857').forward(blGps);
    const tr3857 = proj4('EPSG:4326', 'EPSG:3857').forward(trGps);

    // The bounding box in EPSG:3857
    const bbox3857 = `${Math.min(bl3857[0], tr3857[0])},${Math.min(bl3857[1], tr3857[1])},${Math.max(bl3857[0], tr3857[0])},${Math.max(bl3857[1], tr3857[1])}`;

    const url = urlPattern
        .replace('{bbox}', bbox3857)
        .replace('{width}', width.toString())
        .replace('{height}', height.toString());

    if (onProgress) onProgress({ current: 0, total: 1 });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, width, height);

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`WMS fetch failed: ${resp.statusText}`);
        const blob = await resp.blob();
        const img = await createImageBitmap(blob);
        ctx.drawImage(img, 0, 0, width, height);
    } catch (e) {
        console.warn(`Failed to fetch WMS image`, e);
    } finally {
        if (onProgress) onProgress({ current: 1, total: 1 });
    }

    return {
        dataUrl: canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : 1.0),
        sjtskBbox: expandedSjtskBbox // Bbox is updated to the expanded one!
    };
}

export async function downloadTiledXyz(
    urlPattern: string,
    sjtskBbox: string, // S-JTSK bounding box
    format: string = 'image/jpeg',
    onProgress?: (p: Progress) => void,
    forceZoom?: number
): Promise<DownloadResult> {
    const parts = sjtskBbox.split(',').map(Number);
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
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const total = numTilesX * numTilesY;
    let current = 0;

    const fetchTile = async (tx: number, ty: number) => {
        const url = urlPattern
            .replace('{z}', zoom.toString())
            .replace('{x}', tx.toString())
            .replace('{y}', ty.toString());
        
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Tile fetch failed');
            const blob = await resp.blob();
            const img = await createImageBitmap(blob);
            
            const dx = (tx - xMin) * TILE_SIZE;
            const dy = (ty - yMin) * TILE_SIZE;
            ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
        } catch (e) {
            console.warn(`Failed to fetch tile ${zoom}/${tx}/${ty}`, e);
        } finally {
            current++;
            if (onProgress) onProgress({ current, total });
        }
    };

    const queue = [];
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

    return {
        dataUrl: canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : 1.0),
        sjtskBbox: exactSjtskBbox
    };
}
