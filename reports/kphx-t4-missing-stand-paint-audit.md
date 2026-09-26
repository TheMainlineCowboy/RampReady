# KPHX Terminal 4 Missing Stand Paint Audit

Date: 2026-09-26
Repository: TheMainlineCowboy/RampReady
Source authority: supplied KPHX 1.75.1 / earth.wed.xml and resolved exact X-Plane library resources

## Question

Identify the exact authored source for the still-missing Terminal 4:

1. GSE/equipment parking boxes and equipment parking lanes.
2. Left/right aircraft-stand boundary paint.

Do not infer or procedurally invent geometry.

## Conclusion

The supplied KPHX 1.75.1 scenery does **not** contain a repeated authored WED/object/line layer for those two marking classes at the operational Terminal 4 stands.

The already-visible draped centerline/stop/gate artwork is a different authored layer and remains valid/locked.

No runtime implementation should be added for the missing GSE boxes or stand-width boundaries unless a new exact PHX source is supplied.

## Evidence

### 1. Embedded WED node markings

Report:
- `reports/kphx-wed-surface-network.json`

The report generator explicitly parses WED `<marking value="...">` elements into each node's `markings` array.

Result:
- Non-empty embedded node `markings` arrays in the full report: **0**
- Therefore there is no hidden WED taxiway/surface/boundary-node marking code to materialize around T4.

This rules out the stalled embedded-node-marking hypothesis.

### 2. Exact MisterX T4 taxiline placements

Live authority:
- `src/environment/kphxFullAirport/installFullExactMisterXLines.js`
- Exact live count: **65** MisterX taxiline placements airport-wide
- Exact T4 count: **22**

All 22 T4 placements are open chains. None is a closed service box.

| WED ID | Resource | Closed | Nearest matched operational gate | Minimum distance |
|---|---|---:|---|---:|
| 45671 | MisterX_Library/Airport/Taxilines/RoadBroken.lin | no | B15A | 66.7 m |
| 45112 | MisterX_Library/Airport/Taxilines/HoldLine.lin | no | B21 | 171.6 m |
| 114770 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 215.6 m |
| 114776 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 217.3 m |
| 109351 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 217.4 m |
| 109356 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 218.0 m |
| 107094 | MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin | no | B1 | 244.4 m |
| 109359 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 255.0 m |
| 101678 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | A1 | 278.9 m |
| 106757 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | A1 | 280.9 m |
| 106746 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | A1 | 282.4 m |
| 106743 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1.5m.lin | no | A1 | 286.6 m |
| 107081 | MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin | no | B1 | 290.3 m |
| 109365 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 294.3 m |
| 106873 | MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin | no | A1 | 299.1 m |
| 109368 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | B15A | 314.2 m |
| 45088 | MisterX_Library/Airport/Taxilines/HoldLine.lin | no | B15A | 389.2 m |
| 106754 | MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin | no | A1 | 394.9 m |
| 101621 | MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin | no | A1 | 424.6 m |
| 101627 | MisterX_Library/Airport/Taxilines/Old/Centerline_B.lin | no | A1 | 434.3 m |
| 101631 | MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin | no | A1 | 448.0 m |
| 101637 | MisterX_Library/Airport/Taxilines/Old/Centerline_B.lin | no | A1 | 453.4 m |

Result:
- No MisterX T4 taxiline comes within 50 m of any of the 19 exact-matched operational RampStarts.
- Closest is `RoadBroken.lin`, 66.7 m from B15A.
- These cannot be the missing per-stand GSE boxes or stand-edge lines.

Live render state for these line resources:
- Installed by `installFullExactMisterXLines.js` through `installPackageOwnedSurfaceLayer.js`.
- Marking lift: `0.006 m + layer offset * 0.00005 m + line-layer * 0.00005 m`.
- `THREE.DoubleSide`.
- Transparent material where source permits alpha.
- Polygon offset enabled, factor `-1`, units `-1`.
- Three.js default depth test/write behavior retained by this surface renderer.
- Render order derived from X-Plane `markings` layer (500) + authored offset + line-layer epsilon.

### 3. ZDP line resources near matched operational stands

The stricter segment-distance pass found only isolated line candidates:

- WED 136375 — `ZDP_Library/markings/lines/worn/centerline.lin`
  - passes about 0.2 m from B19
  - ordinary centerline, not a box/boundary family
- WED 136134 — `ZDP_Library/markings/lines/worn/white_centerline_road.lin`
  - roughly 21–24 m from B16/B1/B2
  - road centerline resource, not repeated stand boundaries
- WED 136170 — `ZDP_Library/markings/lines/worn/white.lin`
  - roughly 21–25 m from B15A/B16/B1
  - isolated white line, not repeated across operational stands
- WED 136143 — `lib/airport/lines/20_road_edge.lin`
  - about 18.3 m from B15A
  - road edge, not stand paint

The full exact ZDP marking installer already loads the materialized ZDP marking network:
- 17 marking polygons
- 955 draped marking orthophotos
- 827 marking lines
- 1,799 total exact marking placements

Therefore these candidates are not missing because a T4 marking loader omitted them.

For ZDP line resource `worn/centerline.lin`:
- source layer: `markings + 2`
- live Y: approximately `0.0061 m` for layer 0
- render order: approximately `502`
- DoubleSide
- polygon offset `-1/-1`

### 4. Large polygons surrounding the operational stands

A strict containment/intersection pass found:

- WED 45506 — `ZDP_Library/ground_textures/concrete/flat/Flat_New_Uniform.pol`
- WED 138421 / 138536 — `ZDP_Library/ground_textures/concrete/flat/overlays/yellow_dark.pol`

These polygons cover/contain large portions of the T4 apron, including operational stand coordinates.

They are pavement/color overlays, not stand-specific marking geometry.

`yellow_dark.pol` exact material authority:
- kind: `DRAPED_POLYGON`
- scale: 36 m x 36 m repeating texture
- layer: `taxiways + 3`
- surface: concrete
- live pavement position: Y = 0
- no stand-specific box/boundary geometry exists in the texture placement itself

### 5. Ten exact package GroundMarkings objects inside T4

The exact T4 gate-marking installer loads all 10 relevant `GroundMarkings/*` placements.

They are:
- black taxiway-label backgrounds
- taxiway letters D, K, N, J, P

WED IDs:
- 15557, 15539, 15531, 15558, 15537, 15529, 15532, 15538, 15530, 15540

They are not GSE/equipment parking boxes or stand-width boundaries.

Live render state:
- exact draped-object compatibility path
- visual lift: 0.012 m
- polygon offset: -4 / -4
- transparent true
- depthTest true
- depthWrite false
- DoubleSide
- marking render order

### 6. MisterX ramp objects already installed and preserved exactly

Exact T4 ramp resources:
- `Ramp_1_Stripes_nL.obj` — 22 placements
- `Ramp_1_nL.obj` — 8 placements
- `Ramp_Southwest_Med.obj` — 27 placements
- `Ramp_Southwest_Med_nL.obj` — 5 placements

Total: 62 placements.

The operational A/B stand artwork is primarily the `Ramp_1*` family.

Converter evidence proves no hidden geometry/texture section is being dropped:
- exact source vertex/index/triangle topology preserved
- UVs preserved
- source bounds preserved
- converted PNG decoded RGBA hash equals source DDS decoded RGBA hash

Examples:
- `Ramp_1_Stripes_nL.obj`: 112 vertices, 168 indices, 56 triangles, 3 draw ranges; bounds approx 21.06 m wide x 42.78 m long
- `Ramp_1_nL.obj`: 52 vertices, 78 indices, 26 triangles, 2 draw ranges; bounds approx 21.06 m wide x 35.69 m long

Thus there is no omitted OBJ section containing a wider stand envelope to recover.

Live render state:
- 0.012 m lift
- polygon offset -4 / -4
- transparent true
- depthTest true
- depthWrite false
- DoubleSide
- markings render ordering

These resources remain locked.

### 7. B1A and B15B

Do not invent coordinates.

The exact placement report contains:
- B1
- B15A
- B15C

It contains no explicit RampStart/reference named:
- B1A
- B15B

A full explicit-reference sweep found no B1A/B15B string reference in the placement report.

This does not change the broader source conclusion: there is no repeated T4 stand-box/boundary marking family elsewhere in the exact WED surface/object inventory that could be assigned to those two gates.

## Implementation decision

No exact-source runtime change is warranted.

The smallest exact-source implementation is therefore: **none**, because the supplied scenery does not author these two requested marking classes at the operational T4 stands.

Do not:
- draw procedural boxes,
- infer stand width from neighboring stands,
- duplicate unrelated ZDP white/road lines,
- extend the existing MisterX ramp texture,
- invent B1A/B15B geometry.

If a new authoritative PHX source is supplied that contains the real GSE parking boxes/stand boundary paint, materialize that source directly using the existing exact surface/object render paths.
