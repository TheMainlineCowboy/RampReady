import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-registration-plus-6p2z-v1";
let source = fs.readFileSync(jetwayPath, "utf8");

// Terminal 4, the KPHX ground, the training aircraft and the original source
// jetway records all share the same A1-relative frame. The browser world adds
// +6.2 m on Z (NOSE_START_Z and the authored Terminal 4 placement both use it).
// The terminal-wall search already applied that offset, but the exact uploaded
// jetway anchors did not. That put all 58 supplied bridges 6.2 m out of
// registration with the terminal openings while still allowing connector tests
// to report a wall hit.
const placementBefore = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,`;
const placementAfter = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z + sourceOffsetZ,
      yaw,
      targetX,
      targetZ: targetZ + sourceOffsetZ,
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;

if (!source.includes(SOURCE_REGISTRATION_AUTHORITY)) {
  if (!source.includes(placementBefore)) {
    throw new Error(`${jetwayPath}: exact uploaded jetway placement anchor is missing`);
  }
  source = source.replace(placementBefore, placementAfter);
}

// A1 must never be redirected to the elevated T4_WALK. Earlier source code had
// a hard-coded exactWalkwayPortalX override which could make telemetry claim a
// connection while the supplied bridge visibly ran under the walkway.
const obsoleteWalkwayBlock = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\n      \}\);\n    \}/;
if (obsoleteWalkwayBlock.test(source)) {
  source = source.replace(obsoleteWalkwayBlock, "");
}

if (source.includes("exact-T4_WALK-A1-terminal-portal-v25") || source.includes("exactWalkwayPortalX")) {
  throw new Error(`${jetwayPath}: obsolete A1 elevated-walkway targeting is still present`);
}

for (const token of [
  `z: jetway.z + sourceOffsetZ`,
  `targetZ: targetZ + sourceOffsetZ`,
  SOURCE_REGISTRATION_AUTHORITY,
  `const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2]`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: source registration fix is missing ${token}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(`Prepared all 58 exact Terminal 4 jetways in the same +6.2 m Z world frame as the authored terminal, KPHX ground and A1 training aircraft; elevated T4_WALK targeting is forbidden (${SOURCE_REGISTRATION_AUTHORITY}).`);
