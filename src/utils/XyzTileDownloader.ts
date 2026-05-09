import proj4 from 'proj4';

// S-JTSK (EPSG:5514) to WGS84 (EPSG:4326)
proj4.defs('EPSG:5514', '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs');

const TILE_SIZE = 256;

interface Progress {
    current: number;
    total: number;
}

/**
 * Converts longitude to tile X coordinate
 */
function lon2tile(lon: number, zoom: number): number {
    return ((lon + 180) / 360) * Math.pow(2, zoom);
}

/**
 * Converts latitude to tile Y coordinate
 */
function lat2tile(lat: number, zoom: number): number {
    return (
        ((1 -
            Math.log(
                Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
            ) /
                Math.PI) /
            2) *
        Math.pow(2, zoom)
    );
}

/**
 * Converts tile X to longitude
 */
function tile2lon(x: number, z: number): number {
    return (x / Math.pow(2, z)) * 360 - 180;
}

/**
 * Converts tile Y to latitude
 */
function tile2lat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Downloads and stitches XYZ tiles into a single texture data URL.
 */
export async function downloadTiledXyz(
    urlPattern: string,
    sjtskBbox: string,
    format: string = 'image/jpeg',
    onProgress?: (p: Progress) => void
): Promise<string> {
    const parts = sjtskBbox.split(',').map(Number);
    // Expand BBOX slightly to ensure coverage (as requested by user previously)
    const w = parts[2] - parts[0];
    const h = parts[3] - parts[1];
    const pad = 0.25;
    const minX = parts[0] - w * pad;
    const minY = parts[1] - h * pad;
    const maxX = parts[2] + w * pad;
    const maxY = parts[3] + h * pad;

    // Convert S-JTSK BBOX corners to WGS84
    // S-JTSK is usually -X, -Y in GIS software but proj4 expects Krovak positive
    // However, our sjtskBbox is already in our internal S-JTSK system.
    // In our system: x is easting, y is northing.
    // Proj4 EPSG:5514 expects X as -easting, Y as -northing? No, standard 5514 is southing/westing.
    // Let's check how reference project does it.
    
    const p1 = proj4('EPSG:5514', 'EPSG:4326', [minX, minY]);
    const p2 = proj4('EPSG:5514', 'EPSG:4326', [maxX, maxY]);

    const west = Math.min(p1[0], p2[0]);
    const east = Math.max(p1[0], p2[0]);
    const south = Math.min(p1[1], p2[1]);
    const north = Math.max(p1[1], p2[1]);

    // Adaptive zoom based on model size
    const maxMeters = Math.max(w, h);
    let zoom = 16;
    if (maxMeters < 500) zoom = 18;
    else if (maxMeters < 1500) zoom = 17;
    
    // ZBGIS Orto supports up to 19
    if (urlPattern.includes('Ortofoto') && maxMeters < 300) zoom = 19;

    const xMin = lon2tile(west, zoom);
    const xMax = lon2tile(east, zoom);
    const yMin = lat2tile(north, zoom); // North is lower Y index
    const yMax = lat2tile(south, zoom);

    const xStart = Math.floor(xMin);
    const xEnd = Math.floor(xMax);
    const yStart = Math.floor(yMin);
    const yEnd = Math.floor(yMax);

    const numTilesX = xEnd - xStart + 1;
    const numTilesY = yEnd - yStart + 1;

    const canvas = document.createElement('canvas');
    const targetWidth = (xMax - xMin) * TILE_SIZE;
    const targetHeight = (yMax - yMin) * TILE_SIZE;
    
    // Limit canvas size to avoid GPU/browser crashes (4096px is safe)
    const MAX_CANVAS = 4096;
    let scale = 1.0;
    if (targetWidth > MAX_CANVAS || targetHeight > MAX_CANVAS) {
        scale = MAX_CANVAS / Math.max(targetWidth, targetHeight);
    }
    
    canvas.width = targetWidth * scale;
    canvas.height = targetHeight * scale;
    const ctx = canvas.getContext('2d')!;

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
            
            // Draw tile onto canvas with offset and scale
            const dx = (tx - xMin) * TILE_SIZE * scale;
            const dy = (ty - yMin) * TILE_SIZE * scale;
            const dw = TILE_SIZE * scale;
            const dh = TILE_SIZE * scale;
            ctx.drawImage(img, dx, dy, dw, dh);
            
            current++;
            if (onProgress) onProgress({ current, total });
        } catch (e) {
            console.warn(`Failed to fetch tile ${zoom}/${tx}/${ty}`, e);
            current++;
            // Draw placeholder for missing tile
            ctx.fillStyle = 'rgba(128,128,128,0.2)';
            const dx = (tx - xMin) * TILE_SIZE * scale;
            const dy = (ty - yMin) * TILE_SIZE * scale;
            ctx.fillRect(dx, dy, TILE_SIZE * scale, TILE_SIZE * scale);
        }
    };

    // Download in parallel with concurrency limit
    const queue = [];
    for (let ty = yStart; ty <= yEnd; ty++) {
        for (let tx = xStart; tx <= xEnd; tx++) {
            queue.push([tx, ty]);
        }
    }

    const concurrency = 6;
    for (let i = 0; i < queue.length; i += concurrency) {
        const batch = queue.slice(i, i + concurrency);
        await Promise.all(batch.map(([tx, ty]) => fetchTile(tx, ty)));
    }

    return canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : 1.0);
}
