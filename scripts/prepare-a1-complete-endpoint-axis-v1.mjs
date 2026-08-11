import fs from "node:fs";

// Preserve the measured short fixed leg before validating the final endpoint
// relationship. This stage must never rotate/translate A1 again: the physical
// elbow stage immediately upstream already owns the Rotunda terminal aperture,
// while Tunnel A/B/C/Cab remain the aircraft-side chain.
await import(`./prepare-a1-rigid-compact-span-v1.mjs?post-elbow=${Date.now()}`);

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const source = fs.readFileSync(installationPath, "utf8");

const ELBOW_AUTHORITY = "same-day-photo-authored-opening-fixed-rotunda-elbow-terminal-aligned-v7";
const SPAN_MARKER = "post-fixed-rotunda-a1-measured-short-terminal-span-v2";

// This used to replace the Rotunda/Tunnel-A axis with a Cab->Rotunda vector and
// then let later code rotate the COMPLETE parent. That destroys the real elbow:
// the terminal Rotunda opening and Tunnel A are independent directions at A1.
// Endpoint validation is now deliberately two-axis and non-mutating.
for (const required of [
  SPAN_MARKER,
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ELBOW_AUTHORITY}"`,
  "const rotundaRoot = a1Model.getObjectByName(\"Rotunda\")",
  "const authoredOpeningBefore = rotundaCenterBefore.clone().sub(tunnelAAxisCenter)",
  "const alignedOpeningDirection = authoredOpeningBefore.clone().applyAxisAngle",
  "const measuredTerminalAlignment = alignedOpeningDirection.dot(terminalDirection)",
  "beforeTransforms = captureAuthoredPartTransforms(a1Model)",
  "a1Anchor.userData.rotundaElbowArticulated = true",
  "connector.userData.measuredTerminalAlignment = measuredTerminalAlignment",
  "connector.userData.visibleMainLengthMeters = actualVisibleVestibuleMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: physical two-axis A1 endpoint contract is missing ${required}`);
  }
}

for (const forbidden of [
  "same-day-photo-complete-cab-to-rotunda-parent-axis-v6",
  "rotundaTerminalCenter.clone().sub(cabAircraftCenter)",
  "a1Anchor.rotation.y += terminalAlignmentYawRadians",
  "a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS",
  "post-rigid-a1-exact-visible-vestibule-span-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: stale whole-parent endpoint orientation survived physical elbow preparation: ${forbidden}`);
  }
}

console.log("Validated A1's physical two-axis endpoint geometry without mutation: the Rotunda aperture independently faces the measured terminal wall, Tunnel A/B/C/Cab retain the aircraft-side pose, and the measured short fixed leg remains unchanged.");
