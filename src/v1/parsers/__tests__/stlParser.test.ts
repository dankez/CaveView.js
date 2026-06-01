import { describe, it, expect } from 'vitest';
import { parseStl } from '../stlParser';
import * as fs from 'fs';
import * as path from 'path';

describe('STL Parser', () => {
  it('should correctly parse a binary STL file', () => {
    // Načítame testovací scan.stl
    const filePath = path.resolve(__dirname, '../../../../test_model/scan.stl');
    const buffer = fs.readFileSync(filePath).buffer;
    
    const parsed = parseStl(buffer);
    
    expect(parsed.scrapCount).toBe(1);
    expect(parsed.scraps.length).toBe(1);
    expect(parsed.scraps[0].vertices.length).toBeGreaterThan(0);
    expect(parsed.scraps[0].faces.length).toBeGreaterThan(0);
    
    // Bounding box by mal byť centrovaný okolo nuly
    expect(parsed.bounds.center.x).toBe(0);
    expect(parsed.bounds.center.y).toBe(0);
    expect(parsed.bounds.center.z).toBe(0);
    
    // Mala by existovať aspoň jedna virtuálna stanica
    expect(parsed.stationCount).toBe(1);
    expect(parsed.stations[0]).toEqual({ x: 0, y: 0, z: 0 });
  });
});
