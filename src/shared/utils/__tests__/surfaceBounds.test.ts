import { describe, expect, it } from 'vitest';
import { getSjtskBoundsFromDtm, getTextureBboxInDtmCrs, inferUtmZoneFromDtm } from '../surfaceBounds';

describe('getSjtskBoundsFromDtm', () => {
  it('computes S-JTSK bounds from all calibrated grid corners', () => {
    const bounds = getSjtskBoundsFromDtm({
      samples: 3,
      lines: 2,
      calib: {
        xOrigin: -500000,
        yOrigin: -1200000,
        xx: 10,
        xy: 2,
        yx: 1,
        yy: -10,
      },
    });

    expect(bounds?.bbox).toBe('-500000,-1200010,-499978,-1199998');
    expect(bounds?.aspect).toBeCloseTo(12 / 22);
    expect(bounds?.sourceCrs).toBe('EPSG:5514');
  });

  it('converts Slovakia UTM terrain calibration to S-JTSK bounds', () => {
    const dtm = {
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
    };

    const bounds = getSjtskBoundsFromDtm(dtm);

    const bbox = bounds?.bbox.split(',').map(Number);

    expect(bounds?.sourceCrs).toBe('UTM');
    expect(bounds?.utmZone).toBe(34);
    expect(bbox?.[0]).toBeCloseTo(-296035.24574005377, 4);
    expect(bbox?.[1]).toBeCloseTo(-1245111.6550723414, 4);
    expect(bbox?.[2]).toBeCloseTo(-293526.2328366022, 4);
    expect(bbox?.[3]).toBeCloseTo(-1243484.600335571, 4);
    expect(bounds?.aspect).toBeCloseTo(0.6484840052166206);
    expect(inferUtmZoneFromDtm(dtm)).toBe(34);
  });

  it('converts downloaded S-JTSK texture bounds back to UTM terrain coordinates', () => {
    const nativeBounds = getTextureBboxInDtmCrs({
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
    }, '-297930.85996126576,-1246765.6381902215,-291979.0962193103,-1241421.7803403016', 'UTM');

    const bbox = nativeBounds?.bbox.split(',').map(Number);

    expect(nativeBounds?.sourceCrs).toBe('UTM');
    expect(nativeBounds?.utmZone).toBe(34);
    expect(bbox?.[0]).toBeCloseTo(483977.8558838942, 4);
    expect(bbox?.[1]).toBeCloseTo(5387478.370927079, 4);
    expect(bbox?.[2]).toBeCloseTo(490187.3625950929, 4);
    expect(bbox?.[3]).toBeCloseTo(5393111.290165701, 4);
  });

  it('rejects terrain that is not plausibly in Slovakia S-JTSK coordinates', () => {
    const bounds = getSjtskBoundsFromDtm({
      samples: 2,
      lines: 2,
      calib: {
        xOrigin: 0,
        yOrigin: 0,
        xx: 1,
        xy: 0,
        yx: 0,
        yy: -1,
      },
    });

    expect(bounds).toBeNull();
  });
});
