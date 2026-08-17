// Compatibility entrypoint retained for existing production call sites.
// Prefer the v2 publisher. If late production preparers have legitimately
// rewritten the original terminalConnection publication, re-resolve the SAME
// real BGATE1 wall at the stable per-gate placement stage instead of stopping.
import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v2";
const compatibilityMarker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";
const fallbackMarker = "a1-late-bgate1-direct-reresolution-v4-ray-hit";

try {
  await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);
} catch (error) {
  const message = String(error?.message || error);
  if (!message.includes("stable terminalConnection publication anchor is missing")) throw error;

  let placement = fs.readFileSync(placementPath, "utf8");
  let installation = fs.readFileSync(installationPath, "utf8");

  if (!placement.includes("function findTerminalWallConnection")) {
    throw new Error(`${placementPath}: fallback cannot find authored terminal-wall resolver`);
  }

  if (!placement.includes(marker)) {
    // Do not depend on the old terminalConnection variable surviving every late
    // preparer. Resolve the physical wall again from the same authored terminal
    // mesh, at the same A1 source pivot/height, immediately before the stable
    // uploaded-placement publication. findTerminalWallConnection deliberately
    // returns a ray distance + direction, not a hit.point or face normal. Recover
    // the exact hit point from origin + normalized ray * distance; the opposite
    // ray direction is the apron-facing half-plane because the ray originates at
    // the authored A1 stand and travels toward the terminal. This is read-only
    // geometry discovery: Terminal 4, aircraft, Rotunda and supplied GLB children
    // remain fixed.
    const placementAnchor = "    uploadedJetwayPlacements.push({";
    if (!placement.includes(placementAnchor)) {
      throw new Error(`${placementPath}: fallback cannot find stable uploaded placement publication`);
    }

    const directResolution = `    // ${marker}\n    // ${compatibilityMarker}\n    // ${frameMarker}\n    // ${fallbackMarker}\n    const explicitPhotoTerminalOriginWorldX = Number(jetway.x);\n    const explicitPhotoTerminalOriginWorldZ = Number(jetway.z + sourceOffsetZ);\n    const explicitPhotoTerminalConnection = jetway.g === "A1"\n      ? (findTerminalWallConnection(\n          THREE,\n          terminal,\n          explicitPhotoTerminalOriginWorldX,\n          explicitPhotoTerminalOriginWorldZ,\n          -ux,\n          -uz,\n          rotundaY,\n        ) || null)\n      : null;\n    if (jetway.g === "A1") {\n      if (!explicitPhotoTerminalConnection) {\n        throw new Error("A1 late BGATE1 direct re-resolution returned no structural wall hit");\n      }\n      const wallRayX = Number(explicitPhotoTerminalConnection.towardX);\n      const wallRayZ = Number(explicitPhotoTerminalConnection.towardZ);\n      const wallRayMagnitude = Math.hypot(wallRayX, wallRayZ);\n      const wallDistance = Number(explicitPhotoTerminalConnection.distance);\n      if (!(Number.isFinite(wallRayMagnitude) && wallRayMagnitude > 0.9\n        && Number.isFinite(wallDistance) && wallDistance > 0.05 && wallDistance <= 48)) {\n        throw new Error(\`A1 late BGATE1 resolver returned an invalid ray hit: distance=\${wallDistance}, ray=\${wallRayX},\${wallRayZ}\`);\n      }\n      const wallRayUnitX = wallRayX / wallRayMagnitude;\n      const wallRayUnitZ = wallRayZ / wallRayMagnitude;\n      const terminalWallWorldX = explicitPhotoTerminalOriginWorldX + wallRayUnitX * wallDistance;\n      const terminalWallWorldZ = explicitPhotoTerminalOriginWorldZ + wallRayUnitZ * wallDistance;\n      const terminalWallGroupLocalX = terminalWallWorldX\n        - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = terminalWallWorldZ\n        - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (!(Number.isFinite(terminalWallGroupLocalX) && Number.isFinite(terminalWallGroupLocalZ))) {\n        throw new Error("A1 late BGATE1 ray-hit world-to-group-local wall publication failed");\n      }\n      let apronNormalX = -wallRayUnitX;\n      let apronNormalZ = -wallRayUnitZ;\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;\n      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 late BGATE1 wall cannot resolve authored apron side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      explicitPhotoTerminalConnection.pointX = terminalWallWorldX;\n      explicitPhotoTerminalConnection.pointZ = terminalWallWorldZ;\n      explicitPhotoTerminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      explicitPhotoTerminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      explicitPhotoTerminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      explicitPhotoTerminalConnection.apronNormalX = apronNormalX;\n      explicitPhotoTerminalConnection.apronNormalZ = apronNormalZ;\n      explicitPhotoTerminalConnection.terminalNormalX = -apronNormalX;\n      explicitPhotoTerminalConnection.terminalNormalZ = -apronNormalZ;\n      explicitPhotoTerminalConnection.wallNormalAuthority = "${marker}";\n      explicitPhotoTerminalConnection.hitPointAuthority = "${fallbackMarker}";\n    }\n`;
    placement = placement.replace(placementAnchor, `${directResolution}${placementAnchor}`);

    if (!placement.includes("explicitTerminalWallAuthorityV2")) {
      const gateField = "      gate: jetway.g,";
      if (!placement.includes(gateField)) {
        throw new Error(`${placementPath}: fallback cannot find uploaded placement gate field`);
      }
      const fields = `      gate: jetway.g,\n      terminalWallX: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.groupLocalPointX) : null,\n      terminalWallZ: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.groupLocalPointZ) : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n      terminalWallNormalX: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.terminalNormalX) : null,\n      terminalWallNormalZ: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.terminalNormalZ) : null,\n      apronWallNormalX: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.apronNormalX) : null,\n      apronWallNormalZ: jetway.g === "A1" ? Number(explicitPhotoTerminalConnection?.apronNormalZ) : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${compatibilityMarker}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${marker}" : null,`;
      placement = placement.replace(gateField, fields);
    }
  }

  if (!installation.includes(marker)) {
    const wallPattern = /\s*const terminalWallX\s*=\s*a1Placement\.x\s*\+\s*terminalDirection\.x\s*\*\s*sourceTerminalDistance;\s*\n\s*const terminalWallZ\s*=\s*a1Placement\.z\s*\+\s*terminalDirection\.z\s*\*\s*sourceTerminalDistance;/m;
    if (wallPattern.test(installation)) {
      installation = installation.replace(wallPattern, `\n  // ${marker}\n  // ${compatibilityMarker}\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);\n  const explicitTerminalWallZ = Number(a1Placement.terminalWallZ);\n  if (![explicitTerminalWallX, explicitTerminalWallZ].every(Number.isFinite)) {\n    throw new Error("A1 explicit measured Terminal 4 wall point is missing from final placement");\n  }\n  const terminalWallX = explicitTerminalWallX;\n  const terminalWallZ = explicitTerminalWallZ;`);
    } else if (installation.includes("const explicitTerminalWallX = Number(a1Placement.terminalWallX);")) {
      installation = installation.replace(
        "const explicitTerminalWallX = Number(a1Placement.terminalWallX);",
        `// ${marker}\n  // ${compatibilityMarker}\n  const explicitTerminalWallX = Number(a1Placement.terminalWallX);`,
      );
    } else {
      throw new Error(`${installationPath}: fallback measured terminal-wall block is missing`);
    }
  }

  for (const required of [
    marker,
    compatibilityMarker,
    frameMarker,
    fallbackMarker,
    "explicitPhotoTerminalConnection",
    "explicitPhotoTerminalConnection.distance",
    "explicitPhotoTerminalConnection.towardX",
    "terminalWallWorldX",
    "groupLocalPointX",
    "groupLocalPointZ",
    "explicitTerminalWallAuthorityV2",
  ]) {
    if (!placement.includes(required)) throw new Error(`${placementPath}: fallback wall contract missing ${required}`);
  }
  for (const forbidden of [
    "Number(explicitPhotoTerminalConnection.wallNormalX)",
    "Number(explicitPhotoTerminalConnection.wallNormalZ)",
  ]) {
    if (placement.includes(forbidden)) throw new Error(`${placementPath}: fallback still assumes unavailable resolver field ${forbidden}`);
  }
  for (const required of [marker, compatibilityMarker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
    if (!installation.includes(required)) throw new Error(`${installationPath}: fallback wall contract missing ${required}`);
  }

  fs.writeFileSync(placementPath, placement, "utf8");
  fs.writeFileSync(installationPath, installation, "utf8");
  console.log(`Recovered ${marker} by reconstructing the exact authored BGATE1 hit from findTerminalWallConnection's distance/direction contract at the stable uploaded-placement stage (${fallbackMarker}); A1 keeps its Aug. 15 long fixed dogleg/remote Rotunda authority with no terminal, aircraft, or supplied-GLB-child relocation.`);
}
