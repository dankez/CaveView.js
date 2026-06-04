# Cave Wall Rendering

## Visual depth pass

Cave walls now use a shared material shader for LOX/STL scrap meshes in v1 and v2. The shader keeps existing modes such as solid color, altitude color, render mode, floor, ceiling, and section filtering, then adds:

- subtle cavity darkening based on wall orientation and relative floor/ceiling position,
- rim/edge highlight based on view angle,
- light height shading so floor, walls, and ceiling read as a more plastic shape,
- procedural bump texture controlled by `scrapsRelief`.

This is intentionally not a wireframe overlay. Edges are emphasized by shading, so triangle density remains hidden in normal presentation.

## Material presets

The sidebar material buttons set `caveTexture` and enable 3D render mode:

- `limestone`: neutral light limestone with balanced roughness,
- `dolomite`: bright warm dolomite preset using shader relief instead of a dark photo texture,
- `grey_limestone`: bright cool grey preset using shader relief instead of a dark photo texture,
- `technical`: no photo texture, stronger rim/cavity shading for shape inspection.

The same visual depth shader also affects solid custom color and altitude color modes, so STL/LOX walls retain plasticity outside the textured render mode.

## Lighting

Both v1 and v2 scenes use a lower ambient level plus hemisphere, key, fill, rim, and weak lower lights. This improves wall volume while keeping existing model colors readable.
