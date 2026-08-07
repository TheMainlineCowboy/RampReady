# RampReady manual jetway placement

This folder exists so the exact user-supplied jetway can be found immediately for manual placement without relying on the simulator placement pipeline.

## Exact 3D model

Use this untouched production asset:

`public/models/airport-jetway/Airport_Jetway.glb`

- File size: 31,459,796 bytes
- SHA-256: `562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0`
- Format: GLB
- Textures: embedded in the GLB
- Meshes/hierarchy/materials: preserved from the supplied model
- Do not substitute the procedural AIR_Jetway01 fallback or generated connector geometry when doing manual placement.

For Gate A1, place the Rotunda terminal-side against the actual Terminal 4 building wall, not the elevated walkway. Height can remain adjustable for aircraft type; ground the authored bogie/wheels on the ramp and keep the supplied child hierarchy intact.
