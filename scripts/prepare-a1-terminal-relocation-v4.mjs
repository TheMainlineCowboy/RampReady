// Deprecated by the Aug. 15 KPHX photo-authoritative A1 repair.
//
// The old v4 preparer translated the COMPLETE supplied A1 jetway parent until
// the Rotunda sat behind a 2.4 m generic wall vestibule.  That geometry is the
// opposite of the photographed A1 arrangement: A1 has a long elevated fixed
// terminal-side corridor, an elbow/dogleg, and a remote Rotunda.  Moving the
// supplied movable parent toward the wall here also corrupted every later
// aircraft-side/bogie solve because those later stages had to undo a hidden
// parent translation.
//
// Keep this file as an explicit compatibility no-op because older production
// orchestration still invokes its path.  The current A1 terminal endpoint and
// fixed route are owned by the later BGATE1 photo-authoritative wall/dogleg
// passes; the supplied Airport_Jetway.glb movable hierarchy must not be moved
// to manufacture a compact terminal sleeve.

console.log(
  "Skipped retired A1 v4 compact terminal relocation; Aug. 15 BGATE1 long fixed corridor/dogleg/remote-Rotunda authority owns terminal-side placement.",
);
