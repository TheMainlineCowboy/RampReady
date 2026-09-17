// Deprecated by the Aug. 15 KPHX photo-authoritative Gate A1 repair.
//
// This preparer used to collapse the final A1 wall/Rotunda relationship into a
// 2.4 m generic vestibule and explicitly reject the long fixed route visible in
// the user's KPHX photographs.  Gate A1 is gate-specific: the actual Terminal 4
// facade feeds a long elevated fixed corridor, dogleg/elbow and remote Rotunda.
// A3+ retain their shorter/direct terminal-side connections.
//
// Keep the legacy path as a compatibility no-op so older orchestration can call
// it without mutating the supplied movable jetway parent or overwriting the
// later BGATE1 photo-authoritative fixed-route solve.

console.log(
  "Skipped retired compact A1 wall-distance rewrite; Aug. 15 BGATE1 long fixed-route authority owns A1 terminal geometry.",
);
