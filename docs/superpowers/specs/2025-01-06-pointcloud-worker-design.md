# Design Spec: NextGen PointCloud Worker (LOD Streamer)

## Overview
Implement a high-performance system for loading and indexing large LiDAR point clouds (PLY format) in CaveView 2.x. The system uses a Web Worker to avoid blocking the main thread and implements an Octree for spatial indexing and Level of Detail (LOD) streaming.

## Goals
- Efficiently parse large binary little-endian PLY files.
- Index points into a spatial Octree for fast spatial queries and LOD.
- Stream chunks of points to the main thread using transferables.
- Handle metadata like colors, normals, and intensity.

## Architecture

### 1. PLY Loader (`src/v2/parsers/plyLoader.ts`)
A utility class/set of functions to parse PLY files.
- **Binary Support:** Only `binary_little_endian` is required for now.
- **Header Parsing:** Robustly parse properties (x, y, z, red, green, blue, nx, ny, nz, intensity).
- **Data Access:** Use `DataView` for header and offset management, but prefer `Float32Array` views for vertex data if alignment allows.

### 2. PointCloud Worker (`src/v2/parsers/pointcloud.worker.ts`)
The orchestrator running in a Web Worker.
- **Input:** Receives an `ArrayBuffer` or a `Blob` URL.
- **Processing Flow:**
  1. Parse PLY header to get count and attributes.
  2. Compute/read bounding box.
  3. Initialize Octree with bounds.
  4. Iterate through points and insert into Octree nodes.
  5. Once a node is full (e.g., 50,000 points), or indexing is complete, serialize and send to main thread.

### 3. Octree Implementation
- **Node Structure:**
  - `bounds`: { min: Vec3, max: Vec3 }
  - `points`: `Float32Array` (x, y, z, ...)
  - `colors`: `Float32Array` (optional)
  - `children`: OctreeNode[] | null
  - `isLeaf`: boolean
- **Splitting Logic:** If `node.pointCount > MAX_POINTS_PER_NODE`, split into 8 sub-regions.

### 4. Streaming Protocol
- **Message Type:** `POINTCLOUD_CHUNK`
- **Payload:**
  - `id`: Unique node ID (path in tree).
  - `bounds`: Node bounding box.
  - `buffer`: `ArrayBuffer` containing point data.
  - `attributeMap`: Map of attribute offsets in the buffer.
- **Optimization:** Use `self.postMessage(payload, [payload.buffer])` to transfer ownership.

## Error Handling
- Invalid PLY format detection.
- Memory limit awareness (though Octree helps by chunking).
- Worker termination handling.

## Testing Strategy
- Unit tests for `plyLoader` with sample PLY buffers.
- Integration test for worker (mocking `postMessage`).
- Verification with large files (e.g., Erna.ply).
