# 🛠️ LochViewer - Developer & Mathematical Specification (v2.4.15)

*Comprehensive technical architecture, mathematical formulations, shader models, and Web Worker data flows for developers and contributors.*

---

## 📑 Table of Contents
1. [System Architecture & Dual-Engine Architecture](#1-system-architecture--dual-engine-architecture)
2. [Mathematical Formulations & Geodesy](#2-mathematical-formulations--geodesy)
3. [Volumetric Reconstruction & Signed Distance Fields (Splay SDF)](#3-volumetric-reconstruction--signed-distance-fields-splay-sdf)
4. [Structural Geology & Tectonics Formulation (Dip & Strike)](#4-structural-geology--tectonics-formulation-dip--strike)
5. [Camera Projections & Auto Zoom-to-Fit Algorithm](#5-camera-projections--auto-zoom-to-fit-algorithm)
6. [Post-Processing Shaders (Eye-Dome Lighting & SSAO)](#6-post-processing-shaders-eye-dome-lighting--ssao)
7. [Parallel Web Workers & Zero-Copy Transferable Objects](#7-parallel-web-workers--zero-copy-transferable-objects)
8. [URL Serialization Schema & State Hydration](#8-url-serialization-schema--state-hydration)

---

## 1. System Architecture & Dual-Engine Architecture

LochViewer is built upon **React 18**, **Three.js**, and **React-Three-Fiber**, implementing a specialized **Dual-Engine** pipeline:

```
                          ┌─────────────────────────────┐
                          │     Input File / URL        │
                          │ (.lox, .ply, .3d, .plt, STL)│
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │     parser.worker.ts        │
                          │   (Parallel Web Worker)     │
                          └──────────────┬──────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
         ┌─────────────────────────────┐   ┌─────────────────────────────┐
         │     ENGINE v1 (Standard)    │   │     ENGINE v2 (NextGen)     │
         │  src/v1/CaveViewer3D.tsx    │   │ src/v2/CaveViewerNextGen.tsx│
         ├─────────────────────────────┤   ├─────────────────────────────┤
         │ • LOX, 3D, PLT, STL meshes  │   │ • Massive PLY Point Clouds  │
         │ • Therion Scraps polygons   │   │ • Octree LOD partitioning   │
         │ • Splay SDF Marching Cubes  │   │ • WebGL EDL & point shaders │
         │ • Three.js Mesh pipeline    │   │ • 60 FPS for > 10M points   │
         └──────────────┬──────────────┘   └──────────────┬──────────────┘
                        │                                 │
                        └────────────────┬────────────────┘
                                         ▼
                          ┌─────────────────────────────┐
                          │   Shared UI & Analysis HUD  │
                          │  (Measurement, Clips, HUD)  │
                          └─────────────────────────────┘
```

---

## 2. Mathematical Formulations & Geodesy

### 2.1 Floating-Point Jitter Elimination (Centroid Subtraction)
Cartographic coordinate reference systems (e.g., S-JTSK) use large coordinates ($X \approx -500,000\ \text{m}$, $Y \approx -1,200,000\ \text{m}$). Standard GPUs calculate in 32-bit floating point numbers (`float32`), with only 24 bits of mantissa precision (~7 decimal digits). Passing global coordinates directly to WebGL vertex shaders results in visual polygon tearing and vertex jittering.

**Solution**:
The parsing worker computes the model centroid $P_{\text{offset}} = (x_0, y_0, z_0)$ in 64-bit precision (`float64`). Vertices are transformed into local origin space prior to GPU buffer upload:
$$P_{\text{local}} = P_{\text{world}} - P_{\text{offset}}$$
Global coordinates are only reconstructed for display within UI cards and measurement readouts.

### 2.2 Coordinate Transformations: S-JTSK (EPSG:5514) $\leftrightarrow$ WGS-84 (EPSG:4326) $\leftrightarrow$ UTM
Projection transformations utilize `proj4` configured with Křovák's oblique conformal conic projection parameters:
```ts
const S_JTSK = "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";
```

---

## 3. Volumetric Reconstruction & Signed Distance Fields (Splay SDF)

Modules `splayWall.worker.ts` and `splayMath.ts` evaluate raw laser splay rays into volumetric Signed Distance Fields (SDF), extracting an isosurface via **Marching Cubes**.

### 3.1 3D Segment Distance (Capsule SDF)
For arbitrary point $P \in \mathbb{R}^3$ and splay ray segment from station $A$ to splay endpoint $B$:
$$h = \text{clamp}\left(\frac{(P - A) \cdot (B - A)}{\|B - A\|^2},\ 0,\ 1\right)$$
Distance to the capsule boundary is:
$$d(P, A, B, r) = \|P - (A + h(B - A))\| - r$$
where $r$ is the virtual capsule radius (`splayCapsuleRadius`).

### 3.2 Smooth Minimum Blending (Polynomial Smooth-Min)
Distance fields are accumulated using continuous polynomial smooth minimum blending with factor $k = \text{splaySmoothK}$:
$$h = \max(k - |d_1 - d_2|,\ 0) / k$$
$$\text{smin}(d_1, d_2, k) = \min(d_1, d_2) - \frac{h^2 \cdot k}{4}$$

### 3.3 Bisector Normal Plane
To avoid ray collisions between adjacent survey stations $A$ and $B$, a bisector plane is erected at midpoint $M = \frac{A + B}{2}$ with normal vector $\vec{u} = \frac{B - A}{\|B - A\|}$. Splay points from station $A$ are rejected if $\vec{u} \cdot (P - M) > 0$.

---

## 4. Structural Geology & Tectonics Formulation (Dip & Strike)

The module `src/shared/utils/tectonics.ts` computes planar orientation from 3 chosen points $P_1, P_2, P_3 \in \mathbb{R}^3$:

### 4.1 Surface Normal Vector
$$\vec{v}_1 = P_2 - P_1,\quad \vec{v}_2 = P_3 - P_1$$
$$\vec{N} = \vec{v}_1 \times \vec{v}_2 = (N_x, N_y, N_z)$$
Unit normal:
$$\vec{n} = \frac{\vec{N}}{\|\vec{N}\|}$$
Oriented upward such that $n_z \ge 0$. If $n_z < 0$, invert $\vec{n} \leftarrow -\vec{n}$.

### 4.2 True Dip Angle ($\theta$)
$$\theta = \arccos(|n_z|) \times \frac{180^\circ}{\pi}$$

### 4.3 Dip Direction ($\alpha$)
$$\alpha = \left(\text{atan2}(n_x,\ n_y) \times \frac{180^\circ}{\pi} + 360^\circ\right) \bmod 360^\circ$$

### 4.4 Strike Direction ($\beta$)
$$\beta = (\alpha + 90^\circ) \bmod 360^\circ$$

---

## 5. Camera Projections & Auto Zoom-to-Fit Algorithm

Implemented in `ProjectionController.tsx`, `calculateFitParams` computes optimal camera distance or frustum size to fill ~85% of the viewport:

### 5.1 Perspective Camera
For bounding sphere with radius $R$ and vertical field of view $\text{FOV}$:
$$d_{\text{target}} = \frac{R}{\sin(\text{FOV} / 2)} \times 1.15$$

### 5.2 Orthographic Camera
Calculated against canvas dimensions $W, H$:
$$\text{zoom}_{\text{ortho}} = \frac{\min(W, H)}{2 \cdot R \cdot 1.15}$$

---

## 6. Post-Processing Shaders (Eye-Dome Lighting & SSAO)

### 6.1 Eye-Dome Lighting (EDL) Formulation
EDL computes depth disparity $F(u, v)$ over 4 cross neighbors at offset distance $d$:
$$F(u, v) = \sum_{i=1}^4 \max\left(0,\ \ln(z(u, v)) - \ln(z(u + \delta x_i,\ v + \delta y_i))\right)$$
Shaded output intensity:
$$I = I_0 \cdot \exp(-F(u, v) \cdot k_{\text{exp}})$$
where $k_{\text{exp}}$ represents the user-controlled plasticity exponent.

---

## 7. Parallel Web Workers & Zero-Copy Transferable Objects

* `parser.worker.ts`: Binary format decoders for `.lox`, `.ply`, `.stl`.
* `pointcloud.worker.ts`: Octree spatial tree building and streaming LOD queues.
* `splayWall.worker.ts`: Volumetric SDF marching cubes calculation.
* `lidarPlanMap.worker.ts`: High-resolution 2D plan map rasterization.

Memory transfers bypass JSON serialization via `ArrayBuffer` transfer lists:
```ts
self.postMessage({
  type: 'SPLAY_WALL_READY',
  positions: positionsArray.buffer,
  normals: normalsArray.buffer,
  colors: colorsArray.buffer
}, [positionsArray.buffer, normalsArray.buffer, colorsArray.buffer]);
```

---

## 8. URL Serialization Schema & State Hydration

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `model` | `string` | URL to 3D survey or LiDAR dataset. |
| `embed` | `boolean` (`1`/`0`) | Enables clean iframe embed mode. |
| `proj` | `orthographic` / `perspective` | Camera projection mode. |
| `theme` | `precision` / `dark` / `light` | Visual theme and material coloring. |
| `sdf` | `boolean` (`1`/`0`) | Enables Splay SDF 3D walls. |
| `smin` | `number` | SDF smooth minimum blend radius. |
| `srad` | `number` | Splay capsule thickness radius. |
| `scraps` | `boolean` (`1`/`0`) | Toggles Therion scrap wall meshes. |
| `terrain` | `none` / `shaded` / `satellite` | Surface terrain rendering mode. |
| `alt` | `abs` / `rel` | Elevation reference system. |
| `clip` | `number` | Z-clipping cutting plane elevation. |

---
*LochViewer Developer Team — Documentation is automatically maintained with every codebase change.*
