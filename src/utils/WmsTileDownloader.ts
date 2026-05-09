import proj4 from 'proj4';

// S-JTSK Coordinate System Definition
proj4.defs('EPSG:5514', '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs');

const TILE_SIZE = 512; // Použijeme 512px pre efektívnejšie sťahovanie cez WMS

export const TileCache = {
  db: null as IDBDatabase | null,
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) { resolve(); return; }
      const request = indexedDB.open('WmsTileCacheDB', 1);
      request.onerror = () => reject("Error opening IndexedDB.");
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles');
        }
      };
    });
  },
  async get(key: string): Promise<Blob | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) { reject("DB not initialized"); return; }
      const transaction = this.db.transaction('tiles', 'readonly');
      const store = transaction.objectStore('tiles');
      const request = store.get(key);
      request.onerror = () => reject("Error reading from cache");
      request.onsuccess = () => resolve(request.result || null);
    });
  },
  async set(key: string, value: Blob): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) { reject("DB not initialized"); return; }
      const transaction = this.db.transaction('tiles', 'readwrite');
      const store = transaction.objectStore('tiles');
      const request = store.put(value, key);
      request.onerror = () => reject("Error writing to cache");
      request.onsuccess = () => resolve();
    });
  }
};

interface DownloadProgress {
  current: number;
  total: number;
  message: string;
}

export async function downloadTiledWms(
  baseUrl: string,
  sjtskBbox: string,
  targetWidth: number,
  targetHeight: number,
  onProgress?: (p: DownloadProgress) => void
): Promise<string> {
  const [minX, minY, maxX, maxY] = sjtskBbox.split(',').map(Number);
  const totalWidthMeters = maxX - minX;
  const totalHeightMeters = maxY - minY;

  const numCols = Math.ceil(targetWidth / TILE_SIZE);
  const numRows = Math.ceil(targetHeight / TILE_SIZE);
  const totalTiles = numCols * numRows;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not create canvas context");

  let completed = 0;

  const downloadQueue: { col: number; row: number }[] = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      downloadQueue.push({ col: c, row: r });
    }
  }

  const worker = async () => {
    while (downloadQueue.length > 0) {
      const { col, row } = downloadQueue.shift()!;
      
      // Calculate BBOX for this tile
      const tMinX = minX + (col * TILE_SIZE / targetWidth) * totalWidthMeters;
      const tMaxX = minX + (Math.min((col + 1) * TILE_SIZE, targetWidth) / targetWidth) * totalWidthMeters;
      
      // WMS expects Y growing upwards, but canvas is downwards. 
      // S-JTSK is usually South-West positive, but the BBOX we have is minX, minY, maxX, maxY.
      // We need to invert the row index for Y calculation
      const tMaxY = maxY - (row * TILE_SIZE / targetHeight) * totalHeightMeters;
      const tMinY = maxY - (Math.min((row + 1) * TILE_SIZE, targetHeight) / targetHeight) * totalHeightMeters;

      const tileBbox = `${tMinX},${tMinY},${tMaxX},${tMaxY}`;
      const tileWidth = Math.min(TILE_SIZE, targetWidth - col * TILE_SIZE);
      const tileHeight = Math.min(TILE_SIZE, targetHeight - row * TILE_SIZE);

      const cacheKey = `${baseUrl}_${tileBbox}_${tileWidth}x${tileHeight}`;
      
      try {
        let blob = await TileCache.get(cacheKey);
        if (!blob) {
          const url = `${baseUrl}&BBOX=${tileBbox}&WIDTH=${tileWidth}&HEIGHT=${tileHeight}`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          blob = await resp.blob();
          await TileCache.set(cacheKey, blob);
        }

        const bitmap = await createImageBitmap(blob);
        ctx.drawImage(bitmap, col * TILE_SIZE, row * TILE_SIZE);
        bitmap.close();
      } catch (err) {
        console.error(`Tile download failed (${col},${row}):`, err);
        // Fill with gray on failure
        ctx.fillStyle = '#444';
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, tileWidth, tileHeight);
      }

      completed++;
      onProgress?.({ 
        current: completed, 
        total: totalTiles, 
        message: `Sťahujem dlaždice... (${completed}/${totalTiles})` 
      });
    }
  };

  // Run with concurrency 5
  const workers = Array(5).fill(null).map(worker);
  await Promise.all(workers);

  return canvas.toDataURL('image/jpeg', 0.9);
}
