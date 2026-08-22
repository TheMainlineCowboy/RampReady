import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v2";
const compatibilityMarker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";
const facadeConeMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";

let placement = fs.readFileSync(placementPath, "utf8");
let installation = fs.readFileSync(installationPath, "utf8");

// Aug. 15 photo authority: A1 must resolve against the apron-facing Terminal 4
// facade, never the perpendicular parking-structure/side wall. Do this inside the
// resolver from A1's exact source origin so later preparers can freely rewrite the
// call site without silently removing the A1-only cone. A3+ remain unrestricted.
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

  const preferredAnchor = "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();";
  const ownershipMarker = "a1OriginIsExactA1";
  if (!placement.includes(ownershipMarker)) {
    if (!placement.includes(preferredAnchor)) throw new Error(`${placementPath}: preferred wall direction anchor is missing`);
    placement = placement.replace(
      preferredAnchor,
      `${preferredAnchor}\n  // ${facadeConeMarker}: infer A1 from the exact decoded AIR_Jetway01 source pivot.\n  // sourcePlacedTerminal4Jetways passes originZ after the profile's +6.2 m scene offset.\n  const a1OriginIsExactA1 = Math.hypot(\n    originX - (-21.01),\n    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),\n  ) <= 0.75;\n  const effectiveMinimumPreferredDot = a1OriginIsExactA1\n    ? Math.max(Number(minimumPreferredDot), 0.5)\n    : Number(minimumPreferredDot);`,
    );
  }

  // Normalize any earlier v5 guards to the origin-owned effective threshold.
  placement = placement
    .replaceAll("minimumPreferredDot > -1 && direction.dot(preferred) < minimumPreferredDot", "effectiveMinimumPreferredDot > -1 && direction.dot(preferred) < effectiveMinimumPreferredDot")
    .replaceAll("minimumPreferredDot > -1 && ((dx * preferred.x + dz * preferred.z) / distance) < minimumPreferredDot", "effectiveMinimumPreferredDot > -1 && ((dx * preferred.x + dz * preferred.z) / distance) < effectiveMinimumPreferredDot");

  const castConeGuard = "effectiveMinimumPreferredDot > -1 && direction.dot(preferred) < effectiveMinimumPreferredDot";
  if (!placement.includes(`if (${castConeGuard}) return null;`)) {
    const castPatterns = [
      /(const cast = \(direction, far = 48\) => \{\s*)/,
      /(const cast = \(direction, far = [0-9.]+\) => \{\s*)/,
      /(const [A-Za-z0-9_]*cast[A-Za-z0-9_]* = \(direction, far = [0-9.]+\) => \{\s*)/,
    ];
    const castPattern = castPatterns.find((pattern) => pattern.test(placement));
    if (castPattern) placement = placement.replace(castPattern, `$1if (${castConeGuard}) return null;\n    `);
  }

  const radialGuard = `if (${castConeGuard}) continue;`;
  if (!placement.includes(radialGuard)) {
    const directionPattern = /(const direction = new THREE\.Vector3\([^;]+\);)/;
    if (directionPattern.test(placement)) placement = placement.replace(directionPattern, `$1\n    ${radialGuard}`);
  }

  const vertexConeGuard = "effectiveMinimumPreferredDot > -1 && ((dx * preferred.x + dz * preferred.z) / distance) < effectiveMinimumPreferredDot";
  if (!placement.includes(vertexConeGuard)) {
    const vertexDistancePattern = /(const distance = Math\.hypot\(dx, dz\);)/;
    if (vertexDistancePattern.test(placement)) {
      placement = placement.replace(
        vertexDistancePattern,
        `$1\n      if (distance > 0.05 && ${vertexConeGuard}) continue;`,
      );
    }
  }

  // Remove the legacy T4_WALK portal override on every generated pass. This was
  // the wrong building relationship visible in the user's screenshots.
  placement = placement.replace(
    /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/,
    `\n    // ${facadeConeMarker}: A1 keeps the authored apron-facing facade hit; no T4_WALK portal override.`,
  );
}

if (!placement.includes("wallNormalX: normal.x") || !placement.includes("wallNormalZ: normal.z")) {
  const candidateAnchor = `          pointZ: closest.z,\n          nodeSpanX: nodeSize.x,`;
  if (placement.includes(candidateAnchor)) {
    placement = placement.replace(
      candidateAnchor,
      `          pointZ: closest.z,\n          wallNormalX: normal.x,\n          wallNormalZ: normal.z,\n          nodeSpanX: nodeSize.x,`,
    );
  }
}

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

if (!placement.includes("explicitTerminalWallAuthorityV2")) {
  const provenanceAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`;
  if (placement.includes(provenanceAnchor)) {
    placement = placement.replace(
      provenanceAnchor,
      `      sourceJetwayYawRadians: sourceJetwayYaw,\n      terminalWallX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(resolvedTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${compatibilityMarker}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${marker}" : null,\n      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",`,
    );
  }
}

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

const hasConeGuard = placement.includes("effectiveMinimumPreferredDot > -1 && direction.dot(preferred) < effectiveMinimumPreferredDot")
  || placement.includes("((dx * preferred.x + dz * preferred.z) / distance) < effectiveMinimumPreferredDot");
for (const required of [
  marker,
  compatibilityMarker,
  frameMarker,
  facadeConeMarker,
  "minimumPreferredDot = -1",
  "a1OriginIsExactA1",
  "effectiveMinimumPreferredDot",
  "groupLocalPointX",
  "groupLocalPointZ",
]) {
  if (!placement.includes(required)) throw new Error(`${placementPath}: photo-safe explicit wall contract is missing ${required}`);
}
if (!hasConeGuard) throw new Error(`${placementPath}: A1 facade cone guard is missing`);
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "const exactWalkwayPortalX = -30.16857013;",
]) {
  if (placement.includes(forbidden)) throw new Error(`${placementPath}: wrong A1 terminal override survived: ${forbidden}`);
}

fs.writeFileSync(placementPath, placement, "utf8");
fs.writeFileSync(installationPath, installation, "utf8");
console.log(`Prepared ${photoAuthority} through ${facadeConeMarker}: A1 facade ownership is resolver-local and generation-order safe; A3+ remain unrestricted.`);
