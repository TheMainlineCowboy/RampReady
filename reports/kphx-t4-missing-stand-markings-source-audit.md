# KPHX T4 Missing Stand-Marking Exact-Source Audit

Date: 2026-09-26

## Question closed

User visual QA confirms the exact draped gate centerlines, stand/stop-position markings, and much of the per-gate artwork now render correctly. The unresolved visual request was narrower:

- GSE/equipment parking boxes or parking lanes around operational stands.
- Left/right stand-width or gate-envelope boundary paint.

This audit asks whether those two missing families are actually authored in the supplied KPHX 1.75.1 WED/library source already materialized by RampReady.

## Evidence checked

- `reports/kphx-wed-surface-network.json`
- `reports/kphx-full-airport-wed-placements-exact.json`
- full ZDP marking resources loaded by `installFullExactZdpMarkings.js`
- full MisterX taxiline resources loaded by `installFullExactMisterXLines.js`
- exact `GateNumbers/*` and `GroundMarkings/*` placements
- exact MisterX ramp draped objects:
  - `Ramp_1_Stripes_nL.obj`
  - `Ramp_1_nL.obj`
  - `Ramp_Southwest_Med.obj`
  - `Ramp_Southwest_Med_nL.obj`
- WED polygon/surface geometry intersecting the operational T4 stand area
- all 22 MisterX line placements intersecting the exact T4 bounds.

## Findings

1. The WED exporter explicitly captures node `<marking>` values, but the generated WED surface network contains **zero nodes anywhere with a non-empty `markings` array**. The missing stand markings are therefore not hidden embedded-node markings.

2. The exact MisterX ramp OBJ conversion preserves source vertex/index topology, UVs, source bounds, and decoded RGBA texture pixels. The missing families are not being lost by the browser conversion/materialization step.

3. The T4 `GroundMarkings/*` set is taxiway-label/background artwork, not a GSE parking-box or repeated stand-boundary system.

4. The large `yellow_dark.pol` / `Flat_New_Uniform.pol` surfaces intersecting many operational stands are tiled pavement/color overlays, not stand-specific linework.

5. The **22 live MisterX T4 line placements** resolve to only six resources:

| Resource | T4 placements |
| --- | ---: |
| `MisterX_Library/Airport/Taxilines/Old/Removed_Line_1m.lin` | 11 |
| `MisterX_Library/Airport/Taxilines/Old/Red_White_B.lin` | 5 |
| `MisterX_Library/Airport/Taxilines/Old/Centerline_B.lin` | 2 |
| `MisterX_Library/Airport/Taxilines/HoldLine.lin` | 2 |
| `MisterX_Library/Airport/Taxilines/RoadBroken.lin` | 1 |
| `MisterX_Library/Airport/Taxilines/Old/Removed_Line_1.5m.lin` | 1 |

These are removed-line remnants, red/white markings, centerlines, hold lines, and a road-broken line. They do **not** form a repeated GSE parking-box family or left/right gate-envelope boundary family across the operational stands.

## Exact-source conclusion

Within the **user-supplied KPHX 1.75.1 WED/library source audited by RampReady**, the requested GSE/equipment parking boxes and repeated left/right stand-width boundary paint are **not authored as an exact reusable marking layer that is merely failing to load**.

The current working draped centerline/stop artwork remains locked. Do not reopen the 317 gate-marking placements, 62 MisterX ramp placements, draped compatibility, ZDP marking loader, or MisterX line loader to chase these two missing families.

If RampReady later adds these two families for training fidelity, treat them as a **new PHX-fidelity authoring task requiring an external authoritative reference** (for example current aerial/airside reference or user-supplied exact layout), not as recovery of omitted KPHX 1.75.1 source data. Do not invent geometry from generic airport examples.
