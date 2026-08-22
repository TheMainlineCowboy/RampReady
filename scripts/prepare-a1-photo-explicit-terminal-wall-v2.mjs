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

// Aug. 15 photo authority: A1 must resolve against the apron-facing Terminal 4
// facade, never the perpendicular parking-structure/side wall. This script runs
// more than once in production, after other preparers may have already rewritten
// the resolver, so every edit below is deliberately semantic/idempotent.
{
  const resolverMatch = placement.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
  if (!resolverMatch) throw new Error(`${placementPath}: terminal wall resolver signature is missing`);
  if (!resolverMatch[1].includes("minimumPreferredDot")) {
    const args = resolverMatch[1].trim();
    placement = placement.replace(
      resolverMatch[0],
      `// ${facadeConeMarker}\nfunction findTerminalWallConnection(${args}, minimumPreferredDot = -1) {`,
    );
  } else if (!placement.includes(facadeConeMarker)) {
    placement = placement.replace(resolverMatch[0], `// ${facadeConeMarker}\n${resolverMatch[0]}`);
  }

  if (!placement.includes("direction.dot(preferred) < minimumPreferredDot")) {
    const radialPattern = /(const direction = new THREE\.Vector3\(Math\.sin\(angle\), 0, Math\.cos\(angle\)\);\s*)(const hit = cast\(direction\);)/;
    if (!radialPattern.test(placement)) throw new Error(`${placementPath}: radial authored-wall search anchor is missing`);
    placement = placement.replace(
      radialPattern,
      `$1if (direction.dot(preferred) < minimumPreferredDot) continue;\n    $2`,
    );
  }

  // Add the A1-only cone threshold at the main per-gate resolver call. Preserve
  // all other gates' unrestricted fallback behavior.
  if (!placement.includes('jetway.g === "A1" ? 0.5 : -1')) {
    const callPattern = /(const terminalConnection = findTerminalWallConnection\([\s\S]*?\n\s*-uz,\n\s*rotundaY,)(\n\s*\) \|\| \{\};)/;
    if (!callPattern.test(placement)) throw new Error(`${placementPath}: terminal wall resolver call anchor is missing`);
    placement = placement.replace(callPattern, `$1\n      jetway.g === "A1" ? 0.5 : -1,$2`);
  }

  // Remove the legacy T4_WALK portal override if it still exists in any generated
  // pass. This exact override is visibly the wrong building relationship at A1.
  placement = placement.replace(
    /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/,
    `\n    // ${facadeConeMarker}: A1 keeps the authored apron-facing facade hit; no T4_WALK portal override.`,
  );
}

// Publish structural wall normals when the richer structural candidate pass is
// present. Earlier/later generated variants may already contain these fields.
if (!placement.includes("wallNormalX: normal.x") || !placement.includes("wallNormalZ: normal.z")) {
  const candidateAnchor = `          pointZ: closest.z,\n          nodeSpanX: nodeSize.x,`;
  if (placement.includes(candidateAnchor)) {
    placement = placement.replace(
      candidateAnchor,
      `          pointZ: closest.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          nodeSpanX: nodeSize.x,`,
    );
  }
}

// Publish the exact A1 terminal facade point in source-group local coordinates.
if (!placement.includes(marker)) {
  const publicationAnchors = [
    `    const terminalWallDistance = terminalConnection?.distance ?? null;`,
    `    const connectorTowardX = terminalConnection?.towardX ?? -ux;`,
  ];
  const publicationAnchor = publicationAnchors.find((anchor) => placement.includes(anchor));
  if (!publicationAnchor) throw new Error(`${placementPath}: stable terminalConnection publication anchor is missing`);

  const publication = `    // ${marker}\n    // ${compatibilityMarker}\n    // ${frameMarker}\n    if (jetway.g === "A1") {\n      if (!terminalConnection) throw new Error("A1 authored terminalConnection is missing");\n      const terminalWallGroupLocalX = Number(terminalConnection.pointX ?? (jetway.x + terminalConnection.towardX * terminalConnection.distance))\n        - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection.pointZ ?? (jetway.z + sourceOffsetZ + terminalConnection.towardZ * terminalConnection.distance))\n        - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (![terminalWallGroupLocalX, terminalWallGroupLocalZ].every(Number.isFinite)) {\n        throw new Error("A1 Terminal 4 wall world-to-group-local conversion failed");\n      }\n      let rawWallNormalX = Number(terminalConnection.wallNormalX);\n      let rawWallNormalZ = Number(terminalConnection.wallNormalZ);\n      if (!(Number.isFinite(rawWallNormalX) && Number.isFinite(rawWallNormalZ) && Math.hypot(rawWallNormalX, rawWallNormalZ) > 0.5)) {\n        rawWallNormalX = -Number(terminalConnection.towardX);\n        rawWallNormalZ = -Number(terminalConnection.towardZ);\n      }\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToStandX = targetX - terminalWallGroupLocalX;\n      const wallToStandZ = targetZ - terminalWallGroupLocalZ;\n      if (apronNormalX * wallToStandX + apronNormalZ * wallToStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }\n${publicationAnchor}`;
  placement = placement.replace(publicationAnchor, publication);
}

// Generated source variants later in the chain expose resolvedTerminalConnection
// placement telemetry. Add the explicit wall fields when that provenance object is
// present, but do not fail early source variants that have not generated it yet.
if (!placement.includes("explicitTerminalWallAuthorityV2")) {
  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  if (placement.includes(provenanceAnchor)) {
    const provenancePatch = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${compatibilityMarker}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${marker}" : null,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
    placement = placement.replace(provenanceAnchor, provenancePatch);
  }
}

// Final installation must use the explicit measured wall endpoint whenever the
// late placement telemetry exists. Stay idempotent across repeated preparers.
if (!installation.includes(marker)) {
  const wallAnchor = `  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;\n  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;`;
  if (installation.includes(wallAnchor)) {
    installation = installation.replace(
      wallAnchor,
      `  // ${marker}\n  // ${compatibilityMarker}\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);\n  const explicitTerminalWallZ = Number(a1Placement.terminalWallZ);\n  if (![explicitTerminalWallX, explicitTerminalWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit measured Terminal 4 wall point is missing from the final placement");\n  }\n  const terminalWallX = explicitTerminalWallX;\n  const terminalWallZ = explicitTerminalWallZ;`,
    );
  } else if (installation.includes("const explicitTerminalWallX = Number(a1Placement.terminalWallX);")) {
    installation = installation.replace(
      "const explicitTerminalWallX = Number(a1Placement.terminalWallX);",
      `// ${marker}\n  // ${compatibilityMarker}\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);`,
    );
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
  "groupLocalPointX",
  "groupLocalPointZ",
]) {
  if (!placement.includes(required)) throw new Error(`${placementPath}: photo-safe explicit wall contract is missing ${required}`);
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "const exactWalkwayPortalX = -30.16857013;",
]) {
  if (placement.includes(forbidden)) throw new Error(`${placementPath}: wrong A1 terminal override survived: ${forbidden}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log(`Prepared ${photoAuthority} through ${facadeConeMarker}: A1 wall repair is repeat-safe, rejects side-building/T4_WALK fallbacks, and preserves A3+ wall resolution.`);
