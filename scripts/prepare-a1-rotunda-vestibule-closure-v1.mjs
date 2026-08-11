import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const ELBOW_AUTHORITY = "same-day-photo-authored-opening-fixed-rotunda-elbow-terminal-aligned-v7";
const WALL_LOCK_AUTHORITY = "fixed-rotunda-measured-wall-lock-no-relocation-v34";
const MIN_TERMINAL_ALIGNMENT = 0.985;

// Build/normalize the small generated terminal-side seam first. These stages may
// style the connector, but they do not own any supplied jetway transform.
await import(`./prepare-a1-straight-solid-vestibule-v1.mjs?straight-solid=${Date.now()}`);
await import(`./prepare-a1-readiness-compact-wall-v1.mjs?source-measured-readiness=${Date.now()}`);

// Final physical geometry is validation-only: structural Terminal 4 wall,
// articulated Rotunda aperture, measured short fixed leg, and zero whole-bridge
// relocation. It must not manufacture the historical 2.40 m spacing.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?pre-visual-real-wall=${Date.now()}`);

const installation = fs.readFileSync(installationPath, "utf8");
for (const required of [
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ELBOW_AUTHORITY}"`,
  "const measuredTerminalAlignment = alignedOpeningDirection.dot(terminalDirection)",
  `measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  "const terminalRelocationMeters = 0;",
  "const relocationDistance = 0;",
  "uploadedJetwayA1TerminalRelocationMeters = 0",
  `uploadedJetwayA1FinalWallLockAuthority = "${WALL_LOCK_AUTHORITY}"`,
  "uploadedJetwayA1CabContactWorldX = cabContactWorld.x",
  "uploadedJetwayA1FinalRotundaWorldX = finalRotundaCenterWorld.x",
  "uploadedJetwayA1FinalMeasuredWallWorldX = finalMeasuredTerminalWallWorld.x",
]) {
  if (!installation.includes(required)) {
    throw new Error(`${installationPath}: physical A1 Rotunda/terminal closure state is missing ${required}`);
  }
}
for (const forbidden of [
  "const desiredTerminalDistance = rotundaOpening.collarRadius + 2.4;",
  "const desiredTerminalDistance = sourceTerminalDistance;",
  "A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "a1Anchor.position.x += terminalRelocationX",
  "a1Anchor.position.z += terminalRelocationZ",
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: stale relocation/bulkhead behavior survived physical Rotunda closure: ${forbidden}`);
  }
}

await import(`./prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=${Date.now()}`);

console.log("Prepared A1 Rotunda/terminal visual acceptance without moving the jetway: the physically articulated Rotunda aperture remains aligned to the structural wall, whole-bridge relocation stays exactly zero, and only the measured short wall-side seam is styled/closed before evidence capture.");
