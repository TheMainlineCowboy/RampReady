// Deprecated by the Aug. 15 KPHX photo-authoritative Gate A1 repair.
//
// The old rigid-span pass deliberately replaced broader terminal-side geometry
// with a 2.4 m compact vestibule and rejected any later long-corridor span. That
// directly contradicts the real Gate A1 photographs. A1 requires a long fixed
// elevated corridor plus dogleg/elbow to a remote Rotunda before the supplied
// movable Airport_Jetway.glb begins.
//
// Leave this path as an explicit compatibility no-op. The modern BGATE1 wall,
// dogleg and remote-Rotunda passes own the fixed A1 route; A3+ retain their
// independent short/direct connector treatment.

console.log(
  "Skipped retired rigid compact A1 span rewrite; long BGATE1 fixed corridor/dogleg/remote-Rotunda geometry remains authoritative.",
);
