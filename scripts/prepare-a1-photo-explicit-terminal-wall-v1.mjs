// Compatibility entrypoint retained for existing production call sites.
// Prefer the v2 publisher, but late production preparers can legitimately rewrite
// the old terminalWallDistance/connectorToward publication lines. When that exact
// compatibility-only anchor disappears, bind the same physical BGATE1 wall truth
// directly to the surviving terminalConnection resolution instead of stopping.
import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const marker = "a1-real-photo-explicit-terminal-wall-v2";
const compatibilityMarker = "a1-real-photo-explicit-terminal-wall-v1";
const frameMarker = "a1-bgate1-wall-world-to-source-group-local-v2";

try {
  await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);
} catch (error) {
  const message = String(error?.message || error);
  if (!message.includes("stable terminalConnection publication anchor is missing")) throw error;

  let placement = fs.readFileSync(placementPath, "utf8");
  let installation = fs.readFileSync(installationPath, "utf8");

  if (!placement.includes("wallNormalX: normal.x") || !placement.includes("wallNormalZ: normal.z")) {
    throw new Error(`${placementPath}: fallback cannot find structural BGATE1 wall-normal fields`);
  }

  if (!placement.includes(marker)) {
    const connectionPattern = /(^\s*const terminalConnection\s*=\s*findTerminalWallConnection\([\s\S]*?\)\s*\|\|\s*\{\};\s*$)/m;
    const connectionMatch = placement.match(connectionPattern);
    if (!connectionMatch) {
      throw new Error(`${placementPath}: fallback cannot find surviving terminalConnection resolution`);
    }

    const publication = `${connectionMatch[1]}\n    // ${marker}\n    // ${compatibilityMarker}\n    // ${frameMarker}\n    // Late-stage anchor-safe publication: preserve the exact real BGATE1 hit\n    // before any obsolete compact/T4_WALK compatibility block can overwrite\n    // distance/direction. No terminal, aircraft, Rotunda, or supplied GLB child moves.\n    if (jetway.g === "A1") {\n      const rawWallNormalX = Number(terminalConnection?.wallNormalX);\n      const rawWallNormalZ = Number(terminalConnection?.wallNormalZ);\n      const wallNormalMagnitude = Math.hypot(rawWallNormalX, rawWallNormalZ);\n      const terminalWallGroupLocalX = Number(terminalConnection?.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0);\n      const terminalWallGroupLocalZ = Number(terminalConnection?.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0);\n      if (!(Number.isFinite(wallNormalMagnitude) && wallNormalMagnitude > 0.9\n        && Number.isFinite(terminalWallGroupLocalX) && Number.isFinite(terminalWallGroupLocalZ))) {\n        throw new Error("A1 fallback BGATE1 world-to-group-local wall publication failed");\n      }\n      let apronNormalX = rawWallNormalX / wallNormalMagnitude;\n      let apronNormalZ = rawWallNormalZ / wallNormalMagnitude;\n      const wallToAuthoredStandX = targetX - terminalWallGroupLocalX;\n      const wallToAuthoredStandZ = targetZ - terminalWallGroupLocalZ;\n      if (!(Number.isFinite(wallToAuthoredStandX) && Number.isFinite(wallToAuthoredStandZ)\n        && Math.hypot(wallToAuthoredStandX, wallToAuthoredStandZ) > 2)) {\n        throw new Error("A1 fallback BGATE1 wall cannot resolve authored apron side");\n      }\n      if (apronNormalX * wallToAuthoredStandX + apronNormalZ * wallToAuthoredStandZ < 0) {\n        apronNormalX *= -1;\n        apronNormalZ *= -1;\n      }\n      terminalConnection.groupLocalPointX = terminalWallGroupLocalX;\n      terminalConnection.groupLocalPointZ = terminalWallGroupLocalZ;\n      terminalConnection.groupLocalPointAuthority = "${frameMarker}";\n      terminalConnection.apronNormalX = apronNormalX;\n      terminalConnection.apronNormalZ = apronNormalZ;\n      terminalConnection.terminalNormalX = -apronNormalX;\n      terminalConnection.terminalNormalZ = -apronNormalZ;\n      terminalConnection.wallNormalAuthority = "${marker}";\n    }`;
    placement = placement.replace(connectionPattern, publication);

    if (!placement.includes("explicitTerminalWallAuthorityV2")) {
      const yawPattern = /(^\s*sourceJetwayYawRadians:\s*sourceJetwayYaw,\s*$)/m;
      const headingPattern = /(^\s*sourceHeadingAuthority:\s*jetway\.g\s*===\s*"A1"[^\n]*$)/m;
      const anchorMatch = placement.match(yawPattern) || placement.match(headingPattern);
      if (!anchorMatch) {
        throw new Error(`${placementPath}: fallback cannot find A1 placement provenance anchor`);
      }
      const indent = anchorMatch[1].match(/^\s*/)?.[0] || "      ";
      const fields = `${indent}terminalWallX: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.groupLocalPointX) : null,\n${indent}terminalWallZ: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.groupLocalPointZ) : null,\n${indent}terminalWallCoordinateAuthority: jetway.g === "A1" ? "${frameMarker}" : null,\n${indent}terminalWallNormalX: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.terminalNormalX) : null,\n${indent}terminalWallNormalZ: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.terminalNormalZ) : null,\n${indent}apronWallNormalX: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.apronNormalX) : null,\n${indent}apronWallNormalZ: jetway.g === "A1" ? Number((resolvedTerminalConnection || terminalConnection)?.apronNormalZ) : null,\n${indent}explicitTerminalWallAuthority: jetway.g === "A1" ? "${compatibilityMarker}" : null,\n${indent}explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${marker}" : null,\n`;
      placement = placement.replace(anchorMatch[1], `${fields}${anchorMatch[1]}`);
    }
  }

  if (!installation.includes(marker)) {
    const wallPattern = /\s*const terminalWallX\s*=\s*a1Placement\.x\s*\+\s*terminalDirection\.x\s*\*\s*sourceTerminalDistance;\s*\n\s*const terminalWallZ\s*=\s*a1Placement\.z\s*\+\s*terminalDirection\.z\s*\*\s*sourceTerminalDistance;/m;
    const wallMatch = installation.match(wallPattern);
    if (wallMatch) {
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

  for (const required of [marker, compatibilityMarker, frameMarker, "groupLocalPointX", "groupLocalPointZ", "explicitTerminalWallAuthorityV2"]) {
    if (!placement.includes(required)) throw new Error(`${placementPath}: fallback wall contract missing ${required}`);
  }
  for (const required of [marker, compatibilityMarker, "explicitTerminalWallX", "explicitTerminalWallZ"]) {
    if (!installation.includes(required)) throw new Error(`${installationPath}: fallback wall contract missing ${required}`);
  }

  fs.writeFileSync(placementPath, placement, "utf8");
  fs.writeFileSync(installationPath, installation, "utf8");
  console.log(`Recovered ${marker} from the surviving terminalConnection resolution after late generation; A1 remains BGATE1-wall anchored with its Aug. 15 long fixed dogleg/remote Rotunda authority and no terminal/aircraft/GLB-child relocation.`);
}
