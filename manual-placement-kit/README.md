# RampReady A1 manual placement kit

This folder contains the real 3D files needed to position the supplied passenger boarding bridge against Phoenix Sky Harbor Terminal 4 outside of RampReady.

## Jetway
- `Airport_Jetway.glb`
- Exact untouched user-supplied model.
- Expected size: 31,459,796 bytes.
- Expected SHA-256: `562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0`.
- The GLB contains the original embedded materials/textures and hierarchy.

## Terminal 4
Import `terminal4/terminal4.gltf`. Keep `terminal4.bin` and the `terminal4/textures/` folder beside it so the glTF resolves correctly.

The Terminal 4 export preserves the source coordinate system and authored geometry used by RampReady. Import the terminal first, then import `Airport_Jetway.glb` and position the complete jetway parent at A1 without changing the supplied child hierarchy.

When the placement is correct, save/export the positioned scene or provide the jetway parent transform. RampReady can then use that exact transform rather than trying to infer it from screenshots.
