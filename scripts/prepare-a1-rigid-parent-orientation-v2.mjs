// Deprecated by the Aug. 15 KPHX photo-authoritative Gate A1 repair.
//
// This pass predates the long fixed A1 corridor/dogleg/remote-Rotunda model. It
// rotates/translates the COMPLETE supplied Airport_Jetway.glb parent around the
// Cab and then rejects terminal spans above 12 m. That is incompatible with the
// photographed A1 layout and fights the later BGATE1 wall + remote-Rotunda
// authority by moving the supplied movable bridge to manufacture a compact
// terminal relationship.
//
// Keep the legacy path as an explicit compatibility no-op. The modern A1
// placement keeps the exact supplied movable hierarchy intact, preserves the
// remote Rotunda/source bridge heading, and connects the actual BGATE1 facade
// through the A1-only long elevated fixed corridor and dogleg. A3+ retain their
// independent short/direct connector geometry.

console.log(
  "Skipped retired A1 rigid-parent terminal orientation/12 m compact-span rewrite; Aug. 15 BGATE1 long fixed corridor/dogleg/remote-Rotunda authority remains intact.",
);
