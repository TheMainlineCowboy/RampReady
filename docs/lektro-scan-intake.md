# Lektro KIRI Scan Intake

## Preferred source package

The newest user-supplied KIRI Engine scan is the preferred high-detail source wherever it improves on the earlier rough scan. It is a complete textured OBJ package containing:

- `3DModel.obj`
- `3DModel.mtl`
- `3DModel.jpg`

The exact archive and source-file fingerprints, byte sizes, measured topology, raw bounds, and defect list are recorded in `docs/lektro-improved-scan-source.json`.

Measured characteristics of the improved source:

- 63,007 vertices
- 126,113 triangular faces
- 68,783 texture coordinates
- 157,840 normals
- 4096 × 4096 RGB texture
- raw bounds approximately 1.815002 × 0.341382 × 1.301475 unknown model units

The earlier scan remains reference evidence where it captured an area more completely, but it must not displace better geometry from the improved scan.

## Role in RampReady

This scan is the dimensional and visual foundation for the production Lektro rebuild. It must drive the exact body silhouette, operator station, hood/deck, wheel placement, labels, wear, lift assembly, and cradle proportions. It is not approved as a direct runtime asset.

## Confirmed repair priorities

The first scan-driven modeling increment must address the user-observed and measured defects rather than adding more speculative procedural geometry:

1. preserve the untouched archive and all recorded fingerprints;
2. remove concrete, background geometry, floating fragments, and malformed boundary triangles;
3. close the two holes in the rear wall with clean hard-surface geometry;
4. rebuild the partially clipped lifting plate from reference photographs instead of stretching damaged scan triangles;
5. rebuild the operational nose-wheel capture hardware with correct width, thickness, pivots, travel, and connection geometry;
6. repair thin or broken wheel-well, seat-back, body-edge, underside, and hidden surfaces;
7. establish correct forward/up axes, symmetry references, wheel-ground plane, and real-world scale evidence;
8. separate the body, steering wheels, lift assembly, cradle/capture hardware, and other moving parts with correct local pivots;
9. create simple, stable collision and physics proxy geometry independent of the visual mesh;
10. retopologize or decimate into browser- and eventual VR-appropriate LODs while preserving silhouette and clearances;
11. repair only genuinely defective texture regions while preserving authentic panels, markings, wear, labels, and color variation;
12. convert the verified repaired model to GLB/glTF and validate it in Three.js and the simulator.

## Known source limitations

- scan noise and background/ground geometry
- two holes in the rear wall
- partially clipped lifting plate
- ragged edges and floating fragments
- thin or broken wheel-well, seat-back, body-edge, underside, and hidden surfaces
- baked lighting and shadows
- blurred or missing texture regions
- uncertain source scale and orientation
- topology and material layout not optimized for browser delivery
- all moving parts currently fused into a static scan

## Required conversion pipeline

1. Preserve the untouched source package outside generated runtime output.
2. Import OBJ, MTL, and texture together and verify material assignment.
3. Confirm the source fingerprints against `docs/lektro-improved-scan-source.json`.
4. Remove ground, background, floating fragments, and scan noise conservatively.
5. Establish the correct forward, up, and wheel-ground axes.
6. Determine real scale from known Lektro dimensions and user reference photos; do not infer final scale from raw scan bounds alone.
7. Rebuild operational and hard-surface forms where scan quality is insufficient, beginning with the rear wall, lifting plate, and capture hardware.
8. Preserve scan-derived landmarks for hood/deck height, operator station position, axle spacing, wheel centers, labels, and cradle proportions.
9. Separate and correctly pivot functional moving assemblies.
10. Replace baked lighting with neutral physically based materials where practical without erasing authentic surface character.
11. Decimate or rebuild to browser/VR triangle budgets while preserving silhouette and operational clearances.
12. Produce optimized visual LODs plus separate collision and physics proxies.
13. Produce an optimized GLB with validated transforms, normals, materials, texture paths, and grounded wheel contact.
14. Add structural, render, and browser-runtime checks before replacing procedural Lektro geometry.

## Required visual evidence

Before runtime replacement, create inspection renders or screenshots that clearly show:

- repaired rear wall from both rear three-quarter angles;
- complete lifting plate and capture hardware from top, side, and nose-gear approach views;
- wheel contact and ground plane;
- body, lift, steering, and cradle pivot locations;
- texture mapping and repaired regions;
- operator station, hood/deck, wheel placement, and overall proportions;
- in-simulator appearance beside the verified CRJ700.

## Acceptance gates

The scan-driven model is not ready for runtime until all of the following are verified:

- exact source fingerprint match
- correct orientation and grounded wheel contact
- documented real-world scale source
- rear-wall holes closed without visible scan stretching
- lifting plate and nose-wheel capture hardware complete and operationally credible
- moving components separated with correct pivots and travel
- operator station and hood/deck proportions visibly match the scan/reference photos
- wheel placement and cradle geometry preserve nose-gear capture clearance
- no background or ground scan fragments remain
- no missing external textures
- acceptable browser/VR LOD triangle count and texture memory
- stable collision and physics proxies
- successful GLB load in Three.js
- no regression to CRJ700 nose-gear capture or towing kinematics
- direct live GitHub Pages visual verification after integration

## Runtime integration rule

Keep the current procedural Lektro active until the improved scan-driven GLB passes every acceptance gate. Replace guessed procedural body geometry only after the new model is verified; retain procedural helpers only for intentionally separate functional, collision, or physics elements.
