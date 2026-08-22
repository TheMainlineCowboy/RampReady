import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v2";
const compatibilityMarker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";
const facadeConeMarker = "a1-bgate1-preferred-facade-cone-v3";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";

let placement = fs.readFileSync(placementPath, "utf8");
let installation = fs.readFileSync(installationPath, "utf8");

// The Aug. 15 ramp-level photos show A1 leaving the main apron-facing A1 facade,
// not the perpendicular parking-structure/side wall. The legacy radial fallback
// searched all 360 degrees and simply chose the nearest structural hit, which can
// select that visibly wrong side building at this corner. Constrain A1's fallback
// search to the terminal-facing hemisphere around the source preferred direction.
// A3+ keep the existing unrestricted source wall resolver.
if (!placement.includes(facadeConeMarker)) {
  const signature = "function findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height) {";
  const patchedSignature = `// ${facadeConeMarker}\nfunction findTerminalWallConnection(THREE, terminal, originX, originZ, preferredX, preferredZ, height, minimumPreferredDot = -1) {`;
  if (!placement.includes(signature)) {
    throw new Error(`${placementPath}: terminal wall resolver signature is missing`);
  }
  placement = placement.replace(signature, patchedSignature);

  const radialDirection = `    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));\n    const hit = cast(direction);`;
  const constrainedRadialDirection = `    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));\n    if (direction.dot(preferred) < minimumPreferredDot) continue;\n    const hit = cast(direction);`;
  if (!placement.includes(radialDirection)) {
    throw new Error(`${placementPath}: radial authored-wall search anchor is missing`);
  }
  placement = placement.replace(radialDirection, constrainedRadialDirection);

  const a1Call = `      -uz,\n      rotundaY,\n    ) || {};`;
  const a1ConstrainedCall = `      -uz,\n      rotundaY,\n      jetway.g === "A1" ? 0.5 : -1,\n    ) || {};`;
  if (!placement.includes(a1Call)) {
    throw new Error(`${placementPath}: terminal wall resolver call anchor is missing`);
  }
  placement = placement.replace(a1Call, a1ConstrainedCall);

  // Retire the early hard-coded T4_WALK portal override. It is the exact wrong
  // architectural object for A1 in the user's reference photos and can overwrite
  // the direction/distance even after a correct authored-facade hit was found.
  const legacyWalkwayOverride = `    if (jetway.g === "A1") {\n      const exactWalkwayPortalX = -30.16857013;\n      const exactWalkwayPortalZ = jetway.z;\n      const exactDx = exactWalkwayPortalX - jetway.x;\n      const exactDz = exactWalkwayPortalZ - jetway.z;\n      const exactDistance = Math.hypot(exactDx, exactDz);\n      Object.assign(terminalConnection, {\n        distance: exactDistance,\n        towardX: exactDx / exactDistance,\n        towardZ: exactDz / exactDistance,\n        authority: "exact-T4_WALK-A1-terminal-portal-v25",\n      });\n    }`;
  if (placement.includes(legacyWalkwayOverride)) {
    placement = placement.replace(legacyWalkwayOverride, `    // ${facadeConeMarker}: A1 uses the real authored apron-facing facade hit; no T4_WALK portal override.`);
  }
}

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

  const publicationAnchors = [
    `    const terminalWallDistance = terminalConnection?.distance ?? null;`,
    `    const connectorTowardX = terminalConnection?.towardX ?? -ux;`,
  ];
  const publicationAnchor = publicationAnchors.find((anchor) => placement.includes(anchor));
  if (!publicationAnchor) {
    throw new Error(`${placementPath}: stable terminalConnection publication anchor is missing`);
  }
  const publication = `    // ${marker}\n    // ${compatibilityMarker}\n    // ${frameMarker}\n    // The terminal raycast returns WORLD coordinates while the source-placed\n    // jetway group carries its own scene offset. Convert the exact BGATE1 hit\n    // into that group-local frame without changing A1 yaw, Rotunda, aircraft,\n    // or any supplied Airport_Jetway.glb child transform.\n    if (jetway.g === "A1") {\n      if (!terminalConnection) {\n        throw new Error("A1 original BGATE1 terminalConnection is missing");\n      }\n      const rawWallNormalX = Number(terminalConnection.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9)) {\n        throw new Error(\`A1 original BGATE1 wall normal is invalid: \${rawWallNormalX},\${rawWallNormalZ}\`);\n      }\n      const terminalWallGroupLocalX = Number(terminalConnection.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (![terminalWallGroupLocalX, terminalWallGroupLocalZ].every(Number.isFinite)) {\n        throw new Error("A1 BGATE1 wall world-to-group-local conversion failed");\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;\n      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 BGATE1 wall cannot resolve the authored apron/stand side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }\n${publicationAnchor}`;
  placement = placement.replace(publicationAnchor, publication);

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
  facadeConeMarker,
  "minimumPreferredDot = -1",
  "direction.dot(preferred) < minimumPreferredDot",
  'jetway.g === "A1" ? 0.5 : -1',
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
  "exact-T4_WALK-A1-terminal-portal-v25",
  "const exactWalkwayPortalX = -30.16857013;",
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
console.log(`Prepared ${photoAuthority} explicit BGATE1 wall endpoint through ${facadeConeMarker}: A1 now rejects perpendicular/side-building radial hits and the retired T4_WALK portal override before publishing its real apron-facing facade endpoint.`);
