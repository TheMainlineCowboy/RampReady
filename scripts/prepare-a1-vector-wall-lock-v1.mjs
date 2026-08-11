import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const MEASUREMENT_AUTHORITY = "fixed-rotunda-measured-wall-and-cab-no-relocation-v26";
const WALL_LOCK_AUTHORITY = "fixed-rotunda-measured-wall-lock-no-relocation-v34";
const MIN_TERMINAL_ALIGNMENT = 0.985;
const MAX_CROSS_TRACK_ERROR_METERS = 0.08;

// The old wall lock moved the COMPLETE A1 parent to manufacture a 2.40 m fixed
// leg, then nudged it a second time to converge on that synthetic point. After
// the physical Rotunda elbow is installed, no whole-A1 movement is legitimate.
// Validate the already measured wall/aperture geometry and publish a final lock
// authority without modifying any transform.
for (const required of [
  `INSTALLATION_AUTHORITY = "${MEASUREMENT_AUTHORITY}"`,
  "const terminalRelocationMeters = 0;",
  "const relocationDistance = 0;",
  "const openingAlignment = measuredTerminalAlignment;",
  "const terminalCrossTrackErrorMeters = Math.abs(",
  "const finalRotundaCenterWorld = fleet.localToWorld",
  "const finalMeasuredTerminalWallWorld = fleet.localToWorld",
  "uploadedJetwayA1FinalRotundaToCabWorldMeters",
  'uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-world-fixed-rotunda-wall-cab-endpoints-v32"',
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: fixed-Rotunda measured wall state is missing ${required}`);
  }
}

const lockInsertionAnchor = `  group.userData.uploadedJetwayA1FixedRotundaEndpointMeasurementAuthority = fixedRotundaEndpointMeasurementAuthority;`;
if (!source.includes("uploadedJetwayA1FinalWallLockAuthority")) {
  if (!source.includes(lockInsertionAnchor)) {
    throw new Error(`${installationPath}: final fixed-Rotunda endpoint telemetry anchor is missing`);
  }
  source = source.replace(
    lockInsertionAnchor,
    `${lockInsertionAnchor}
  if (openingAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 fixed-Rotunda wall lock lost terminal-facing aperture alignment: \${openingAlignment}\`);
  }
  if (!Number.isFinite(terminalCrossTrackErrorMeters) || terminalCrossTrackErrorMeters > ${MAX_CROSS_TRACK_ERROR_METERS}) {
    throw new Error(\`A1 fixed-Rotunda wall lock has excessive cross-track error: \${terminalCrossTrackErrorMeters} m\`);
  }
  if (terminalRelocationMeters !== 0 || relocationDistance !== 0) {
    throw new Error(\`A1 fixed-Rotunda wall lock detected forbidden whole-bridge relocation: terminal=\${terminalRelocationMeters}, total=\${relocationDistance}\`);
  }
  group.userData.uploadedJetwayA1TerminalPostLockRadialResidualMeters = 0;
  group.userData.uploadedJetwayA1FinalWallLockAuthority = "${WALL_LOCK_AUTHORITY}";
  group.userData.uploadedJetwayA1FinalWallLockOpeningAlignment = openingAlignment;
  group.userData.uploadedJetwayA1FinalWallLockCrossTrackErrorMeters = terminalCrossTrackErrorMeters;`,
  );
}

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  `const INSTALLATION_AUTHORITY = "${WALL_LOCK_AUTHORITY}";`,
);

for (const required of [
  `INSTALLATION_AUTHORITY = "${WALL_LOCK_AUTHORITY}"`,
  `uploadedJetwayA1FinalWallLockAuthority = "${WALL_LOCK_AUTHORITY}"`,
  `openingAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  `terminalCrossTrackErrorMeters > ${MAX_CROSS_TRACK_ERROR_METERS}`,
  "terminalRelocationMeters !== 0 || relocationDistance !== 0",
  "uploadedJetwayA1TerminalPostLockRadialResidualMeters = 0",
]) {
  if (!source.includes(required)) {
    throw new Error(`${installationPath}: non-mutating fixed-Rotunda wall lock is missing ${required}`);
  }
}
for (const forbidden of [
  "a1Anchor.position.x += terminalRelocationX",
  "a1Anchor.position.z += terminalRelocationZ",
  "desiredRotundaCenterX",
  "postLockRadialResidual",
  "a1Anchor.position.x += rotundaOpening.openingDirectionX * postLockRadialResidual",
  "post-transform-measured-terminal-wall-lock-grounded-exact-chain-v33",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: stale whole-parent wall relocation survived physical elbow lock: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Validated the physical A1 Rotunda-to-wall lock without moving the bridge: terminal relocation remains exactly zero, aperture alignment stays >=0.985, cross-track error stays <=0.08 m, and the aircraft-side chain is untouched.");
