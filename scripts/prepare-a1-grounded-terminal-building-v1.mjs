import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const searchMarker = "A1 grounded-facade search v31";
const connectionMarker = "A1 compact grounded Terminal 4 building connection v31";
const MINIMUM_A1_WALL_SPAN_METERS = 1.5;
const MAXIMUM_A1_WALL_SPAN_METERS = 4.1;
const MAXIMUM_A1_WALL_HEIGHT_METERS = 2.2;

// At bridge height the preferred hemisphere is useful for ordinary gates. At
// A1 ramp level it preserves the obsolete bias toward the elevated T4_WALK
// corridor, so the 1.25 m search is radial while retaining strict structural
// material, triangle normal, area, height and distance qualification.
if (!source.includes(searchMarker) && source.includes("const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();")) {
  source = source.replace(
    "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();",
    `  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();
  const requirePreferredHemisphere = height > 2.2; // ${searchMarker}`,
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
      if (/WALK|JETWAY|CONNECTOR|PORTAL/i.test(String(groundedConnection.authority || ""))) {
        throw new Error(\`A1 grounded search resolved a forbidden walkway/connector authority: \${groundedConnection.authority}\`);
      }
      if (!(groundedConnection.distance > ${MINIMUM_A1_WALL_SPAN_METERS}
        && groundedConnection.distance < ${MAXIMUM_A1_WALL_SPAN_METERS})) {
        throw new Error(\`A1 grounded real-terminal wall span is not compact: \${groundedConnection.distance}; diagnostics=\${JSON.stringify(diagnostics)}\`);
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
        distance: groundedConnection.distance,
        towardX: groundedConnection.towardX,
        towardZ: groundedConnection.towardZ,
        pointX: groundedConnection.pointX ?? null,
        pointY: groundedConnection.pointY ?? null,
        pointZ: groundedConnection.pointZ ?? null,
        materialReference: groundedConnection.materialReference ?? null,
        authority: groundedConnection.authority,
        compactRealTerminalWall: true,
        maximumAllowedDistanceMeters: ${MAXIMUM_A1_WALL_SPAN_METERS},
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
  "terminalConnection = groundedConnection",
  "a1GroundedBuildingConnection",
  "A1 grounded terminal-building search found no ramp-level structural facade",
  "A1 grounded real-terminal wall span is not compact",
  "A1 grounded search selected an elevated facade",
  "compactRealTerminalWall: true",
  "BGATE|DGATE|PHX_TERM400",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 connection token is missing: ${token}`);
  }
}

for (const token of [
  searchMarker,
  "const requirePreferredHemisphere = height > 2.2",
  "if (requirePreferredHemisphere && directionDot < 0.15)",
  "const directionPenalty = requirePreferredHemisphere",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded facade search token is missing: ${token}`);
  }
}
for (const forbidden of [
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: forbidden A1 walkway anchor survived grounded-terminal preparation: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Prepared ${Math.max(1, replacementCount)} A1 connection block(s) from the actual post-v14 declaration, requiring a compact ramp-level authored Terminal 4 wall and rejecting T4_WALK.`);
