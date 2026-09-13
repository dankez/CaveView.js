# 📖 LochViewer - Complete User Guide (v2.4.25)

*Web-based 3D platform for speleological visualization, survey measurement, and spatial analysis of cave systems & LiDAR point clouds.*  
*Design System: Stitch CAD Precision Glassmorphism & Fieldwork High-Contrast (including gentle sand vertical gradient in light mode).*  
*Official Portal: [loch.sss.sk](https://loch.sss.sk)*

---

## 📑 Table of Contents
1. [Supported Formats & Data Loading](#1-supported-formats--data-loading)
2. [User Interface (Top Bar, Tool Controls & Visual Themes)](#2-user-interface-top-bar-tool-controls--visual-themes)
3. [Spatial Navigation & Technical View Presets](#3-spatial-navigation--technical-view-presets)
4. [3D Cave Wall Reconstruction from Laser Splays (Splay SDF)](#4-3d-cave-wall-reconstruction-from-laser-splays-splay-sdf)
5. [Survey Measurement, Polygon Area & Structural Geology (Tectonics)](#5-survey-measurement-polygon-area--structural-geology-tectonics)
6. [Spatial Slicing & Profile Analysis (Z-Clipping)](#6-spatial-slicing--profile-analysis-z-clipping)
7. [LiDAR Point Cloud Processing (Engine v2 NextGen)](#7-lidar-point-cloud-processing-engine-v2-nextgen)
8. [Surface Terrain, Official GKÚ ZBGIS WMS & 3D Calibration](#8-surface-terrain-official-gkú-zbgis-wms--3d-calibration)
9. [Sharing Models & Iframe Embedding](#9-sharing-models--iframe-embedding)
10. [In-App Interactive Guide (Help Modal)](#10-in-app-interactive-guide-help-modal)
11. [Keyboard Shortcuts & Navigation Gestures](#11-keyboard-shortcuts--navigation-gestures)

---

## 1. Supported Formats & Data Loading

LochViewer executes 100% inside your web browser using WebGL and parallel Web Workers. Your data is processed locally without being uploaded to third-party servers, guaranteeing maximum privacy and performance.

![LochViewer Welcome Screen](images/01_welcome_screen.png)

### Supported File Formats:
* **`.lox` (Therion / Loch)**: Core cave survey standard containing 3D centerline traverses, stations, laser splays, hand-drawn scrap walls, DTM terrain surfaces, and georeferenced texture maps.
* **`.3d` (Survex)**: Universal format from Survex software containing underground and surface polygon traverses.
* **`.plt` (Compass)**: Compass cave survey format containing station shots and polygon loops.
* **`.ply` (LiDAR Point Cloud)**: Binary and ASCII point clouds supporting millions of vertices, RGB true colors, intensity reflectance, and classification attributes.
* **`.stl` (3D Mesh)**: High-resolution triangulated meshes generated via 3D scanning or photogrammetry.
* **`.tif / .tiff` (GeoTIFF) + `.tfw`**: Digital Elevation Models (DMR) and orthophotos georeferenced in S-JTSK Křovák or UTM projection.

### Ways to Load Models:
1. **Drag & Drop**: Simply drag and drop any supported file directly into the browser window.
2. **Open File Button**: Click **"Select 3D file"** on the welcome screen.
3. **URL Parameter**: Directly load public cloud or server models using `?model=https://...` (e.g., Google Drive or custom server).

---

## 2. User Interface (Top Bar & Tool Controls)

Once a model is loaded, the top bar provides instant access to essential tools:

![Main 3D Viewport & Clean Topbar](images/02_main_viewer_3d.png)

| Icon | Tool Name | Description |
| :--- | :--- | :--- |
| 📷 | **Export Image (PNG)** | Captures a high-resolution screenshot with the active compass rose, scale bar, and elevation legend. |
| 🧊 / 📐 | **Camera Projection (O)** | Toggles between **Perspective** (natural 3D depth) and **Orthographic** (true-scale axonometry without distance distortion). |
| ⛶ | **Fit to Screen** | Smoothly centers and zooms the viewport to encompass the entire cave system. |
| 📈 | **Centerline** | Toggles survey traverse line network and station nodes. |
| 🪨 | **Cave Walls** | Toggles 3D cave wall meshes (Therion scraps, Splay SDF model, STL mesh). |
| 🏔️ | **Surface Terrain** | Toggles overhead surface elevation model, hillshade, or aerial orthophoto. |
| 🔲 | **Bounding Box** | Toggles the 3D bounding box showing spatial dimensions ($X, Y, Z$) and total cave vertical relief. |
| ✂️ | **Horizontal Z-Slice** | Opens the floating vertical clipping slider to slice through horizontal cave levels. |
| ⚡ | **Laser Splays** | Toggles visibility of laser survey measurement rays fired from stations to passage walls. |
| 📏 / 📐 | **Measurement Tool** | 3-State cycling button: **Disabled** ➡️ **Distance (2 points)** ➡️ **Area / Polygon (3+ points)**. |
| 🎨 | **Color Palette** | Switches between elevation hypsometry, monochrome rock material, and gradients. |
| 📊 | **Altitude Mode (ABS / REL)** | Switches between absolute altitude above sea level ($m\ \text{a.s.l.}$) and relative elevation from the entrance ($+120\ \text{m},\ -35\ \text{m}$). |
| ❓ | **User Guide / Help** | Opens this comprehensive interactive user guide inside the application. |
| 🔗 | **Share** | Generates persistent shareable URLs and embeddable `<iframe>` HTML snippets. |
| ✖ | **Close Model** | Releases GPU/CPU memory and returns to the initial welcome screen. |

### Visual Themes & Design Styling:
In the sidebar (**Cave** tab) or via the URL parameter `?theme=`, three calibrated themes can be toggled:
* **Precision CAD (`precision`)**: Default technical dark mode featuring a calibrated vertical blue gradient (deep night blue `#103258` at the top transitioning to a luminous technical blue `#1d5b9b` at the bottom) with high-contrast electric cyan (`#00d2ff`) / emerald (`#10b981`) accents synthesized from Google Stitch CAD specifications. Provides superior spatial depth and exceptional contrast for survey centerlines.
* **Light Sand (`light`)**: Natural high-contrast outdoor mode featuring an eye-friendly vertical sandy gradient – light ivory sand at the top (`#f7f3eb`) transitioning smoothly into darker warm limestone sand at the bottom (`#d5c4ad`). Sidebar cards, metrics, and sliders harmonize with this warm sand tone, providing superb legibility and zero glare during daytime fieldwork.
* **Classic Speleo (`classic`)**: Traditional nocturnal deep blue theme with indigo background gradient.
* **Sidebar Hiding & Reopening:** The sidebar can be collapsed anytime for full-screen 3D exploration. It can be reopened using the top bar control or the floating `◀ Settings` tab docked on the right screen edge.

---

## 3. Spatial Navigation & Technical View Presets

![Orthographic Plan View & Compass](images/03_orthographic_plan_view.png)

### Mouse Controls:
* **Left Click + Drag**: Orbit / rotate around the center of interest.
* **Right Click + Drag (or Shift + Left Click)**: Pan the camera.
* **Scroll Wheel**: Smooth zoom in / out.
* **Double Click on Station or Wall**: Street-view smooth flight transition directly to the target location.

### Speleo Compass Rose:
Anchored in the top-left corner of the viewport, the compass rose continuously indicates Grid North via a red arrow and displays the live azimuth heading badge (e.g., `045° NE`). Clicking the compass rose immediately snaps the camera to a North-aligned top-down view.

### 1-Click Technical View Presets (Keys 1 – 4):
* **Key `1` — Plan View (Pôdorys)**: Vertical top-down orthographic plan ($X-Y$), aligned with North for cartographic accuracy.
* **Key `2` — Longitudinal Profile (Pozdĺžny profil)**: True-scale front profile view (South $\to$ North, $X-Z$) with zero perspective distortion.
* **Key `3` — Cross Section (Priečny rez / Bokorys)**: True-scale side profile (West $\to$ East, $Y-Z$).
* **Key `4` — 3D Isometric View (Axonometria)**: Spatial axonometric perspective tilted at $45^\circ$.

---

## 4. 3D Cave Wall Reconstruction from Laser Splays (Splay SDF)

Surveys created with modern laser distometers (DistoX, CaveTRom, BRIC) contain hundreds or thousands of radial splay shots. LochViewer features an automated **Signed Distance Field (SDF) & Marching Cubes** engine running on background Web Workers that reconstructs watertight 3D cave passage walls.

![Splay SDF 3D Cave Walls](images/04_splay_sdf_walls.png)

### How to Use Splay SDF Walls:
1. Open the sidebar (**Cave** tab $\to$ dedicated **Splay SDF Cave Walls** card) and enable **Splay SDF Walls (2D/3D)**. The card displays the live count of radial survey splays (e.g., `149 rays`) and is available for all survey models.
2. **Angular / Sharpness**: Dedicated CAD slider ranging from sharp facets (`0.02` - precise technical passage boundaries) to smooth rounded contours (`0.25` - organic erosion walls).
3. The progress indicator will display reconstruction status in real time.
4. **Session Cache**: Once calculated, the mesh remains stored in memory for instant toggling.

---

## 5. Survey Measurement, Polygon Area & Structural Geology (Tectonics)

Activate the ruler icon in the top bar to open the dockable **Measurement Panel**:

![Measurement Panel in Action](images/05_measurement_panel.png)

### 1. Distance Measurement (2 Points):
* Click station or splay endpoint $P_1$ and $P_2$.
* **Outputs**: 3D spatial distance ($m$), horizontal distance ($m$), elevation difference ($\Delta H$), azimuth ($^\circ$), and inclination / slope ($^\circ$).

### 2. Polygon & Passage Area (3+ Points):
* Successively pick perimeter points ($P_1, P_2, P_3 \dots$).
* **Outputs**: 3D planar area ($m^2$), 2D horizontal footprint area ($m^2$), and total perimeter length ($m$).

### 3. Structural Geology & Tectonic Measurement (3-Point Plane):
* Pick 3 points on a fault plane, bedding joint, or passage wall.
* **Calculated Geological Parameters**:
  * **Dip ($\theta$)**: True dip angle from horizontal ($0^\circ$ flat, $90^\circ$ vertical).
  * **Dip Direction ($\alpha$)**: Azimuth direction of steepest down-slope ($0^\circ - 360^\circ$).
  * **Strike ($\beta$)**: Strike direction perpendicular to dip ($\alpha \pm 90^\circ$).
  * **Plane Normal**: Unit normal vector $\vec{n} = (n_x, n_y, n_z)$.
  * Displays a semi-transparent 3D planar disc and dip vector directly inside the cave.

---

## 6. Spatial Slicing & Profile Analysis (Z-Clipping)

![Floating Z-Clipping Slider](images/07_z_clipping_slider.png)

* Click the scissors icon ✂️ in the top bar (or press key `Z`) to open the **Floating Z-Slice Slider**.
* Drag the handle to dynamically slice through upper levels of multi-story cave systems.
* Displays the active cutting elevation in meters above sea level or relative to the entrance.
* Intersection edges between slicing planes and cave geometry are highlighted with bright outlines.

---

## 7. LiDAR Point Cloud Processing (Engine v2 NextGen)

For massive LiDAR scans (`.ply` format), LochViewer automatically activates **Engine v2 NextGen**:

![LiDAR Point Cloud & EDL Shading](images/08_lidar_pointcloud_edl.png)

* **Exclusive to PLY Datasets**: The **LIDAR NEXTGEN** engine switch, **LiDAR editing** panel, and point-cloud anomaly detectors are displayed strictly when viewing `.ply` point cloud models. Standard speleological survey formats (`.lox`, `.3d`, `.plt`, `.stl`) keep these controls hidden to prevent visual clutter and workflow confusion.
* **Octree LOD**: Streams only visible nodes dynamically, sustaining 60 FPS on multi-million point models.
* **Eye-Dome Lighting (EDL)**: Screen-space depth silhouette shader highlighting speleothems, fissures, and passage topography without heavy mesh overhead.
* **LiDAR Brush Editor**:
  * **Erase Brush**: Circle brush to eliminate surface vegetation, scan noise, or stray reflections.
  * **Keep Brush**: Isolates selected chambers and removes all unselected points.
* **2D Plan Map Generator**: Renders high-resolution orthophoto rasters directly from point cloud density, exportable as PNG.

---

## 8. Surface Terrain, Official GKÚ ZBGIS WMS & 3D Calibration

* **Official GKÚ SR WMS**: Streams official aerial orthophotos, high-resolution DMR 5.0 hillshading, and topographic maps from the Slovak Geodetic Institute.
* **Mapbox 3D Terrain**: Automatically renders regional 3D topography based on GPS coordinates.
* **3D Position Calibration**: Fine-tune the cave position relative to surface terrain in $X, Y, Z$ axes (0.5m increments) and export calibration files.

---

## 9. Sharing Models & Iframe Embedding

All view settings, camera angles, active layers, clipping heights, and SDF parameters are continuously encoded in the URL.

![Share & Iframe Embed Modal](images/10_share_dialog.png)

### Iframe Embedding Code:
```html
<iframe 
  src="https://loch.sss.sk/?model=https://...&embed=true&theme=precision&sdf=1" 
  width="100%" 
  height="600" 
  style="border:0; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.4);" 
  allowfullscreen 
  loading="lazy" 
  title="LochViewer 3D">
</iframe>
```

---

## 10. In-App Interactive Guide (Help Modal)

Clicking the **❓ Help** icon in the top bar or on the welcome screen opens the interactive user guide at any time:

![In-App Interactive Help Modal](images/11_help_modal.png)

---

## 11. Keyboard Shortcuts & Navigation Gestures

| Key / Gesture | Action |
| :--- | :--- |
| **`1`** | Plan View (Top-down orthogonal view) |
| **`2`** | Longitudinal Profile (Front orthogonal view) |
| **`3`** | Cross Section (Side orthogonal view) |
| **`4`** | 3D Isometric View (Axonometry) |
| **`O`** | Toggle Perspective $\leftrightarrow$ Orthographic Camera |
| **`F`** | Fit View to Screen |
| **`C`** | Toggle Centerline Traverses |
| **`W`** | Toggle Cave Walls |
| **`T`** | Toggle Surface Terrain |
| **`S`** | Toggle Laser Splays |
| **`M`** | Cycle Measurement Modes (Off $\to$ Distance $\to$ Polygon) |
| **`Z`** | Toggle Horizontal Z-Slice Slider |
| **`Ctrl + Z`** | Step Back in Navigation History (Undo Flight) |
| **Double Click** | Smooth Flight Transition to Target Point |
| **Click Compass** | Reset Camera Yaw to Grid North ($0^\circ$) |

---
*Created for the Slovak Speleological Society (SSS) and the global speleological community.*
