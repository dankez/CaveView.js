import { describe, expect, it } from 'vitest';
import {
  wgs84ToUtm34,
  utm34ToWgs84,
  generateTfwContent,
  calculateDmr5Bounds,
  buildDmr5WcsUrl,
  guessCaveCoordinates,
} from '../dmrDownloader';
import type { ParsedCave } from '@shared/types';

describe('dmrDownloader', () => {
  const JASOV_GPS = { lat: 48.665276, lon: 20.817054 };

  describe('coordinate conversion (WGS84 <-> UTM 34N)', () => {
    it('converts Jasov GPS coordinates to UTM 34N correctly', () => {
      const [e, n] = wgs84ToUtm34(JASOV_GPS.lat, JASOV_GPS.lon);
      expect(e).toBeCloseTo(486529.43, 1);
      expect(n).toBeCloseTo(5390263.34, 1);
    });

    it('round-trips UTM 34N back to WGS84 coordinates', () => {
      const [e, n] = wgs84ToUtm34(JASOV_GPS.lat, JASOV_GPS.lon);
      const [lat, lon] = utm34ToWgs84(e, n);
      expect(lat).toBeCloseTo(JASOV_GPS.lat, 5);
      expect(lon).toBeCloseTo(JASOV_GPS.lon, 5);
    });
  });

  describe('calculateDmr5Bounds', () => {
    it('calculates 500x500m bounding box centered on point', () => {
      const bounds = calculateDmr5Bounds(JASOV_GPS.lat, JASOV_GPS.lon, 500);
      expect(bounds.width).toBe(500);
      expect(bounds.height).toBe(500);
      expect(bounds.minE).toBe(486529 - 250);
      expect(bounds.maxE).toBe(bounds.minE + 500);
      expect(bounds.minN).toBe(5390263 - 250);
      expect(bounds.maxN).toBe(bounds.minN + 500);
    });
  });

  describe('generateTfwContent', () => {
    it('generates standard 6-line ESRI world file with half-pixel offset', () => {
      const tfw = generateTfwContent(486279, 5390513, 1.0);
      const lines = tfw.split('\n');
      expect(lines.length).toBe(6);
      expect(lines[0]).toBe('1.0000000000');
      expect(lines[1]).toBe('0.0000000000');
      expect(lines[2]).toBe('0.0000000000');
      expect(lines[3]).toBe('-1.0000000000');
      expect(parseFloat(lines[4])).toBeCloseTo(486279.5, 4);
      expect(parseFloat(lines[5])).toBeCloseTo(5390512.5, 4);
    });
  });

  describe('buildDmr5WcsUrl', () => {
    it('builds WCS 2.0.1 GetCoverage URL with el__EL.GridCoverage and subsets', () => {
      const url = buildDmr5WcsUrl(486279, 486779, 5390013, 5390513);
      expect(url).toContain('service=WCS');
      expect(url).toContain('version=2.0.1');
      expect(url).toContain('coverageId=el__EL.GridCoverage');
      expect(url).toContain('subset=N%285390013%2C5390513%29');
      expect(url).toContain('subset=E(486279,486779)');
    });
  });

  describe('guessCaveCoordinates', () => {
    it('identifies coordinates from entrance station', () => {
      const mockCave = {
        stationLabels: [
          { name: '0', pos: { x: 0, y: 0, z: 0 }, gps: null },
          { name: 'Vchod', pos: { x: 10, y: 10, z: 0 }, isEntrance: true, gps: JASOV_GPS },
        ],
        centerOffset: { x: 0, y: 0, z: 0 },
      } as unknown as ParsedCave;

      const guess = guessCaveCoordinates(mockCave);
      expect(guess).not.toBeNull();
      expect(guess?.source).toBe('entrance_gps');
      expect(guess?.lat).toBe(JASOV_GPS.lat);
      expect(guess?.lon).toBe(JASOV_GPS.lon);
    });

    it('falls back to any station with GPS', () => {
      const mockCave = {
        stationLabels: [
          { name: '10', pos: { x: 100, y: 100, z: 0 }, gps: JASOV_GPS },
          { name: '0', pos: { x: 0, y: 0, z: 0 }, gps: null },
        ],
        centerOffset: { x: 0, y: 0, z: 0 },
      } as unknown as ParsedCave;

      const guess = guessCaveCoordinates(mockCave);
      expect(guess).not.toBeNull();
      expect(guess?.source).toBe('station_gps');
      expect(guess?.lat).toBe(JASOV_GPS.lat);
    });

    it('identifies coordinates from UTM center offset', () => {
      const mockCave = {
        stationLabels: [],
        centerOffset: { x: 486529, y: 5390263, z: 850 },
      } as unknown as ParsedCave;

      const guess = guessCaveCoordinates(mockCave);
      expect(guess).not.toBeNull();
      expect(guess?.source).toBe('center_offset_utm');
      expect(guess?.lat).toBeCloseTo(JASOV_GPS.lat, 2);
      expect(guess?.lon).toBeCloseTo(JASOV_GPS.lon, 2);
    });
  });
});
