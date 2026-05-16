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
        const type = parts[1];
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
    const intensity = new Float32Array(count);

    const propIdx = {
      x: header.properties.find(p => p.name === 'x'),
      y: header.properties.find(p => p.name === 'y'),
      z: header.properties.find(p => p.name === 'z'),
      r: header.properties.find(p => p.name === 'red' || p.name === 'r' || p.name === 'diffuse_red'),
      g: header.properties.find(p => p.name === 'green' || p.name === 'g' || p.name === 'diffuse_green'),
      b: header.properties.find(p => p.name === 'blue' || p.name === 'b' || p.name === 'diffuse_blue'),
      i: header.properties.find(p => p.name === 'intensity' || p.name === 'i' || p.name === 'scalar_Intensity'),
    };

    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      if (propIdx.x) points[i*3] = dv.getFloat32(offset + propIdx.x.offset, true);
      if (propIdx.y) points[i*3+1] = dv.getFloat32(offset + propIdx.y.offset, true);
      if (propIdx.z) points[i*3+2] = dv.getFloat32(offset + propIdx.z.offset, true);

      if (propIdx.r && propIdx.g && propIdx.b) {
        colors[i*3] = dv.getUint8(offset + propIdx.r.offset) / 255;
        colors[i*3+1] = dv.getUint8(offset + propIdx.g.offset) / 255;
        colors[i*3+2] = dv.getUint8(offset + propIdx.b.offset) / 255;
      } else {
        colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 1;
      }
      
      if (propIdx.i) {
        if (propIdx.i.type === 'float' || propIdx.i.type === 'float32') {
          intensity[i] = dv.getFloat32(offset + propIdx.i.offset, true);
        } else if (propIdx.i.type === 'uint8' || propIdx.i.type === 'uchar') {
          intensity[i] = dv.getUint8(offset + propIdx.i.offset) / 255;
        }
      }
    }

    return { points, colors, intensity, vertexCount: count };
  }
}
