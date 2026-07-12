# CRJ700 source model selection

Selected source: `bombardier-crj700-model_files.zip` / `CRJ700.stl`.

Reason: the STL is a single watertight aircraft mesh with no missing material or texture dependencies. The alternate OBJ references a missing `3d-model.mtl` and contains many disconnected components, making it less reliable for the mobile trainer.

Conversion target:
- web format: GLB
- mobile optimization: 8,000 triangles
- length: 32.5 m
- wingspan: approximately 23.64 m
- local origin: nose-gear contact point
- forward direction: negative Z
- up direction: positive Y

The procedural CRJ remains only as a temporary fallback while the GLB asset loads.
