import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v1";
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
  const normalPatch = `      terminalConnection.legacyFullHeightValidatorCopiesRemoved = 2;\n    }\n    // ${marker}\n    // Keep the source A1 bridge yaw untouched. Orient only the selected facade\n    // normal so later code can distinguish terminal and apron half-planes and\n    // expose the exact BGATE1 wall endpoint for fixed-corridor construction.\n    if (jetway.g === "A1") {\n      const rawWallNormalX = Number(terminalConnection?.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection?.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9)) {\n        throw new Error(\`A1 original BGATE1 wall normal is invalid: \${rawWallNormalX},\${rawWallNormalZ}\`);\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - Number(terminalConnection.pointX);\n      const wallToAuthoredStandZ = targetZ - Number(terminalConnection.pointZ);\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 BGATE1 wall cannot resolve the authored apron/stand side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }\n    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
  if (!placement.includes(marker)) {
    if (!placement.includes(normalAnchor)) throw new Error(`${placementPath}: final A1 full-height wall-validation anchor is missing`);
    placement = placement.replace(normalAnchor, normalPatch);
  }

  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  const provenancePatch = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointZ) : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${marker}" : null,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  if (!placement.includes("explicitTerminalWallAuthority")) {
    if (!placement.includes(provenanceAnchor)) throw new Error(`${placementPath}: A1 source-heading provenance anchor is missing`);
    placement = placement.replace(provenanceAnchor, provenancePatch);
  }
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
  "wallNormalX: normal.x",
  "wallNormalZ: normal.z",
  "terminalWallX: jetway.g === \"A1\"",
  "terminalWallZ: jetway.g === \"A1\"",
  "explicitTerminalWallAuthority",
  'sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1"',
  "yaw: sourceJetwayYaw",
]) {
  if (!placement.includes(required)) throw new Error(`${placementPath}: photo-safe explicit wall contract is missing ${required}`);
}
for (const forbidden of [
  "yaw: physicalPlacementYaw",
  "a1-decoded-kphx-bgl-heading-provenance-only-v2",
]) {
  if (placement.includes(forbidden)) throw new Error(`${placementPath}: photo-safe wall publication changed A1 heading ownership: ${forbidden}`);
}
for (const required of [marker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
  if (!installation.includes(required)) throw new Error(`${installationPath}: photo-safe wall publication is missing ${required}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log(`Prepared ${photoAuthority} explicit BGATE1 wall endpoint without changing A1 source position, calibrated bridge heading, aircraft target, or exact supplied jetway child transforms.`);
