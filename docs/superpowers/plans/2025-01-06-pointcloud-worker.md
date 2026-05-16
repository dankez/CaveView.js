# NextGen PointCloud Worker (LOD Streamer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-performance Web Worker that parses PLY files and indices them into a spatial Octree for LOD streaming.

**Architecture:** A dedicated binary PLY loader will extract point data into typed arrays. A spatial Octree will then index these points into hierarchical chunks, which are streamed back to the main thread via transferable objects to ensure zero-copy performance.

**Tech Stack:** TypeScript, Web Workers, ArrayBuffer, DataView, Three.js (for types).

---

### Task 1: Binary PLY Loader

**Files:**
- Create: `src/v2/parsers/plyLoader.ts`
- Test: `src/v2/parsers/__tests__/plyLoader.test.ts`

- [ ] **Step 1: Write a basic test for PLY header parsing**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/v2/parsers/__tests__/plyLoader.test.ts`
Expected: FAIL (PLYLoader not defined)

- [ ] **Step 3: Implement PLYLoader header parsing**

```typescript
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
          headerEnd = i + chunk.indexOf('\n') + 1;
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

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'format') format = parts[1];
      if (parts[0] === 'element' && parts[1] === 'vertex') vertexCount = parseInt(parts[2]);
      if (parts[0] === 'property') {
        const type = parts[1];
        const name = parts[2];
        const size = this.typeSizes[type] || 4;
        properties.push({ name, type, size, offset: currentStride });
        currentStride += size;
      }
    }

    return { format, vertexCount, properties, headerEnd, stride: currentStride };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/v2/parsers/__tests__/plyLoader.test.ts`
Expected: PASS

- [ ] **Step 5: Implement data parsing in PLYLoader**

Add `parse(buffer: ArrayBuffer)` method that returns an object with attribute buffers.

```typescript
export class PLYLoader {
  // ... existing code ...

  parse(buffer: ArrayBuffer) {
    const header = this.parseHeader(buffer);
    if (header.format !== 'binary_little_endian') throw new Error('Unsupported format');

    const dv = new DataView(buffer, header.headerEnd);
    const count = header.vertexCount;
    const stride = header.stride;

    const points = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const intensity = new Float32Array(count);

    const pIdx = {
      x: header.properties.find(p => p.name === 'x'),
      y: header.properties.find(p => p.name === 'y'),
      z: header.properties.find(p => p.name === 'z'),
      r: header.properties.find(p => p.name === 'red' || p.name === 'r'),
      g: header.properties.find(p => p.name === 'green' || p.name === 'g'),
      b: header.properties.find(p => p.name === 'blue' || p.name === 'b'),
      i: header.properties.find(p => p.name === 'intensity' || p.name === 'i'),
    };

    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      if (pIdx.x) points[i*3] = dv.getFloat32(offset + pIdx.x.offset, true);
      if (pIdx.y) points[i*3+1] = dv.getFloat32(offset + pIdx.y.offset, true);
      if (pIdx.z) points[i*3+2] = dv.getFloat32(offset + pIdx.z.offset, true);

      if (pIdx.r && pIdx.g && pIdx.b) {
        colors[i*3] = dv.getUint8(offset + pIdx.r.offset) / 255;
        colors[i*3+1] = dv.getUint8(offset + pIdx.g.offset) / 255;
        colors[i*3+2] = dv.getUint8(offset + pIdx.b.offset) / 255;
      }
      if (pIdx.i) intensity[i] = dv.getFloat32(offset + pIdx.i.offset, true);
    }

    return { points, colors, intensity, vertexCount: count };
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/v2/parsers/plyLoader.ts src/v2/parsers/__tests__/plyLoader.test.ts
git commit -m "feat(v2): implement binary PLY loader"
```

---

### Task 2: Spatial Octree & Worker

**Files:**
- Create: `src/v2/parsers/pointcloud.worker.ts`

- [ ] **Step 1: Define Octree Node structure**

```typescript
export interface Bounds {
  min: { x: number, y: number, z: number };
  max: { x: number, y: number, z: number };
}

export class OctreeNode {
  isLeaf: boolean = true;
  children: OctreeNode[] | null = null;
  pointIndices: number[] = [];

  constructor(public bounds: Bounds, public depth: number = 0) {}
}
```

- [ ] **Step 2: Implement Octree building logic**

In `pointcloud.worker.ts`, implement a function to insert points into the tree.

- [ ] **Step 3: Implement streaming mechanism**

Use `self.postMessage` to send node data as it's finalized.

- [ ] **Step 4: Commit**

```bash
git add src/v2/parsers/pointcloud.worker.ts
git commit -m "feat(v2): implement spatial octree indexing in worker"
```

---

### Task 3: Integration & Performance Tuning

- [ ] **Step 1: Add transferable support**
- [ ] **Step 2: Finalize worker protocol**
- [ ] **Step 3: Commit**

```bash
git add src/v2/parsers/
git commit -m "feat(v2): finalize streaming PLY worker with octree indexing"
```
