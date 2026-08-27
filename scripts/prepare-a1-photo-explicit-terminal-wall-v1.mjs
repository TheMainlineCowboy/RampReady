import fs from "node:fs";

// Final compatibility entrypoint for the Aug. 15 A1 wall resolver.
// The photographic facade identity MUST be installed before the explicit wall
// endpoint is measured. The old ordering applied the BGATE1 filter only after
// the wall, remote Rotunda and dogleg had already been constructed, allowing a
// stale wrong-side/perpendicular terminal attachment to survive visually.

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const FALLBACK_AUTHORITY = "a1-explicit-wall-publication-after-early-bgate1-lock-v2";
const COMPAT_AUTHORITY = "a1-real-photo-explicit-terminal-wall-v1";
const V2_AUTHORITY = "a1-real-photo-explicit-terminal-wall-v2";
const FRAME_AUTHORITY = "a1-bgate1-wall-world-to-source-group-local-v2";

await import(`./prepare-a1-bgate1-facade-identity-early-v1.mjs?early-wall=${Date.now()}`);
try {
  await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);
} catch (error) {
  // The early BGATE1 lock can legitimately rewrite the generated placement loop
  // enough that v2's old publication-text anchors disappear. Do not roll back the
  // correct facade lock just because a compatibility publication anchor changed.
  // Publish the already-resolved BGATE1 endpoint into the final placement using
  // the most stable object field that survives the generated variants.
  const message = String(error?.message || error);
  if (!message.includes("stable terminalConnection publication anchor is missing")) throw error;

  let source = fs.readFileSync(placementPath, "utf8");
  if (!source.includes(FALLBACK_AUTHORITY)) {
    const fieldsFromResolved = `      // ${FALLBACK_AUTHORITY}\n      // The wall resolver returns scene/world Terminal-4 coordinates. Convert the\n      // resolved BGATE1 point to the source-group local frame exactly once.\n      terminalWallX: jetway.g === "A1"\n        ? Number(resolvedTerminalConnection?.groupLocalPointX ?? (Number(resolvedTerminalConnection?.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0)))\n        : null,\n      terminalWallZ: jetway.g === "A1"\n        ? Number(resolvedTerminalConnection?.groupLocalPointZ ?? (Number(resolvedTerminalConnection?.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)))\n        : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${FRAME_AUTHORITY}" : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${COMPAT_AUTHORITY}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${V2_AUTHORITY}" : null,\n`;

    const fieldsFromConnection = `      // ${FALLBACK_AUTHORITY}\n      // The wall resolver returns scene/world Terminal-4 coordinates. Convert the\n      // resolved BGATE1 point to the source-group local frame exactly once.\n      terminalWallX: jetway.g === "A1"\n        ? Number(terminalConnection?.groupLocalPointX ?? (Number(terminalConnection?.pointX) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[0] || 0)))\n        : null,\n      terminalWallZ: jetway.g === "A1"\n        ? Number(terminalConnection?.groupLocalPointZ ?? (Number(terminalConnection?.pointZ) - Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)))\n        : null,\n      terminalWallCoordinateAuthority: jetway.g === "A1" ? "${FRAME_AUTHORITY}" : null,\n      explicitTerminalWallAuthority: jetway.g === "A1" ? "${COMPAT_AUTHORITY}" : null,\n      explicitTerminalWallAuthorityV2: jetway.g === "A1" ? "${V2_AUTHORITY}" : null,\n`;

    // Preferred path: the final uploaded-placement object always carries the source
    // jetway yaw/provenance fields even when earlier preparation rewrites the old
    // targetX/targetZ/aircraftDoorDistance sequence. resolvedTerminalConnection is
    // the stable final connection object used by the current placement builder.
    const sourceYawAnchor = `      sourceJetwayYawRadians: sourceJetwayYaw,\n`;
    const sourceHeadingAnchor = `      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-provenance-v3",\n`;
    const legacyTargetAnchor = `      targetX,\n      targetZ,\n      aircraftDoorDistance: distance,`;

    if (source.includes(sourceYawAnchor)) {
      source = source.replace(sourceYawAnchor, `${sourceYawAnchor}${fieldsFromResolved}`);
    } else if (source.includes(sourceHeadingAnchor)) {
      source = source.replace(sourceHeadingAnchor, `${fieldsFromResolved}${sourceHeadingAnchor}`);
    } else if (source.includes(legacyTargetAnchor)) {
      source = source.replace(
        legacyTargetAnchor,
        `      targetX,\n      targetZ,\n${fieldsFromConnection}      aircraftDoorDistance: distance,`,
      );
    } else {
      throw new Error(`${placementPath}: no stable final placement publication anchor exists after early BGATE1 lock`);
    }

    fs.writeFileSync(placementPath, source, "utf8");
  }

  const prepared = fs.readFileSync(placementPath, "utf8");
  for (const required of [
    FALLBACK_AUTHORITY,
    "terminalWallX: jetway.g === \"A1\"",
    "terminalWallZ: jetway.g === \"A1\"",
    `explicitTerminalWallAuthority: jetway.g === "A1" ? "${COMPAT_AUTHORITY}"`,
    `terminalWallCoordinateAuthority: jetway.g === "A1" ? "${FRAME_AUTHORITY}"`,
  ]) {
    if (!prepared.includes(required)) {
      throw new Error(`${placementPath}: explicit BGATE1 wall fallback publication is missing ${required}`);
    }
  }
  console.warn(`[A1 photo wall] Recovered explicit BGATE1 wall publication after early-lock rewrite: ${message}`);
}

console.log("Prepared A1 explicit terminal wall with the BGATE1 photo-identity lock installed before wall resolution; the resolved BGATE1 endpoint is guaranteed to be published into the final A1 placement.");
