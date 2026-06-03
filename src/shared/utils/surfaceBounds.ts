import type { Calibration } from '@shared/types';

interface DtmLike {
  samples: number;
  lines: number;
  calib: Calibration;
}

export interface SjtskBounds {
  bbox: string;
  aspect: number;
}

const SJTSK_MIN_X = -950000;
const SJTSK_MAX_X = -150000;
const SJTSK_MIN_Y = -1350000;
const SJTSK_MAX_Y = -900000;

function gridToWorld(calib: Calibration, col: number, row: number) {
  return {
    x: calib.xOrigin + col * calib.xx + row * calib.xy,
    y: calib.yOrigin + col * calib.yx + row * calib.yy,
  };
}

export function getSjtskBoundsFromDtm(dtm: DtmLike): SjtskBounds | null {
  if (!dtm || dtm.samples < 1 || dtm.lines < 1) return null;

  const maxCol = Math.max(0, dtm.samples - 1);
  const maxRow = Math.max(0, dtm.lines - 1);
  const corners = [
    gridToWorld(dtm.calib, 0, 0),
    gridToWorld(dtm.calib, maxCol, 0),
    gridToWorld(dtm.calib, 0, maxRow),
    gridToWorld(dtm.calib, maxCol, maxRow),
  ];

  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  if (maxX <= minX || maxY <= minY) return null;

  const isLikelySjtsk =
    minX >= SJTSK_MIN_X &&
    maxX <= SJTSK_MAX_X &&
    minY >= SJTSK_MIN_Y &&
    maxY <= SJTSK_MAX_Y;

  if (!isLikelySjtsk) return null;

  return {
    bbox: `${minX},${minY},${maxX},${maxY}`,
    aspect: Math.abs(maxY - minY) / Math.abs(maxX - minX),
  };
}
