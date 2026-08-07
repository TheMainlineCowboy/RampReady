import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-local-under-parent-offset-v2";
let source = fs.readFileSync(jetwayPath, "utf8");

// The source-placed jetway GROUP already owns the KPHX +6.2 m Z world offset:
//   group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)
// Therefore each exact Airport_Jetway.glb clone must remain in the original
// BGL-local x/z coordinates. The terminal-wall search is performed against the
// world-positioned terminal and correctly adds sourceOffsetZ to its ray origin;
// applying that same offset to a child placement would double-shift the model.
const unregisteredPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,`;
const sourceLocalPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;

// Repair any transient v1 double-offset form before applying the source-local
// authority. This keeps the preparer idempotent even when invoked more than once
// during the production migration stack.
source = source
  .replace("      z: jetway.z + sourceOffsetZ,", "      z: jetway.z,")
  .replace("      targetZ: targetZ + sourceOffsetZ,", "      targetZ,")
  .replace(/      sourceRegistrationAuthority: "exact-terminal4-jetway-source-registration-plus-6p2z-v1",\n/g, "");

if (!source.includes(SOURCE_REGISTRATION_AUTHORITY)) {
  if (!source.includes(unregisteredPlacement)) {
    throw new Error(`${jetwayPath}: exact uploaded jetway source-local placement anchor is missing`);
  }
  source = source.replace(unregisteredPlacement, sourceLocalPlacement);
}

// A1 must never be redirected to the elevated T4_WALK. Earlier source code had
// a hard-coded exactWalkwayPortalX override which could make telemetry claim a
// connection while the supplied bridge visibly ran underneath the walkway.
const obsoleteWalkwayBlock = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\n      \}\);\n    \}/;
if (obsoleteWalkwayBlock.test(source)) source = source.replace(obsoleteWalkwayBlock, "");

if (source.includes("exact-T4_WALK-A1-terminal-portal-v25") || source.includes("exactWalkwayPortalX")) {
  throw new Error(`${jetwayPath}: obsolete A1 elevated-walkway targeting is still present`);
}

for (const token of [
  `group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)`,
  `const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2]`,
  `jetway.z + sourceOffsetZ`,
  `z: jetway.z,`,
  `targetZ,`,
  SOURCE_REGISTRATION_AUTHORITY,
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: source-local registration contract is missing ${token}`);
  }
}
for (const forbidden of [
  "z: jetway.z + sourceOffsetZ,",
  "targetZ: targetZ + sourceOffsetZ,",
  "exact-terminal4-jetway-source-registration-plus-6p2z-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: double-applied jetway world offset remains: ${forbidden}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(`Prepared all 58 exact Terminal 4 jetways in original BGL-local coordinates under the already +6.2 m Z source-placed parent; terminal wall rays remain world-registered and T4_WALK targeting is forbidden (${SOURCE_REGISTRATION_AUTHORITY}).`);
