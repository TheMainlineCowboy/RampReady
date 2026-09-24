# RampReady Exact Work Plan

Locked project order from the 2026-09-23 review. Do not reorder without an explicit user decision.

## Immediate correctness
1. ✅ COMPLETE — Remove/hide translucent blue gate geometry without deleting source authority or breaking placement/collision. Root cause: sky visible through exact invisible-concrete helper footprints because the standalone app lacks X-Plane terrain beneath them. Fix: exact helper footprints underlaid with authored A1 ZDP `Flat_New_Uniform.pol` concrete; 8 footprints, no broad fake ground plane.
2. ✅ COMPLETE — Verify/fix A1 aircraft heading from authored KPHX 1.75.1 WED stand data. Source authority: WED_RampPosition `27855`, heading `-90.08°`; runtime/model-axis conversion is `180.08°`. Live browser evidence confirms the aircraft now faces the gate correctly so reverse pushback moves away from the terminal.
3. ✅ COMPLETE — Audit parked-aircraft heading at every supported T4 gate. Verified 76/76 live ramp-position IDs against the authoritative WED source, covering 75 gate names; D7 correctly retains two distinct authored ramp positions. Audit report passes with zero heading/ID/gate-name failures.
4. ✅ COMPLETE — Derive Kubota/LEKTRO/stand-up equipment spawn orientation from the same WED-derived gate scenario pose as the aircraft. Shared authority: `same-wed-ramp-position-aircraft-equipment-pose-v1`; aircraft and equipment yaw match at every audited supported ramp position, with the preserved 6.2 m approach offset. A1 live evidence confirms `180.08°` aircraft yaw and `180.08°` equipment yaw.
5. PARTIAL — LEKTRO driving controls and rear-wheel visual steering are verified/fixed. User-confirmed FWD/REV and steering behavior remain correct; locked 15-ft turning radius, 9 mph empty / 4 mph towing, rear-wheel steering and existing physics are preserved. The finalized R187A authored rear steering pivots `AP88_STEER_L_STEER` / `AP88_STEER_R_STEER` now visibly articulate with the validated steering angle (live test: 0° → -84° → 0°). OPEN: Operator View is still visibly landing in the passenger seat in the user's live app. Treat the earlier automated camera PASS as insufficient; fix and verify against the actual rendered driver station/steering-wheel side before marking item 5 complete.
5a. Fix the push-sequence jetway departure blocker. The training flow currently reaches the jetway-departure step and cannot advance because the exact live jetway is not yet performing the required departure animation/state transition. SOURCE FINDINGS: A1 is WED facade object `104804` using exact XP11 stock `lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac`; that facade and its attached stock OBJ8 pieces are static geometry/spelling/attachment definitions and contain no `ANIM_*` commands. The supplied MisterX dependency does include real AutoGate animated steel jetways driven by `marginal.org.uk/autogate/lat` and `marginal.org.uk/autogate/vert`; AutoGate's published contract defines `lat` as +1 m entrance movement toward the aircraft per +1.0 and `vert` as +1 m vertical entrance movement per +1.0. Use the exact WED/XP11 stock jetway geometry and placement as visual authority, and port the real AutoGate motion semantics/sequence to it rather than replacing the jetway model. Required departure sequence remains hood/cabin clear → telescope/retract → rotate away/park → trainer state advances. Do not fake the sequence with a timer-only bypass; the visual jetway state and training progression must agree.

## Exact-source completeness
6. Deep-dive the supplied KPHX scenery/dependencies for all authored ramp props/GSE/static placements and produce a loaded/unresolved/omitted inventory.
7. Import missing static ramp/GSE objects exactly as authored before adding custom ambience.
8. Inventory static aircraft from the source; separate scenery-only aircraft from any models suitable for pushback training.
9. Verify the B2↔A1 elevated walkway/road-under structure against source geometry and user photos; do not creatively rebuild before source comparison.
10. Import remaining exact airport structures/dependencies around T4.

## Immersion
11. Add authored ambient/static aircraft population, then optional lightweight moving ambience.
12. Build the airport perimeter/background layer, preferring KPHX/X-Plane source assets before custom PHX horizon scenery.
13. Enable optional gyro camera in free-drive first, then training.
14. Consolidate camera architecture for future Quest/VR head-pose input.
15. Create a professional title/main-menu scene: pushback-driver viewpoint toward ramp, aircraft crossing frame right→left, RampReady title left-center, polished menu.
16. Final polish/regression pass: loading transitions, audio, lighting, shadows, LOD/performance, mobile controls, VR performance, collision cleanup, gate-by-gate QA.

## Current source-truth constraints
- Preserve exact KPHX 1.75.1 source geometry/material/placement whenever available.
- Do not use old Airport_Jetway.glb, procedural terminal massing, legacy FSX terminal fallback, or rejected vehicle placeholders.
- Do not change locked T4 geometry merely because a visual feature looks unexpected; verify against source first.
- Production builds must use the immutable exact-runtime release gate and must not regenerate legacy airport runtime.
