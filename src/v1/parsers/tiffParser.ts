import { fromArrayBuffer } from 'geotiff';
import type { CaveSurface, Calibration, Vec3 } from '@shared/types';

export async function parseGeoTiff(
  tifBuffer: ArrayBuffer,
  tfwText?: string | null,
  centerOffset?: Vec3
): Promise<CaveSurface> {
  const tiff = await fromArrayBuffer(tifBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  
  let width = image.getWidth();
  let height = image.getHeight();
  let data = rasters[0] as any;

  // ── Calibration settings ──
  let xOrigin = 0;
  let yOrigin = 0;
  let xx = 1;
  let xy = 0;
  let yx = 0;
  let yy = -1; 
  
  if (tfwText) {
    const lines = tfwText.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length >= 6) {
      xx = parseFloat(lines[0]);
      yx = parseFloat(lines[1]); 
      xy = parseFloat(lines[2]); 
      yy = parseFloat(lines[3]);
      xOrigin = parseFloat(lines[4]);
      yOrigin = parseFloat(lines[5]);
    }
  } else {
    const tiePoints = await image.getTiePoints();
    const fileDirectory = image.getFileDirectory() as any;
    if (tiePoints && tiePoints.length > 0) {
      const tp = tiePoints[0];
      // geotiff.js TiePoint: {i, j, k} = raster pixel coords, {x, y, z} = world coords
      xOrigin = tp.x;  
      yOrigin = tp.y;
      // Adjust for pixel offset: tiepoint refers to pixel (i,j), origin is top-left corner
      xOrigin = xOrigin - tp.i * (fileDirectory.ModelPixelScale?.[0] || 1);
      yOrigin = yOrigin + tp.j * (fileDirectory.ModelPixelScale?.[1] || 1);

      const pixelScale = fileDirectory.ModelPixelScale;
      if (pixelScale) {
        xx = pixelScale[0];
        yy = -pixelScale[1];
      }
    }
  }

  // ── Subsampling for performance ──
  const MAX_PIXELS = 1500000;
  if (width * height > MAX_PIXELS) {
    const subsample = Math.ceil(Math.sqrt((width * height) / MAX_PIXELS));
    const newWidth = Math.floor(width / subsample);
    const newHeight = Math.floor(height / subsample);
    const newData = new Float32Array(newWidth * newHeight);
    
    for (let y = 0; y < newHeight; y++) {
      const sourceRow = y * subsample;
      for (let x = 0; x < newWidth; x++) {
        newData[y * newWidth + x] = data[sourceRow * width + (x * subsample)];
      }
    }
    
    data = newData;
    width = newWidth;
    height = newHeight;
    xx *= subsample;
    yy *= subsample;
    xy *= subsample;
    yx *= subsample;
  }

  // ── Read actual NoData value from metadata ──
  const fileDir = image.getFileDirectory() as any;
  let noDataVal: number | null = null;
  const noDataStr = fileDir.GDAL_NODATA;
  if (noDataStr != null) {
    noDataVal = parseFloat(String(noDataStr).trim());
    if (!isFinite(noDataVal)) noDataVal = null;
  }

  let minZ = Infinity;
  let maxZ = -Infinity;
  const dtmData = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    // Filter NoData: exact match, NaN, large negative, or suspiciously large positive
    const isNoData = isNaN(val) 
      || val < -9000 
      || val > 1e30
      || (noDataVal !== null && Math.abs(val - noDataVal) < 1e20);
    if (isNoData) {
      dtmData[i] = 0;
    } else {
      dtmData[i] = val;
      if (val < minZ) minZ = val;
      if (val > maxZ) maxZ = val;
    }
  }

  if (minZ === Infinity) { minZ = 0; maxZ = 100; }

  const calib: Calibration = {
    xOrigin,
    yOrigin,
    xx,
    xy,
    yx,
    yy
  };

  return {
    dtm: {
      data: dtmData,
      samples: width,
      lines: height,
      calib
    },
    bitmapUrl: null,
    centerOffset: centerOffset || { x: 0, y: 0, z: 0 },
    bounds: {
      minZ,
      maxZ,
      width: width * xx,
      height: height * Math.abs(yy)
    }
  };
}
