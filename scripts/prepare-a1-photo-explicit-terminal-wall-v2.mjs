import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v2";
const compatibilityMarker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";

let placement = fs.readFileSync(placementPath, "utf8");
let installation = fs.readFileSync(installationPath, "utf8");

// Publish the real BGATE1 facade hit at a stable point in the per-gate loop.
// Older versions anchored this to a legacy validator-copy comment that newer
// source-wall ownership passes intentionally remove. The terminalConnection
// object itself is the physical authority and survives those passes.
if (!placement.includes(marker)) {
  const candidateAnchor = `          pointZ: closest.z,\n          nodeSpanX: nodeSize.x,`;
  const candidatePatch = `          pointZ: closest.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          nodeSpanX: nodeSize.x,`;
  if (placement.includes(candidateAnchor)) {
    placement = placement.replace(candidateAnchor, candidatePatch);
  }
  if (!placement.includes("wallNormalX: normal.x") || !placement.includes("wallNormalZ: normal.z")) {
    throw new Error(`${placementPath}: structural candidate wall-normal fields are missing`);
  }

  const stableAnchor = `    const terminalWallDistance = terminalConnection?.distance ?? null;`;
  if (!placement.includes(stableAnchor)) {
    throw new Error(`${placementPath}: stable terminalConnection publication anchor is missing`);
  }
  const publication = `    // ${marker}\n    // ${compatibilityMarker}\n    // ${frameMarker}\n    // The terminal raycast returns WORLD coordinates while the source-placed\n    // jetway group carries its own scene offset. Convert the exact BGATE1 hit\n    // into that group-local frame without changing A1 yaw, Rotunda, aircraft,\n    // or any supplied Airport_Jetway.glb child transform.\n    if (jetway.g === "A1") {\n      const rawWallNormalX = Number(terminalConnection?.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection?.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9)) {\n        throw new Error(\`A1 original BGATE1 wall normal is invalid: \${rawWallNormalX},\${rawWallNormalZ}\`);\n      }\n      const terminalWallGroupLocalX = Number(terminalConnection.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (![terminalWallGroupLocalX, terminalWallGroupLocalZ].every(Number.isFinite)) {\n        throw new Error("A1 BGATE1 wall world-to-group-local conversion failed");\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;\n      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 BGATE1 wall cannot resolve the authored apron/stand side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }\n${stableAnchor}`;
  placement = placement.replace(stableAnchor, publication);

  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  const provenancePatch = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${compatibilityMarker}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${marker}" : null,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  if (!placement.includes("explicitTerminalWallAuthorityV2")) {
    if (!placement.includes(provenanceAnchor)) {
      throw new Error(`${placementPath}: A1 source-heading provenance anchor is missing`);
    }
    placement = placement.replace(provenanceAnchor, provenancePatch);
  }
}

if (!installation.includes(marker)) {
  const wallAnchor = `  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;\n  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;`;
  const alreadyExplicit = installation.includes("const explicitTerminalWallX = Number(a1Placement.terminalWallX);");
  if (installation.includes(wallAnchor)) {
    const wallPatch = `  // ${marker}\n  // ${compatibilityMarker}\n  // Use the exact source-placement BGATE1 facade point as the fixed-corridor\n  // terminal endpoint; never project a synthetic wall from the Rotunda.\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);\n  const explicitTerminalWallZ = Number(a1Placement.terminalWallZ);\n  if (![explicitTerminalWallX, explicitTerminalWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit measured Terminal 4 wall point is missing from the final placement");\n  }\n  const terminalWallX = explicitTerminalWallX;\n  const terminalWallZ = explicitTerminalWallZ;`;
    installation = installation.replace(wallAnchor, wallPatch);
  } else if (alreadyExplicit) {
    installation = installation.replace(
      "const explicitTerminalWallX = Number(a1Placement.terminalWallX);",
      `// ${marker}\n  // ${compatibilityMarker}\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);`,
    );
  } else {
    throw new Error(`${installationPath}: measured terminal wall projection block is missing`);
  }
}

for (const required of [
  marker,
  compatibilityMarker,
  frameMarker,
  "wallNormalX: normal.x",
  "wallNormalZ: normal.z",
  "groupLocalPointX",
  "groupLocalPointZ",
  "terminalWallX: jetway.g === \"A1\"",
  "terminalWallZ: jetway.g === \"A1\"",
  "terminalWallCoordinateAuthority",
  "explicitTerminalWallAuthority",
  "explicitTerminalWallAuthorityV2",
  'sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1"',
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
for (const required of [marker, compatibilityMarker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
  if (!installation.includes(required)) throw new Error(`${installationPath}: photo-safe wall publication is missing ${required}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log(`Prepared ${photoAuthority} explicit BGATE1 wall endpoint through stable terminalConnection publication (${marker}); the A1 photo corridor remains real-wall anchored without changing Terminal 4, aircraft placement, or exact supplied jetway child transforms.`);
