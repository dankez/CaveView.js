import { describe, expect, it } from 'vitest';
import { getSjtskBoundsFromDtm } from '../surfaceBounds';

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
