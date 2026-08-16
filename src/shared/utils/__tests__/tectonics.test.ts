import { describe, it, expect } from 'vitest';
import { calculateTectonics, getCardinalDirection } from '../tectonics';

describe('calculateTectonics', () => {
  it('correctly calculates horizontal plane (dip = 0°)', () => {
    const p1 = { x: 0, y: 0, z: 100 };
    const p2 = { x: 10, y: 0, z: 100 };
    const p3 = { x: 0, y: 10, z: 100 };

    const res = calculateTectonics(p1, p2, p3, 'sk');

    expect(res.isCollinear).toBe(false);
    expect(res.dipAngle).toBeCloseTo(0, 4);
    expect(res.normal[0]).toBeCloseTo(0, 4);
    expect(res.normal[1]).toBeCloseTo(0, 4);
    expect(res.normal[2]).toBeCloseTo(1, 4);
    expect(res.area).toBeCloseTo(50, 4);
  });

  it('correctly calculates vertical wall facing East (dip = 90°, dipDirection = 90° East)', () => {
    // Plane x = const sloping down to East
    // Points on vertical plane with normal pointing East
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 0, y: 10, z: 0 }; // North
    const p3 = { x: 0, y: 0, z: 10 }; // Up
    // Normal = (1, 0, 0)
    const res = calculateTectonics(p1, p2, p3, 'sk');

    expect(res.isCollinear).toBe(false);
    expect(res.dipAngle).toBeCloseTo(90, 4);
    expect(res.dipDirection).toBeCloseTo(90, 4);
    expect(res.cardinalDirection).toBe('V');
  });

  it('correctly calculates 45° slope dipping to South (dipDirection = 180° South)', () => {
    // Slopes down towards South: as Y decreases, Z decreases (or as Y increases, Z increases)
    // p1 = (0, 0, 0)
    // p2 = (10, 0, 0) (East, same height) -> strike is East-West (90° - 270°)
    // p3 = (0, -10, -10) (South, 10m lower) -> slope 45° to South
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 10, y: 0, z: 0 };
    const p3 = { x: 0, y: -10, z: -10 };

    const res = calculateTectonics(p1, p2, p3, 'sk');

    expect(res.isCollinear).toBe(false);
    expect(res.dipAngle).toBeCloseTo(45, 4);
    expect(res.dipDirection).toBeCloseTo(180, 4);
    expect(res.cardinalDirection).toBe('J');
    expect(res.strike[0]).toBeCloseTo(90, 4);
    expect(res.strike[1]).toBeCloseTo(270, 4);
    expect(res.notation).toBe('180° / 45°');
  });

  it('correctly calculates slope dipping to South-East (135°)', () => {
    // East (+10) and South (-10) at lower altitude
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 10, y: 10, z: 0 }; // Strike line along 45° (NE)
    const p3 = { x: 10, y: -10, z: -Math.SQRT2 * 10 }; // 45° dip towards SE (135°)

    const res = calculateTectonics(p1, p2, p3, 'sk');

    expect(res.isCollinear).toBe(false);
    expect(res.dipAngle).toBeCloseTo(45, 1);
    expect(res.dipDirection).toBeCloseTo(135, 1);
    expect(res.cardinalDirection).toBe('JV');
  });

  it('handles collinear points safely', () => {
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 5, y: 5, z: 5 };
    const p3 = { x: 10, y: 10, z: 10 };

    const res = calculateTectonics(p1, p2, p3, 'sk');

    expect(res.isCollinear).toBe(true);
    expect(res.area).toBe(0);
  });
});

describe('getCardinalDirection', () => {
  it('converts azimuths correctly in Slovak', () => {
    expect(getCardinalDirection(0, 'sk')).toBe('S');
    expect(getCardinalDirection(90, 'sk')).toBe('V');
    expect(getCardinalDirection(180, 'sk')).toBe('J');
    expect(getCardinalDirection(270, 'sk')).toBe('Z');
    expect(getCardinalDirection(135, 'sk')).toBe('JV');
    expect(getCardinalDirection(45, 'sk')).toBe('SV');
  });

  it('converts azimuths correctly in English', () => {
    expect(getCardinalDirection(0, 'en')).toBe('N');
    expect(getCardinalDirection(90, 'en')).toBe('E');
    expect(getCardinalDirection(180, 'en')).toBe('S');
    expect(getCardinalDirection(270, 'en')).toBe('W');
    expect(getCardinalDirection(135, 'en')).toBe('SE');
  });
});
