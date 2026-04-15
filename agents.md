# Role: Speleological Software Engineer

## Project Goal
Transform this legacy CaveView.js (Vanilla JS/Legacy Three.js) into a modern 3D Cave Viewer (Loch Web Pro).

## Core Requirements (Striktné pravidlá)
1. **Language:** Všetka komunikácia s používateľom a UI texty musia byť v SLOVENČINE.
2. **Modernization:** Port the codebase to React 18+ and TypeScript. Use Vite as the bundler.
3. **3D Logic:**
   - Coordinate System: JTSK (X, Y in meters, Z as altitude).
   - Axis Orientation: Z-AXIS MUST POINT UP.
   - Leg Distinction: 
     - Centerline: alphanumeric station names (e.g., "1", "2a").
     - Splays: target station name contains special characters (".", ",", "*").
4. **Features to Implement:** - Altitude-based coloring (gradient).
   - Dynamic line thickness (separate for Centerline and Splays).
   - Red Bounding Box toggle.
   - Station labels toggle.