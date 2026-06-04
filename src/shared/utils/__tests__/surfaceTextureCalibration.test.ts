import { describe, expect, it } from 'vitest';
import { createSurfaceTextureCalibrationFromSjtskBbox, parseSjtskBboxCalibrationText } from '../surfaceTextureCalibration';
import type { CaveSurface } from '@shared/types';

const zadielSurface = {
  dtm: {
    data: new Float64Array(0),
    samples: 2510,
    lines: 1628,
    calib: {
      xOrigin: 486054.8941542,
      yOrigin: 5389224.496512,
      xx: 0.99844281801,
      xy: -0.04997411984535,
      yx: 0.04998078254367,
      yy: 0.9984514345051,
    },
  },
  bitmapUrl: null,
  centerOffset: { x: 0, y: 0, z: 0 },
  sjtskBboxSource: 'UTM',
} satisfies CaveSurface;

describe('surface texture calibration', () => {
  it('parses CaveViewer generated S-JTSK bbox calibration text', () => {
    const bbox = parseSjtskBboxCalibrationText(`S-JTSK Bounding Box (Krovak EPSG:5514)
minX, minY, maxX, maxY
-297930.85996126576,-1246765.6381902215,-291979.0962193103,-1241421.7803403016

Tento subor sa da neskor pouzit na rucnu kalibraciu.`);

    expect(bbox).toEqual([
      -297930.85996126576,
      -1246765.6381902215,
      -291979.0962193103,
      -1241421.7803403016,
    ]);
  });

  it('creates native UTM calibration for a downloaded S-JTSK texture bbox', () => {
    const calibration = createSurfaceTextureCalibrationFromSjtskBbox(
      zadielSurface,
      '-297930.85996126576,-1246765.6381902215,-291979.0962193103,-1241421.7803403016'
    );

    expect(calibration?.source).toBe('sjtsk-bbox');
    expect(calibration?.p1.mx).toBeCloseTo(483977.8558838942, 4);
    expect(calibration?.p1.my).toBeCloseTo(5387478.370927079, 4);
    expect(calibration?.p2.mx).toBeCloseTo(490187.3625950929, 4);
    expect(calibration?.p2.my).toBeCloseTo(5393111.290165701, 4);
  });
});
