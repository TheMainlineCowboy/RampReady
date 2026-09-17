# Exact KPHX ingest order

1. Terminal 4 North (`Terminal4b.obj` + authored day/LIT textures) and WED placement.
2. Terminal 4 South (`Terminal4.obj` + authored day/LIT textures) and WED placement.
3. Terminal 4 gate/jetway source objects, SAM/default jetway facades, gate-number assets, and exact WED placements.
4. Ground polygons, authored ground textures, markings, taxi/runway lines, signs, and apt/WED pavement geometry.
5. Ramps, runways, parking garages, SkyTrain, cargo/support buildings, static airport objects, lights, and people where source-authoritative.
6. Resolve referenced objects from MisterX Library, CDB Library, state flags, windsock sync, and other required source libraries.
7. Ortho/terrain alignment and elevation/flattening source.
8. Remove superseded reconstructed Terminal 4/A1/ground fix-normalize pipeline.
9. Browser/runtime multi-angle visual verification and exact-source identity checks.
10. Only after full verification: merge the source-airport replacement and deploy through GitHub Pages.
