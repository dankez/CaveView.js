import { describe, it, expect } from 'vitest';
import { PLYLoader } from '../plyLoader';

function makeBinaryPly(header: string, bodyLength: number, writeBody: (dv: DataView) => void) {
  const headerBytes = new TextEncoder().encode(header);
  const buffer = new ArrayBuffer(headerBytes.byteLength + bodyLength);
  new Uint8Array(buffer).set(headerBytes);
  writeBody(new DataView(buffer, headerBytes.byteLength));
  return buffer;
}

describe('PLYLoader', () => {
  it('should parse a simple binary little-endian header', () => {
    const header = "ply\nformat binary_little_endian 1.0\nelement vertex 10\nproperty float x\nproperty float y\nproperty float z\nend_header\n";
    const buffer = new TextEncoder().encode(header).buffer;
    const loader = new PLYLoader();
    const result = loader.parseHeader(buffer);
    expect(result.vertexCount).toBe(10);
    expect(result.format).toBe('binary_little_endian');
  });

  it('parses binary properties using their declared scalar types', () => {
    const header = [
      'ply',
      'format binary_little_endian 1.0',
      'element vertex 1',
      'property double x',
      'property double y',
      'property double z',
      'property ushort red',
      'property uchar green',
      'property float blue',
      'property ushort intensity',
      'end_header',
      ''
    ].join('\n');

    const buffer = makeBinaryPly(header, 33, dv => {
      dv.setFloat64(0, 1.5, true);
      dv.setFloat64(8, -2.25, true);
      dv.setFloat64(16, 3.75, true);
      dv.setUint16(24, 32768, true);
      dv.setUint8(26, 128);
      dv.setFloat32(27, 0.5, true);
      dv.setUint16(31, 65535, true);
    });

    const result = new PLYLoader().parse(buffer);

    expect(result.points[0]).toBeCloseTo(1.5);
    expect(result.points[1]).toBeCloseTo(-2.25);
    expect(result.points[2]).toBeCloseTo(3.75);
    expect(result.colors[0]).toBeCloseTo(32768 / 65535);
    expect(result.colors[1]).toBeCloseTo(128 / 255);
    expect(result.colors[2]).toBeCloseTo(0.5);
    expect(result.intensity[0]).toBeCloseTo(1);
  });
});
