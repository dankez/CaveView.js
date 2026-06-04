import type { CaveSurface, SurfaceTextureCalibration } from '@shared/types';
import { bboxToString, getTextureBboxInDtmCrs, parseBboxString, type BboxTuple } from './surfaceBounds';

const NUMBER_RE = /[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi;

export function parseSjtskBboxCalibrationText(text: string): BboxTuple | null {
  const hasBboxHint = /S-JTSK|EPSG:5514|Krovak|Bounding Box|minX/i.test(text);
  if (!hasBboxHint) return null;

  for (const line of text.split(/\r?\n/)) {
    const numbers = line.match(NUMBER_RE)?.map(Number) ?? [];
    if (numbers.length !== 4) continue;

    const candidate = parseBboxString(numbers.join(','));
    if (candidate) return candidate;
  }

  return null;
}

export function createSurfaceTextureCalibrationFromSjtskBbox(
  surface: CaveSurface,
  sjtskBbox: string | BboxTuple
): SurfaceTextureCalibration | null {
  const bboxText = Array.isArray(sjtskBbox) ? bboxToString(sjtskBbox) : sjtskBbox;
  const nativeBounds = getTextureBboxInDtmCrs(surface.dtm, bboxText, surface.sjtskBboxSource);
  const nativeBbox = nativeBounds ? parseBboxString(nativeBounds.bbox) : null;
  if (!nativeBbox) return null;

  const [minX, minY, maxX, maxY] = nativeBbox;
  return {
    source: 'sjtsk-bbox',
    p1: { x: 0, y: 0, mx: minX, my: minY },
    p2: { x: 0, y: 0, mx: maxX, my: maxY },
  };
}
