export interface PLYProperty {
  name: string;
  type: string;
  size: number;
  offset: number;
}

export interface PLYHeader {
  format: string;
  vertexCount: number;
  properties: PLYProperty[];
  headerEnd: number;
  stride: number;
}

export class PLYLoader {
  private typeSizes: Record<string, number> = {
    'char': 1, 'uchar': 1, 'short': 2, 'ushort': 2, 'int': 4, 'uint': 4, 'float': 4, 'double': 8,
    'int8': 1, 'uint8': 1, 'int16': 2, 'uint16': 2, 'int32': 4, 'uint32': 4, 'float32': 4, 'float64': 8
  };

  private readScalar(dv: DataView, offset: number, type: string): number {
    switch (type.toLowerCase()) {
      case 'char':
      case 'int8':
        return dv.getInt8(offset);
      case 'uchar':
      case 'uint8':
        return dv.getUint8(offset);
      case 'short':
      case 'int16':
        return dv.getInt16(offset, true);
      case 'ushort':
      case 'uint16':
        return dv.getUint16(offset, true);
      case 'int':
      case 'int32':
        return dv.getInt32(offset, true);
      case 'uint':
      case 'uint32':
        return dv.getUint32(offset, true);
      case 'double':
      case 'float64':
        return dv.getFloat64(offset, true);
      case 'float':
      case 'float32':
      default:
        return dv.getFloat32(offset, true);
    }
  }

  private normalizeColor(value: number, type: string): number {
    switch (type.toLowerCase()) {
      case 'uchar':
      case 'uint8':
        return value / 255;
      case 'char':
      case 'int8':
        return Math.max(0, value) / 127;
      case 'ushort':
      case 'uint16':
        return value / 65535;
      case 'short':
      case 'int16':
        return Math.max(0, value) / 32767;
      case 'uint':
      case 'uint32':
        return value / 4294967295;
      case 'int':
      case 'int32':
        return Math.max(0, value) / 2147483647;
      case 'double':
      case 'float64':
      case 'float':
      case 'float32':
      default:
        return value > 1 ? value / 255 : value;
    }
  }

  private normalizeIntensity(value: number, type: string): number {
    switch (type.toLowerCase()) {
      case 'uchar':
      case 'uint8':
        return value / 255;
      case 'ushort':
      case 'uint16':
        return value / 65535;
      default:
        return value;
    }
  }

  parseHeader(buffer: ArrayBuffer): PLYHeader {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();
    let headerText = '';
    let headerEnd = -1;

    for (let i = 0; i < Math.min(bytes.length, 16384); i++) {
      if (bytes[i] === 101 && bytes[i+1] === 110 && bytes[i+2] === 100) { // "end"
        const chunk = decoder.decode(bytes.subarray(i, i + 20));
        if (chunk.startsWith('end_header')) {
          const newlineIndex = chunk.indexOf('\n');
          headerEnd = i + newlineIndex + 1;
          headerText = decoder.decode(bytes.subarray(0, headerEnd));
          break;
        }
      }
    }

    if (headerEnd === -1) throw new Error('Invalid PLY: Missing end_header');

    const lines = headerText.split(/\r?\n/);
    let vertexCount = 0;
    let format = '';
    const properties: PLYProperty[] = [];
    let currentStride = 0;
    let currentElement = '';

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'format') format = parts[1];
      if (parts[0] === 'element') {
        currentElement = parts[1];
        if (parts[1] === 'vertex') vertexCount = parseInt(parts[2]);
      }
      if (parts[0] === 'property' && currentElement === 'vertex') {
        const type = parts[1].toLowerCase();
        const name = parts[2];
        const size = this.typeSizes[type] || 4;
        properties.push({ name, type, size, offset: currentStride });
        currentStride += size;
      }
    }

    return { format, vertexCount, properties, headerEnd, stride: currentStride };
  }

  parse(buffer: ArrayBuffer) {
    const header = this.parseHeader(buffer);
    if (header.format !== 'binary_little_endian') throw new Error('Unsupported format');

    const dv = new DataView(buffer, header.headerEnd);
    const count = header.vertexCount;
    const stride = header.stride;

    const points = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const intensity = new Float32Array(count);

    const propIdx = {
      x: header.properties.find(p => p.name.toLowerCase() === 'x'),
      y: header.properties.find(p => p.name.toLowerCase() === 'y'),
      z: header.properties.find(p => p.name.toLowerCase() === 'z'),
      r: header.properties.find(p => ['red', 'r', 'diffuse_red'].includes(p.name.toLowerCase())),
      g: header.properties.find(p => ['green', 'g', 'diffuse_green'].includes(p.name.toLowerCase())),
      b: header.properties.find(p => ['blue', 'b', 'diffuse_blue'].includes(p.name.toLowerCase())),
      nx: header.properties.find(p => ['nx', 'normal_x', 'n_x'].includes(p.name.toLowerCase())),
      ny: header.properties.find(p => ['ny', 'normal_y', 'n_y'].includes(p.name.toLowerCase())),
      nz: header.properties.find(p => ['nz', 'normal_z', 'n_z'].includes(p.name.toLowerCase())),
      i: header.properties.find(p => ['intensity', 'i', 'scalar_intensity', 'value'].includes(p.name.toLowerCase())),
    };

    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      if (propIdx.x) points[i*3] = this.readScalar(dv, offset + propIdx.x.offset, propIdx.x.type);
      if (propIdx.y) points[i*3+1] = this.readScalar(dv, offset + propIdx.y.offset, propIdx.y.type);
      if (propIdx.z) points[i*3+2] = this.readScalar(dv, offset + propIdx.z.offset, propIdx.z.type);

      if (propIdx.r && propIdx.g && propIdx.b) {
        colors[i*3] = this.normalizeColor(this.readScalar(dv, offset + propIdx.r.offset, propIdx.r.type), propIdx.r.type);
        colors[i*3+1] = this.normalizeColor(this.readScalar(dv, offset + propIdx.g.offset, propIdx.g.type), propIdx.g.type);
        colors[i*3+2] = this.normalizeColor(this.readScalar(dv, offset + propIdx.b.offset, propIdx.b.type), propIdx.b.type);
      } else {
        colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 1;
      }

      if (propIdx.nx) normals[i*3] = this.readScalar(dv, offset + propIdx.nx.offset, propIdx.nx.type);
      if (propIdx.ny) normals[i*3+1] = this.readScalar(dv, offset + propIdx.ny.offset, propIdx.ny.type);
      if (propIdx.nz) normals[i*3+2] = this.readScalar(dv, offset + propIdx.nz.offset, propIdx.nz.type);
      
      if (propIdx.i) {
        intensity[i] = this.normalizeIntensity(this.readScalar(dv, offset + propIdx.i.offset, propIdx.i.type), propIdx.i.type);
      }
    }

    return { points, colors, normals, intensity, vertexCount: count };
  }
}
