import proj4 from 'proj4';
import type { Calibration } from '@shared/types';
import { SJTSK_DEF } from './geoUtils';

interface DtmLike {
  samples: number;
  lines: number;
  calib: Calibration;
}

export interface SjtskBounds {
  bbox: string;
  aspect: number;
  sourceCrs?: 'EPSG:5514' | 'UTM';
  utmZone?: number;
}

export type BboxTuple = [number, number, number, number];

const SJTSK_MIN_X = -950000;
const SJTSK_MAX_X = -150000;
const SJTSK_MIN_Y = -1350000;
const SJTSK_MAX_Y = -900000;
const UTM_MIN_EASTING = 100000;
const UTM_MAX_EASTING = 900000;
const UTM_MIN_NORTHING = 4700000;
const UTM_MAX_NORTHING = 5600000;
const SLOVAKIA_MIN_LAT = 47.4;
const SLOVAKIA_MAX_LAT = 49.8;
const SLOVAKIA_MIN_LON = 16.7;
const SLOVAKIA_MAX_LON = 22.8;
const UTM_CANDIDATE_ZONES = [34, 33, 35, 32];

function gridToWorld(calib: Calibration, col: number, row: number) {
  return {
    x: calib.xOrigin + col * calib.xx + row * calib.xy,
    y: calib.yOrigin + col * calib.yx + row * calib.yy,
  };
}

export function parseBboxString(bbox: string): BboxTuple | null {
  const parts = bbox.split(',').map(part => Number(part.trim()));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;

  const [minX, minY, maxX, maxY] = parts;
  if (maxX <= minX || maxY <= minY) return null;

  return [minX, minY, maxX, maxY];
}

export function bboxToString([minX, minY, maxX, maxY]: BboxTuple): string {
  return `${minX},${minY},${maxX},${maxY}`;
}

function getDtmCorners(dtm: DtmLike): { x: number; y: number }[] {
  const maxCol = Math.max(0, dtm.samples - 1);
  const maxRow = Math.max(0, dtm.lines - 1);
  return [
    gridToWorld(dtm.calib, 0, 0),
    gridToWorld(dtm.calib, maxCol, 0),
    gridToWorld(dtm.calib, 0, maxRow),
    gridToWorld(dtm.calib, maxCol, maxRow),
  ];
}

function boundsFromPoints(points: { x: number; y: number }[], sourceCrs: SjtskBounds['sourceCrs']): SjtskBounds | null {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  if (maxX <= minX || maxY <= minY) return null;

  return {
    bbox: `${minX},${minY},${maxX},${maxY}`,
    aspect: Math.abs(maxY - minY) / Math.abs(maxX - minX),
    sourceCrs,
  };
}

function isLikelySjtskBounds(bounds: SjtskBounds): boolean {
  const [minX, minY, maxX, maxY] = bounds.bbox.split(',').map(Number);
  return (
    minX >= SJTSK_MIN_X &&
    maxX <= SJTSK_MAX_X &&
    minY >= SJTSK_MIN_Y &&
    maxY <= SJTSK_MAX_Y
  );
}

function isLikelyUtmCorners(corners: { x: number; y: number }[]): boolean {
  return corners.every(p =>
    p.x >= UTM_MIN_EASTING &&
    p.x <= UTM_MAX_EASTING &&
    p.y >= UTM_MIN_NORTHING &&
    p.y <= UTM_MAX_NORTHING
  );
}

function utmDef(zone: number): string {
  return `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;
}

function getUtmZoneFromCorners(corners: { x: number; y: number }[]): number | null {
  if (!isLikelyUtmCorners(corners)) return null;

  for (const zone of UTM_CANDIDATE_ZONES) {
    try {
      const wgsCorners = corners.map(p => {
        const [lon, lat] = proj4(utmDef(zone), 'WGS84', [p.x, p.y]);
        return { lat, lon };
      });

      const isInSlovakia = wgsCorners.every(p =>
        p.lat >= SLOVAKIA_MIN_LAT &&
        p.lat <= SLOVAKIA_MAX_LAT &&
        p.lon >= SLOVAKIA_MIN_LON &&
        p.lon <= SLOVAKIA_MAX_LON
      );
      if (isInSlovakia) return zone;
    } catch {
      continue;
    }
  }

  return null;
}

export function inferUtmZoneFromDtm(dtm: DtmLike): number | null {
  return getUtmZoneFromCorners(getDtmCorners(dtm));
}

function getSjtskBoundsFromUtmCorners(corners: { x: number; y: number }[]): SjtskBounds | null {
  const zone = getUtmZoneFromCorners(corners);
  if (!zone) return null;

  try {
    const wgsCorners = corners.map(p => {
      const [lon, lat] = proj4(utmDef(zone), 'WGS84', [p.x, p.y]);
      return { lat, lon };
    });

    const sjtskCorners = wgsCorners.map(p => {
      const [x, y] = proj4('WGS84', SJTSK_DEF, [p.lon, p.lat]);
      return { x, y };
    });
    const bounds = boundsFromPoints(sjtskCorners, 'UTM');
    if (bounds && isLikelySjtskBounds(bounds)) return { ...bounds, utmZone: zone };
  } catch {
    return null;
  }

  return null;
}

export function getTextureBboxInDtmCrs(
  dtm: DtmLike,
  sjtskBbox: string,
  sourceCrs?: 'EPSG:5514' | 'UTM'
): SjtskBounds | null {
  const parsed = parseBboxString(sjtskBbox);
  if (!parsed) return null;

  const dtmCorners = getDtmCorners(dtm);
  const utmZone = sourceCrs === 'UTM' || (!sourceCrs && isLikelyUtmCorners(dtmCorners))
    ? getUtmZoneFromCorners(dtmCorners)
    : null;

  if (!utmZone) {
    return {
      bbox: bboxToString(parsed),
      aspect: Math.abs(parsed[3] - parsed[1]) / Math.abs(parsed[2] - parsed[0]),
      sourceCrs: 'EPSG:5514',
    };
  }

  const [minX, minY, maxX, maxY] = parsed;
  const corners: { x: number; y: number }[] = [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ].map(([x, y]) => {
    const [lon, lat] = proj4(SJTSK_DEF, 'WGS84', [x, y]);
    const [utmX, utmY] = proj4('WGS84', utmDef(utmZone), [lon, lat]);
    return { x: utmX, y: utmY };
  });

  const bounds = boundsFromPoints(corners, 'UTM');
  return bounds ? { ...bounds, utmZone } : null;
}

export function getSjtskBoundsFromDtm(dtm: DtmLike): SjtskBounds | null {
  if (!dtm || dtm.samples < 1 || dtm.lines < 1) return null;

  const corners = getDtmCorners(dtm);

  const directBounds = boundsFromPoints(corners, 'EPSG:5514');
  if (directBounds && isLikelySjtskBounds(directBounds)) return directBounds;

  return getSjtskBoundsFromUtmCorners(corners);
}
