# RampReady Exact Work Plan

Locked project order from the 2026-09-23 review. Do not reorder without an explicit user decision.

## Immediate correctness
1. ✅ COMPLETE — Remove/hide translucent blue gate geometry without deleting source authority or breaking placement/collision. Root cause: sky visible through exact invisible-concrete helper footprints because the standalone app lacks X-Plane terrain beneath them. Fix: exact helper footprints underlaid with authored A1 ZDP `Flat_New_Uniform.pol` concrete; 8 footprints, no broad fake ground plane.
2. ✅ COMPLETE — Verify/fix A1 aircraft heading from authored KPHX 1.75.1 WED stand data. Source authority: WED_RampPosition `27855`, heading `-90.08°`; runtime/model-axis conversion is `180.08°`. Live browser evidence confirms the aircraft now faces the gate correctly so reverse pushback moves away from the terminal.
3. ✅ COMPLETE — Audit parked-aircraft heading at every supported T4 gate. Verified 76/76 live ramp-position IDs against the authoritative WED source, covering 75 gate names; D7 correctly retains two distinct authored ramp positions. Audit report passes with zero heading/ID/gate-name failures.
4. ✅ COMPLETE — Derive Kubota/LEKTRO/stand-up equipment spawn orientation from the same WED-derived gate scenario pose as the aircraft. Shared authority: `same-wed-ramp-position-aircraft-equipment-pose-v1`; aircraft and equipment yaw match at every audited supported ramp position, with the preserved 6.2 m approach offset. A1 live evidence confirms `180.08°` aircraft yaw and `180.08°` equipment yaw.
5. ✅ COMPLETE / LOCKED — LEKTRO driving controls, rear-wheel visual steering, and Operator View are user-verified. Preserve the locked 15-ft turning radius, 9 mph empty / 4 mph towing, rear-wheel steering, existing physics, authored rear steering pivots `AP88_STEER_L_STEER` / `AP88_STEER_R_STEER`, and the finalized R187A operator camera. User visually confirmed the Operator View is now in the actual driver station and touch look-around works correctly. **DO NOT change the driver-eye placement or unlocked operator look behavior without explicit user direction.** The separate Gyro View enable/toggle control is still missing from the UI; keep that as the gyro-camera task under item 13 rather than reopening this locked camera-placement work.
5a. COMPLETE / LOCKED A1 REFERENCE — A1 push-sequence departure, static terminal-side sections, exterior stair articulation, and the two under-stair strips are user-verified. **DO NOT alter these A1 mechanics without explicit user direction.** The moving bridge remains physically attached at its elevated terminal hinge, wheel/support carriage remains on pavement, bridge height changes by tilting about the hinge, exact Segment 4/5/6 static shells remain fixed, and the exact `jw_cabin_1b` stair assembly pivots at its upper platform hinge while its foot remains on the ramp. The two long under-stair strips are included in the same stair hinge group. A1 is the validated reference implementation for this stock jetway family.
5b. TODO — Generalize the user-verified A1 behavior into a reusable `Jetway_1_solid.fac` rig for the remaining Terminal 4 jetways instead of hand-fixing gates one by one. All 76 mapped T4 jetways use the same exact XP11 stock facade family; derive each gate from its own WED path/wall choices/lengths/orientation and aircraft-door target while reusing the validated fixed-static-section, elevated-hinge, telescope/yaw/pitch, ground-constrained wheel/support, cabin, and hinged-ground-contact stair rules. First audit/classify authored wall-sequence variants across all 76 placements; create only the minimum source-derived rig variants required. Gate-specific hand tuning is not the default.

## Exact-source completeness
6. Deep-dive the supplied KPHX scenery/dependencies for all authored ramp props/GSE/static placements and produce a loaded/unresolved/omitted inventory.
7. Import missing static ramp/GSE objects exactly as authored before adding custom ambience.
8. Inventory static aircraft from the source; separate scenery-only aircraft from any models suitable for pushback training.
9. Verify the B2↔A1 elevated walkway/road-under structure against source geometry and user photos; do not creatively rebuild before source comparison.
10. Import remaining exact airport structures/dependencies around T4.

## Immersion
11. Add authored ambient/static aircraft population, then optional lightweight moving ambience.
12. Build the airport perimeter/background layer, preferring KPHX/X-Plane source assets before custom PHX horizon scenery.
13. Enable optional gyro camera in free-drive first, then training. The Operator View now accepts look input correctly, but the user-visible **Gyro View enable/toggle button is still missing** and must be added as part of this item.
14. Consolidate camera architecture for future Quest/VR head-pose input.
15. Create a professional title/main-menu scene: pushback-driver viewpoint toward ramp, aircraft crossing frame right→left, RampReady title left-center, polished menu.
16. Final polish/regression pass: loading transitions, audio, lighting, shadows, LOD/performance, mobile controls, VR performance, collision cleanup, gate-by-gate QA.

## Current source-truth constraints
- Preserve exact KPHX 1.75.1 source geometry/material/placement whenever available.
- Do not use old Airport_Jetway.glb, procedural terminal massing, legacy FSX terminal fallback, or rejected vehicle placeholders.
- Do not change locked T4 geometry merely because a visual feature looks unexpected; verify against source first.
- Production builds must use the immutable exact-runtime release gate and must not regenerate legacy airport runtime.
