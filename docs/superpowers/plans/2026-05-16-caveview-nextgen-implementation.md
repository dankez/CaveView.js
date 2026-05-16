# CaveView 2.x NextGen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-performance Point-Cloud LOD engine for massive LiDAR data (e.g., model Erna) while maintaining 100% feature parity with version 1.x.

**Architecture:** Split the codebase into `src/v1` (legacy/modernized) and `src/v2` (nextgen). Introduce a streaming Web Worker that indices PLY data into an Octree and a shader-based Eye-Dome Lighting (EDL) renderer for depth perception.

**Tech Stack:** React 18, Three.js 0.164, @react-three/fiber, three-mesh-bvh, three-geo (Mapbox), Web Workers.

---

### Task 1: Codebase Reorganization (Engine Isolation)

**Files:**
- Create: `src/v1/`, `src/v2/`, `src/shared/`
- Modify: `src/App.tsx`, `package.json`, `tsconfig.json`

- [ ] **Step 1: Create new directory structure**
Run: `mkdir -p src/v1/components src/v1/parsers src/v2/components src/v2/parsers src/v2/shaders src/shared/components src/shared/utils src/shared/types`

- [ ] **Step 2: Move files to shared/ and v1/**
Run:
```bash
mv src/components/CalibrationModal.tsx src/shared/components/
mv src/components/CaveViewer3D.tsx src/v1/components/
mv src/parsers/ src/v1/
mv src/utils/ src/shared/
mv src/types/ src/shared/
mv src/core/ src/shared/
mv src/i18n/ src/shared/
```

- [ ] **Step 3: Update tsconfig.json with path aliases**
Add aliases for `@shared`, `@v1`, and `@v2` to simplify imports.

- [ ] **Step 4: Update imports in App.tsx**
Verify that the application still builds using the legacy engine now located in `src/v1`.

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "refactor: isolate v1 engine and prepare shared/v2 structure"
```

---

### Task 2: NextGen PointCloud Worker (LOD Streamer)

**Files:**
- Create: `src/v2/parsers/pointcloud.worker.ts`
- Create: `src/v2/parsers/plyLoader.ts`

- [ ] **Step 1: Implement Binary PLY Parser**
Create a specialized parser that reads `Erna.ply` (binary little endian) efficiently using `DataView`.

- [ ] **Step 2: Implement Spatial Octree Indexing**
In the worker, divide points into spatial chunks (nodes). Each node will contain a subset of points and a bounding box.

- [ ] **Step 3: Implement Streaming Protocol**
The worker should "emit" chunks of points as they are indexed so the UI can start rendering immediately.

- [ ] **Step 4: Commit**
```bash
git add src/v2/parsers/
git commit -m "feat(v2): implement streaming PLY worker with octree indexing"
```

---

### Task 3: NextGen Rendering Engine (EDL & Shaders)

**Files:**
- Create: `src/v2/shaders/pointcloud.vert`, `src/v2/shaders/pointcloud.frag`
- Create: `src/v2/components/PointCloudLOD.tsx`
- Create: `src/v2/components/EDLPass.tsx`

- [ ] **Step 1: Write Eye-Dome Lighting (EDL) Shader**
Implement the depth-based shading algorithm to highlight edges and cracks in the point cloud.

- [ ] **Step 2: Implement Point Size Attenuation**
Create a vertex shader that scales point size based on distance from camera to create a "solid surface" feel.

- [ ] **Step 3: Build PointCloudLOD Component**
A React component that subscribes to the worker, manages GPU buffers (InstancedBufferGeometry), and updates visible chunks based on the camera frustum.

- [ ] **Step 4: Commit**
```bash
git add src/v2/components/ src/v2/shaders/
git commit -m "feat(v2): add EDL shader and LOD rendering component"
```

---

### Task 4: Feature Parity (Clipping & Calibration)

**Files:**
- Create: `src/v2/components/CaveViewerNextGen.tsx`
- Modify: `src/shared/components/CalibrationModal.tsx`

- [ ] **Step 1: Implement GPU Clipping in V2**
Inject clipping plane uniforms into the PointCloud shader to support the existing "Rezy" (Rezy jaskyňou) functionality.

- [ ] **Step 2: Connect Shared UI to V2**
Ensure the current controls (rotation, measurement, visibility toggles) control the V2 engine state.

- [ ] **Step 3: Commit**
```bash
git add src/v2/ src/shared/
git commit -m "feat(v2): achieve feature parity with clipping and controls"
```

---

### Task 5: Mapbox Terrain Integration (three-geo)

**Files:**
- Modify: `package.json`
- Create: `src/v2/components/MapboxTerrain.tsx`

- [ ] **Step 1: Add three-geo dependency**
Run: `npm install three-geo`

- [ ] **Step 2: Implement MapboxTerrain Component**
A component that takes GPS coordinates (from calibration) and uses `three-geo` to fetch and render the 3D surface.

- [ ] **Step 3: Implement Hybrid X-Ray Mode**
Add a transparency toggle to the Mapbox terrain to see the jaskyňa model underneath.

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "feat(v2): integrate Mapbox terrain using three-geo"
```

---

### Task 6: Final Integration & Erna Benchmark

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement Engine Switcher**
In `App.tsx`, add logic to detect if a file is a heavy LiDAR (PLY > 50MB) and automatically switch to V2, or allow manual toggle.

- [ ] **Step 2: Performance Tuning**
Run the "Erna" model and verify 60 FPS performance. Adjust Octree depth and chunk sizes if needed.

- [ ] **Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat: finalize NextGen engine integration and benchmarking"
```
