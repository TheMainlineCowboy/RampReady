import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const searchMarker = "A1 grounded-facade search v33 terminal-side hemisphere locked";
const connectionMarker = "A1 ramp-level real Terminal 4 source wall v33 terminal-side locked";
const MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 3.4;
const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 28;
const MAXIMUM_A1_WALL_HEIGHT_METERS = 2.2;
const MINIMUM_A1_TERMINAL_DIRECTION_DOT = 0.15;

// The source bridge can begin several meters from the real terminal wall. The
// complete authored parent is relocated later so its final visible vestibule is
// exactly 2.4 m. The terminal-side hemisphere must remain enforced even for the
// 1.25 m ramp-level search. The previous height-based exception disabled that
// guard at A1 and allowed a structurally named facade on the wrong side of the
// Rotunda to win the radial search.
if (!source.includes(searchMarker) && source.includes("const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();")) {
  source = source.replace(
    "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();",
    `  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
  const requirePreferredHemisphere = true; // ${searchMarker}`,
  );
  source = source.replaceAll(
    "      if (directionDot < 0.15) {",
    "      if (requirePreferredHemisphere && directionDot < 0.15) {",
  );
  source = source.replaceAll(
    "      const directionPenalty = Math.max(0, 1 - directionDot) * 2.5;",
    "      const directionPenalty = requirePreferredHemisphere ? Math.max(0, 1 - directionDot) * 2.5 : 0;",
  );
}

const terminalConnectionWithFallback = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};`;
const terminalConnectionWithoutFallback = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`;

const groundedReplacement = `    let terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    if (jetway.g === "A1") {
      // ${connectionMarker}
      const elevatedConnection = terminalConnection;
      const groundedConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        -ux,
        -uz,
        1.25,
      );
      const diagnostics = terminal?.userData?.a1WallSearchDiagnostics || null;
      if (!groundedConnection) {
        throw new Error(\`A1 grounded terminal-building search found no ramp-level structural facade: \${JSON.stringify(diagnostics)}\`);
      }
      const groundedTerminalDirectionDot = groundedConnection.towardX * -ux
        + groundedConnection.towardZ * -uz;
      if (!(groundedTerminalDirectionDot >= ${MINIMUM_A1_TERMINAL_DIRECTION_DOT})) {
        throw new Error(\`A1 grounded search selected the wrong side of the Rotunda: directionDot=\${groundedTerminalDirectionDot}; authority=\${groundedConnection.authority}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (/WALK|JETWAY|CONNECTOR|PORTAL/i.test(String(groundedConnection.authority || ""))) {
        throw new Error(\`A1 grounded search resolved a forbidden walkway/connector authority: \${groundedConnection.authority}\`);
      }
      if (!(groundedConnection.distance > ${MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS}
        && groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS})) {
        throw new Error(\`A1 ramp-level real-terminal source wall distance is invalid: \${groundedConnection.distance}; diagnostics=\${JSON.stringify(diagnostics)}\`);
      }
      if (Number.isFinite(groundedConnection.pointY)
        && groundedConnection.pointY > ${MAXIMUM_A1_WALL_HEIGHT_METERS}) {
        throw new Error(\`A1 grounded search selected an elevated facade at y=\${groundedConnection.pointY}\`);
      }
      const groundedMaterialReference = String(groundedConnection.materialReference || "");
      if (!/BGATE|DGATE|PHX_TERM400/i.test(groundedMaterialReference)) {
        throw new Error(\`A1 grounded search did not resolve the authored Terminal 4 structural material: \${groundedMaterialReference}\`);
      }
      terminalConnection = groundedConnection;
      terminal.userData.a1ElevatedConnectionCandidate = elevatedConnection
        ? {
          distance: elevatedConnection.distance,
          towardX: elevatedConnection.towardX,
          towardZ: elevatedConnection.towardZ,
          authority: elevatedConnection.authority,
        }
        : null;
      terminal.userData.a1GroundedBuildingConnection = {
        sourceDistance: groundedConnection.distance,
        towardX: groundedConnection.towardX,
        towardZ: groundedConnection.towardZ,
        directionDot: groundedTerminalDirectionDot,
        pointX: groundedConnection.pointX ?? null,
        pointY: groundedConnection.pointY ?? null,
        pointZ: groundedConnection.pointZ ?? null,
        materialReference: groundedConnection.materialReference ?? null,
        authority: groundedConnection.authority,
        rampLevelRealTerminalWall: true,
        terminalSideHemisphereLocked: true,
        minimumTerminalDirectionDot: ${MINIMUM_A1_TERMINAL_DIRECTION_DOT},
        sourceDistanceRangeMeters: [${MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS}, ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}],
        finalVisibleVestibuleCheckedAfterRelocation: true,
        maximumAllowedHeightMeters: ${MAXIMUM_A1_WALL_HEIGHT_METERS},
      };
    }`;

let replacementCount = 0;
if (!source.includes(connectionMarker)) {
  if (source.includes(terminalConnectionWithFallback)) {
    source = source.replace(terminalConnectionWithFallback, groundedReplacement);
    replacementCount = 1;
  } else if (source.includes(terminalConnectionWithoutFallback)) {
    source = source.replace(terminalConnectionWithoutFallback, groundedReplacement);
    replacementCount = 1;
  } else {
    throw new Error(`${runtimePath}: post-v14 terminalConnection declaration is missing`);
  }
}

for (const token of [
  connectionMarker,
  "let terminalConnection = findTerminalWallConnection(",
  "const groundedConnection = findTerminalWallConnection(",
  "const groundedTerminalDirectionDot = groundedConnection.towardX * -ux",
  "groundedTerminalDirectionDot >= 0.15",
  "A1 grounded search selected the wrong side of the Rotunda",
  "groundedConnection.distance > 3.4",
  "groundedConnection.distance < 28",
  "terminalConnection = groundedConnection",
  "a1GroundedBuildingConnection",
  "terminalSideHemisphereLocked: true",
  "minimumTerminalDirectionDot: 0.15",
  "rampLevelRealTerminalWall: true",
  "finalVisibleVestibuleCheckedAfterRelocation: true",
  "A1 grounded terminal-building search found no ramp-level structural facade",
  "A1 ramp-level real-terminal source wall distance is invalid",
  "A1 grounded search selected an elevated facade",
  "BGATE|DGATE|PHX_TERM400",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 source-wall token is missing: ${token}`);
  }
}
for (const token of [
  searchMarker,
  "const requirePreferredHemisphere = true",
  "if (requirePreferredHemisphere && directionDot < 0.15)",
  "const directionPenalty = requirePreferredHemisphere",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded facade search token is missing: ${token}`);
  }
}
const forbiddenWalkwayAuthority = "exact-" + "T4_WALK-A1-terminal-portal-v25";
const forbiddenWalkwayPortalVariable = "exactWalkway" + "PortalX";
for (const forbidden of [
  forbiddenWalkwayAuthority,
  forbiddenWalkwayPortalVariable,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: forbidden A1 walkway anchor survived grounded-terminal preparation: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Prepared ${Math.max(1, replacementCount)} A1 ramp-level real-wall source hit(s) with the terminal-side hemisphere locked at every search height, rejecting the wrong side/T4_WALK while leaving the final exact 2.4 m vestibule to the complete-parent relocation stage.`);
