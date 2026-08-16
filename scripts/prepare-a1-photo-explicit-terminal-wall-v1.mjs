import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";

let placement = fs.readFileSync(placementPath, "utf8");
let installation = fs.readFileSync(installationPath, "utf8");

// The Aug. 15 A1 photo requires the exact movable jetway to keep its source
// model origin/physical bridge heading, while the real BGATE1 facade still owns
// the terminal endpoint of the long fixed corridor. Publish that wall point and
// its oriented normal into the final placement WITHOUT changing A1 yaw.
if (!placement.includes(marker)) {
  const candidateAnchor = `          pointZ: closest.z,\n          nodeSpanX: nodeSize.x,`;
  const candidatePatch = `          pointZ: closest.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          nodeSpanX: nodeSize.x,`;
  if (!placement.includes(candidateAnchor) && !placement.includes("wallNormalX: normal.x")) {
    throw new Error(`${placementPath}: final structural candidate wall-normal fields are missing`);
  }
  if (placement.includes(candidateAnchor)) placement = placement.replace(candidateAnchor, candidatePatch);

  const normalAnchor = `      terminalConnection.legacyFullHeightValidatorCopiesRemoved = 2;\n    }\n    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
  const normalPatch = `      terminalConnection.legacyFullHeightValidatorCopiesRemoved = 2;\n    }\n    // ${marker}\n    // ${frameMarker}\n    // The terminal raycast returns WORLD coordinates, while uploaded jetway\n    // placement x/z lives in PHX_Terminal4_AIR_Jetway01_SourcePlaced local\n    // coordinates. That group carries sceneOffset Z=+6.2 m. Convert the BGATE1\n    // hit into the placement frame before comparing it with the authored stand or\n    // publishing it for the A1 fixed corridor. Failing to remove this offset made\n    // the real ~9 m wall/Rotunda separation appear as ~4 m and folded the dogleg\n    // back toward a fake near-wall Rotunda.\n    if (jetway.g === "A1") {\n      const rawWallNormalX = Number(terminalConnection?.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection?.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9)) {\n        throw new Error(\`A1 original BGATE1 wall normal is invalid: \${rawWallNormalX},\${rawWallNormalZ}\`);\n      }\n      const terminalWallGroupLocalX = Number(terminalConnection.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (![terminalWallGroupLocalX, terminalWallGroupLocalZ].every(Number.isFinite)) {\n        throw new Error("A1 BGATE1 wall world-to-group-local conversion failed");\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;\n      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 BGATE1 wall cannot resolve the authored apron/stand side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }\n    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
  if (!placement.includes(marker)) {
    if (!placement.includes(normalAnchor)) throw new Error(`${placementPath}: final A1 full-height wall-validation anchor is missing`);
    placement = placement.replace(normalAnchor, normalPatch);
  }

  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  const provenancePatch = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${marker}" : null,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  if (!placement.includes("explicitTerminalWallAuthority")) {
    if (!placement.includes(provenanceAnchor)) throw new Error(`${placementPath}: A1 source-heading provenance anchor is missing`);
    placement = placement.replace(provenanceAnchor, provenancePatch);
  }
}

// Older prepared copies already contain marker v1 but still publish the raw WORLD
// wall coordinates. Upgrade those generated forms idempotently to the group-local
// contract before final bundling.
if (placement.includes(marker) && !placement.includes(frameMarker)) {
  const oldStandX = "      const wallToAuthoredStandX = targetX - Number(terminalConnection.pointX);";
  const oldStandZ = "      const wallToAuthoredStandZ = targetZ - Number(terminalConnection.pointZ);";
  if (!placement.includes(oldStandX) || !placement.includes(oldStandZ)) {
    throw new Error(`${placementPath}: existing A1 explicit-wall preparation has unknown coordinate-frame form`);
  }
  placement = placement.replace(
    oldStandX,
    `      // ${frameMarker}\n      const terminalWallGroupLocalX = Number(terminalConnection.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (![terminalWallGroupLocalX, terminalWallGroupLocalZ].every(Number.isFinite)) {\n        throw new Error("A1 BGATE1 wall world-to-group-local conversion failed");\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;`,
  );
  placement = placement.replace(oldStandZ, "      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;");
  placement = placement.replace(
    '      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointX) : null,',
    '      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointX) : null,',
  );
  placement = placement.replace(
    '      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointZ) : null,',
    `      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,`,
  );
}

if (!installation.includes(marker)) {
  const wallAnchor = `  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;\n  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;`;
  const wallPatch = `  // ${marker}\n  // The wall search already found the exact structural BGATE1 facade point. Use\n  // it as the fixed-corridor terminal endpoint; never project a synthetic point\n  // from the A1 Rotunda or change the supplied jetway yaw to manufacture a fit.\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);\n  const explicitTerminalWallZ = Number(a1Placement.terminalWallZ);\n  if (![explicitTerminalWallX, explicitTerminalWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit measured Terminal 4 wall point is missing from the final placement");\n  }\n  const terminalWallX = explicitTerminalWallX;\n  const terminalWallZ = explicitTerminalWallZ;`;
  if (!installation.includes(wallAnchor) && !installation.includes("explicitTerminalWallX")) {
    throw new Error(`${installationPath}: measured terminal wall projection block is missing`);
  }
  if (installation.includes(wallAnchor)) installation = installation.replace(wallAnchor, wallPatch);
}

for (const required of [
  marker,
  frameMarker,
  "wallNormalX: normal.x",
  "wallNormalZ: normal.z",
  "groupLocalPointX",
  "groupLocalPointZ",
  "terminalWallX: jetway.g === \"A1\"",
  "terminalWallZ: jetway.g === \"A1\"",
  "terminalWallCoordinateAuthority",
  "explicitTerminalWallAuthority",
  'sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1"',
  "yaw: sourceJetwayYaw",
]) {
  if (!placement.includes(required)) throw new Error(`${placementPath}: photo-safe explicit wall contract is missing ${required}`);
}
for (const forbidden of [
  'terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointX)',
  'terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointZ)',
  "const wallToAuthoredStandZ = targetZ - Number(terminalConnection.pointZ);",
  "yaw: physicalPlacementYaw",
  "a1-decoded-kphx-bgl-heading-provenance-only-v2",
]) {
  if (placement.includes(forbidden)) throw new Error(`${placementPath}: photo-safe wall publication retained wrong-frame/heading behavior: ${forbidden}`);
}
for (const required of [marker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
  if (!installation.includes(required)) throw new Error(`${installationPath}: photo-safe wall publication is missing ${required}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log(`Prepared ${photoAuthority} explicit BGATE1 wall endpoint in the source-placed jetway group coordinate frame (${frameMarker}) without changing A1 source position, calibrated bridge heading, aircraft target, or exact supplied jetway child transforms.`);
