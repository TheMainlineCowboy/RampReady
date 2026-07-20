# Lektro KIRI Scan Intake

## Source package

The user-supplied KIRI Engine scan is a complete textured OBJ package containing:

- `3DModel.obj`
- `3DModel.mtl`
- `3DModel.jpg`

Observed source characteristics supplied with the asset:

- approximately 39,377 vertices
- approximately 78,790 triangular faces
- 4096 × 4096 texture
- raw bounds approximately 2.219 × 0.440 × 2.083 model units

## Role in RampReady

This scan is the dimensional and visual reference for the production Lektro rebuild. It must drive the body, operator station, hood/deck, wheel placement, and cradle proportions. It is not approved as a direct runtime asset.

## Known source limitations

- scan noise and background/ground geometry
- baked lighting and shadows
- blurred or missing texture regions
- uncertain source scale and orientation
- topology and material layout not optimized for browser delivery

## Required conversion pipeline

1. Preserve the untouched source package outside generated runtime output.
2. Import OBJ, MTL, and texture together and verify material assignment.
3. Remove ground, background, floating fragments, and scan noise.
4. Establish the correct forward, up, and wheel-ground axes.
5. Determine real scale from known Lektro dimensions and user reference photos; do not infer final scale from raw scan bounds alone.
6. Rebuild or retopologize major hard-surface forms where scan quality is insufficient.
7. Preserve scan-derived landmarks for hood/deck height, operator station position, axle spacing, wheel centers, and cradle proportions.
8. Replace baked lighting with neutral physically based materials where practical.
9. Decimate or rebuild to a browser-appropriate triangle budget while preserving silhouette and operational clearances.
10. Produce an optimized GLB with validated transforms, normals, materials, texture paths, and grounded wheel contact.
11. Add structural and browser-runtime checks before replacing procedural Lektro geometry.

## Acceptance gates

The scan-driven model is not ready for runtime until all of the following are verified:

- correct orientation and grounded wheel contact
- documented real-world scale source
- operator station and hood/deck proportions visibly match the scan/reference photos
- wheel placement and cradle geometry preserve nose-gear capture clearance
- no background or ground scan fragments remain
- no missing external textures
- acceptable browser triangle count and texture memory
- successful GLB load in Three.js
- no regression to CRJ700 nose-gear capture or towing kinematics
- direct live GitHub Pages visual verification after integration

## Runtime integration rule

Keep the current procedural Lektro active until the scan-driven GLB passes all acceptance gates. Replace guessed procedural body geometry only after the new model is verified; retain procedural helpers only for functional elements that are intentionally separate from the visual mesh.
