import { describe, expect, it } from 'vitest';
import { getDefaultPointCloudSize, getPreferredEngineForFile } from '../modelDefaults';

describe('modelDefaults', () => {
  it('keeps mesh formats on the v1 wall renderer', () => {
    expect(getPreferredEngineForFile('.stl')).toBe('v1');
    expect(getPreferredEngineForFile('.lox')).toBe('v1');
    expect(getPreferredEngineForFile('.3d')).toBe('v1');
  });

  it('uses the NextGen engine only for PLY point clouds', () => {
    expect(getPreferredEngineForFile('.ply')).toBe('v2');
    expect(getPreferredEngineForFile('.PLY')).toBe('v2');
  });

  it('applies the compact point size only to large PLY files', () => {
    expect(getDefaultPointCloudSize('.ply', 60 * 1024 * 1024)).toBe(0.3);
    expect(getDefaultPointCloudSize('.ply', 10 * 1024 * 1024)).toBe(0.5);
    expect(getDefaultPointCloudSize('.stl', 100 * 1024 * 1024)).toBe(0.5);
  });
});
