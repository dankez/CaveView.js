import { describe, it, expect } from 'vitest';
import { parsePlt } from '../caveParser';

describe('caveParser', () => {
  describe('parsePlt', () => {
    it('should parse simple PLT data correctly', () => {
      const pltData = `
M 0 0 0
D 10 0 0 Station1
D 10 10 5 Station2
`;
      const result = parsePlt(pltData);

      expect(result.stationCount).toBe(3);
      expect(result.segmentCount).toBe(2);
      
      // Feet to Meters conversion check (0.3048)
      // 10 feet = 3.048 meters
      expect(result.bounds.size.x).toBeCloseTo(3.048);
      expect(result.bounds.size.y).toBeCloseTo(3.048);
      expect(result.bounds.size.z).toBeCloseTo(1.524); // 5 * 0.3048
    });

    it('should handle invalid lines gracefully', () => {
      const pltData = `
INVALID LINE
M 0 0 0
D 10 0 0
X 10 10 10
D 10 10 10
`;
      const result = parsePlt(pltData);
      expect(result.stationCount).toBe(3);
      expect(result.segmentCount).toBe(1); // M -> D works, then X breaks, then D fails because prevPos is null
    });
  });
});
