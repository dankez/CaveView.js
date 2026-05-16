import { describe, it, expect } from 'vitest';
import { PLYLoader } from '../plyLoader';

describe('PLYLoader', () => {
  it('should parse a simple binary little-endian header', () => {
    const header = "ply\nformat binary_little_endian 1.0\nelement vertex 10\nproperty float x\nproperty float y\nproperty float z\nend_header\n";
    const buffer = new TextEncoder().encode(header).buffer;
    const loader = new PLYLoader();
    const result = loader.parseHeader(buffer);
    expect(result.vertexCount).toBe(10);
    expect(result.format).toBe('binary_little_endian');
  });
});
