import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(runtimePath, "utf8");

const searchMarker = "A1 grounded-facade search v30";
const connectionMarker = "A1 grounded Terminal 4 building connection v30";

// The final triangle-qualified search normally keeps candidates in the old
// source bridge hemisphere. That is appropriate at bridge height for ordinary
// gates, but it preserves A1's obsolete bias toward the elevated T4_WALK
// corridor. At ramp level the corridor has no wall, so search radially and let
// exact structural material, wall normal, area, height and distance identify
// the actual grounded terminal facade.
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

const terminalConnectionPattern = /    const terminalConnection = findTerminalWallConnection\(\n      THREE,\n      terminal,\n      jetway\.x,\n      jetway\.z \+ sourceOffsetZ,\n      -ux,\n      -uz,\n      rotundaY,\n    \);\n    if \(jetway\.g === "A1"\) \{\n      const diagnostics = terminal\?\.userData\?\.a1WallSearchDiagnostics \|\| null;/g;

let replacementCount = 0;
source = source.replace(terminalConnectionPattern, () => {
  replacementCount += 1;
  return `    let terminalConnection = findTerminalWallConnection(
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
      };`;
});

if (replacementCount < 1 && !source.includes(connectionMarker)) {
  throw new Error(`${runtimePath}: generated A1 structural connection block is missing`);
}

for (const token of [
  connectionMarker,
  "const groundedConnection = findTerminalWallConnection(",
  "1.25,",
  "terminalConnection = groundedConnection",
  "a1GroundedBuildingConnection",
  "A1 grounded terminal-building search found no ramp-level structural facade",
]) {
  if (!source.includes(token)) {
    throw new Error(`${runtimePath}: grounded A1 connection token is missing: ${token}`);
  }
}

if (source.includes("const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();")) {
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
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Prepared ${Math.max(1, replacementCount)} A1 connection block(s) to use the ramp-level grounded Terminal 4 facade instead of the elevated T4_WALK corridor while preserving the exact supplied jetway hierarchy.`);