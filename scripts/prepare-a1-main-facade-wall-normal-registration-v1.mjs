import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-main-facade-wall-normal-registration-v1";

let placement = fs.readFileSync(placementPath, "utf8");
let installation = fs.readFileSync(installationPath, "utf8");

if (!placement.includes(marker)) {
  const candidateAnchor = `          pointZ: closest.z,\n          nodeSpanX: nodeSize.x,`;
  const candidatePatch = `          pointZ: closest.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          nodeSpanX: nodeSize.x,`;
  if (!placement.includes(candidateAnchor)) {
    throw new Error(`${placementPath}: final structural candidate point fields are missing`);
  }
  placement = placement.replace(candidateAnchor, candidatePatch);

  const normalAnchor = `      terminalConnection.legacyFullHeightValidatorCopiesRemoved = 2;\n    }\n    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
  const normalPatch = `      terminalConnection.legacyFullHeightValidatorCopiesRemoved = 2;\n    }\n    // ${marker}\n    // AIR_Jetway01 BGL x/z and heading remain source provenance only. Once the\n    // original BGATE1 wall is identified, the wall triangle owns the replacement\n    // Rotunda side. Orient its horizontal normal toward the authored A1 stand,\n    // then use the opposite direction for the short terminal-side leg.\n    if (jetway.g === "A1") {\n      const rawWallNormalX = Number(terminalConnection?.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection?.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9)) {\n        throw new Error(\`A1 original BGATE1 wall normal is invalid: \${rawWallNormalX},\${rawWallNormalZ}\`);\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - Number(terminalConnection.pointX);\n      const wallToAuthoredStandZ = targetZ - Number(terminalConnection.pointZ);\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 BGATE1 wall cannot resolve the authored apron/stand side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "a1-original-bgateg1-wall-normal-to-authored-apron-v1";\n    }\n    // static-bgl-heading-terminal-search-v2-non-a1-resolved`;
  if (!placement.includes(normalAnchor)) {
    throw new Error(`${placementPath}: final A1 full-height wall-validation anchor is missing`);
  }
  placement = placement.replace(normalAnchor, normalPatch);

  const connectorAnchor = `    const connectorTowardX = resolvedTerminalConnection?.towardX ?? (jetway.g === "A1" ? -ux : terminalPreferredX);\n    const connectorTowardZ = resolvedTerminalConnection?.towardZ ?? (jetway.g === "A1" ? -uz : terminalPreferredZ);\n    const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ);`;
  const connectorPatch = `    const connectorTowardX = jetway.g === "A1"\n      ? Number(resolvedTerminalConnection?.terminalNormalX)\n      : (resolvedTerminalConnection?.towardX ?? terminalPreferredX);\n    const connectorTowardZ = jetway.g === "A1"\n      ? Number(resolvedTerminalConnection?.terminalNormalZ)\n      : (resolvedTerminalConnection?.towardZ ?? terminalPreferredZ);\n    if (jetway.g === "A1" && ![connectorTowardX, connectorTowardZ].every(Number.isFinite)) {\n      throw new Error("A1 main-terminal wall normal did not reach final placement");\n    }\n    const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ);\n    const physicalPlacementYaw = jetway.g === "A1"\n      ? Math.atan2(Number(resolvedTerminalConnection.apronNormalX), Number(resolvedTerminalConnection.apronNormalZ))\n      : sourceJetwayYaw;`;
  if (!placement.includes(connectorAnchor)) {
    throw new Error(`${placementPath}: final connector direction block is missing`);
  }
  placement = placement.replace(connectorAnchor, connectorPatch);

  if (!placement.includes(`      yaw: sourceJetwayYaw,\n      targetX,`)) {
    throw new Error(`${placementPath}: uploaded placement yaw field is missing`);
  }
  placement = placement.replace(
    `      yaw: sourceJetwayYaw,\n      targetX,`,
    `      yaw: physicalPlacementYaw,\n      targetX,`,
  );

  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  const provenancePatch = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-provenance-only-v2" : "57-static-bgl-jetway-heading-provenance-v3",\n      physicalYawAuthority: jetway.g === "A1" ? "a1-original-bgateg1-wall-normal-to-authored-apron-v1" : "decoded-kphx-static-source-heading",\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.pointZ) : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,`;
  if (!placement.includes(provenanceAnchor)) {
    throw new Error(`${placementPath}: A1 source-heading provenance fields are missing`);
  }
  placement = placement.replace(provenanceAnchor, provenancePatch);

  const evidenceAnchor = `      a1TerminalConnectionDirection = terminalConnection\n        ? [terminalConnection.towardX, terminalConnection.towardZ]\n        : null;`;
  const evidencePatch = `      a1TerminalConnectionDirection = terminalConnection\n        ? [terminalConnection.terminalNormalX, terminalConnection.terminalNormalZ]\n        : null;`;
  if (!placement.includes(evidenceAnchor)) {
    throw new Error(`${placementPath}: A1 terminal-direction evidence block is missing`);
  }
  placement = placement.replace(evidenceAnchor, evidencePatch);
}

if (!installation.includes(marker)) {
  const wallAnchor = `  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;\n  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;`;
  const wallPatch = `  // ${marker}\n  // Use the exact selected BGATE1 wall point. The raw AIR_Jetway01 model pivot\n  // is retained only as provenance and must not be projected along the new wall\n  // normal to manufacture a different terminal point.\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);\n  const explicitTerminalWallZ = Number(a1Placement.terminalWallZ);\n  const terminalWallX = Number.isFinite(explicitTerminalWallX)\n    ? explicitTerminalWallX\n    : a1Placement.x + terminalDirection.x * sourceTerminalDistance;\n  const terminalWallZ = Number.isFinite(explicitTerminalWallZ)\n    ? explicitTerminalWallZ\n    : a1Placement.z + terminalDirection.z * sourceTerminalDistance;`;
  if (!installation.includes(wallAnchor)) {
    throw new Error(`${installationPath}: measured terminal wall projection block is missing`);
  }
  installation = installation.replace(wallAnchor, wallPatch);
}

for (const required of [
  marker,
  "wallNormalX: normal.x",
  "wallNormalZ: normal.z",
  'wallNormalAuthority = "a1-original-bgateg1-wall-normal-to-authored-apron-v1"',
  "yaw: physicalPlacementYaw",
  "terminalWallX: jetway.g === \"A1\"",
  "apronWallNormalX: jetway.g === \"A1\"",
]) {
  if (!placement.includes(required)) {
    throw new Error(`${placementPath}: wall-normal registration is missing ${required}`);
  }
}
for (const required of [marker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
  if (!installation.includes(required)) {
    throw new Error(`${installationPath}: wall-normal registration is missing ${required}`);
  }
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log("Prepared A1 from the original BGATE1 wall point and its apron-facing source normal; raw BGL x/z/heading remain provenance only and the exact supplied GLB stays untouched.");
