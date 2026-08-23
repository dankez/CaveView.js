import { describe, it, expect, beforeEach } from 'vitest';
import { getSplayCacheKey, getCachedSplayGeometry, setCachedSplayGeometry, clearSplayCache } from '../splayCache';

describe('splayCache session caching', () => {
  beforeEach(() => {
    clearSplayCache();
  });

  it('generates consistent cache keys based on parameters', () => {
    const key1 = getSplayCacheKey('cave_zlomiskovo', 250, 0.22, 0.06, 0.10, 0.0);
    const key2 = getSplayCacheKey('cave_zlomiskovo', 250, 0.22, 0.06, 0.10, 0.0);
    const keyDiff = getSplayCacheKey('cave_zlomiskovo', 250, 0.30, 0.06, 0.10, 0.0);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDiff);
  });

  it('stores and retrieves cached geometry data across renders', () => {
    const key = getSplayCacheKey('model1', 100, 0.25, 0.08, 0.12);
    expect(getCachedSplayGeometry(key)).toBeUndefined();

    const mockGeo = {
      positions: new Float32Array([1, 2, 3, 4, 5, 6]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 2,
      triangleCount: 1,
    };

    setCachedSplayGeometry(key, mockGeo);
    const cached = getCachedSplayGeometry(key);

    expect(cached).toBeDefined();
    expect(cached?.vertexCount).toBe(2);
    expect(cached?.triangleCount).toBe(1);
    expect(cached?.positions.length).toBe(6);
  });
});
