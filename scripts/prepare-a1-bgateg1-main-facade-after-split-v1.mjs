import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-bgateg1-main-facade-after-uv-split-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const oldCandidateGate = `      if (forcePreferredHemisphere && area < 100) {
        diagnostics.narrowFacadeRejectedCount = (diagnostics.narrowFacadeRejectedCount || 0) + 1;
        diagnostics.minimumMainFacadeTriangleAreaSqM = 100;
        continue;
      }
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
  const newCandidateGate = `      // ${marker}
      // BGATE1 is the source-authored beige main Terminal 4 facade. Its large
      // source faces are intentionally split into small UV-repeat cells before
      // this search, so per-triangle area cannot identify the building here.
      const isMainTerminalFacade = /BGATE1/i.test(materialReference);
      if (forcePreferredHemisphere && !isMainTerminalFacade) {
        diagnostics.nonMainFacadeRejectedCount = (diagnostics.nonMainFacadeRejectedCount || 0) + 1;
        diagnostics.requiredMainTerminalMaterial = "BGATE1";
        continue;
      }
      const candidateDirection = new THREE.Vector3(dx, 0, dz).normalize();`;
  if (!source.includes(oldCandidateGate)) throw new Error(`${runtimePath}: post-split A1 triangle-area gate is missing`);
  source = source.replace(oldCandidateGate, newCandidateGate);

  source = source.replace(
    `          mainTerminalFacadeVerified: !forcePreferredHemisphere || area >= 100,
          minimumMainFacadeTriangleAreaSqM: forcePreferredHemisphere ? 100 : null,`,
    `          mainTerminalFacadeVerified: !forcePreferredHemisphere || isMainTerminalFacade,
          requiredMainTerminalMaterial: forcePreferredHemisphere ? "BGATE1" : null,`,
  );

  source = source.replace(
    `      if (groundedConnection.walkwayRouteClearToSourcePivot !== true
        || groundedConnection.mainTerminalFacadeVerified !== true
        || !(Number(groundedConnection.triangleArea) >= 100)) {
        throw new Error(\`A1 grounded wall is not the broad main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(groundedConnection)}\`);
      }`,
    `      if (groundedConnection.walkwayRouteClearToSourcePivot !== true
        || groundedConnection.mainTerminalFacadeVerified !== true
        || !/BGATE1/i.test(String(groundedConnection.materialReference || ""))) {
        throw new Error(\`A1 grounded wall is not the BGATE1 main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(groundedConnection)}\`);
      }`,
  );

  source = source.replace(
    `        minimumMainFacadeTriangleAreaSqM: 100,
        walkwayRouteRejectedCount: diagnostics?.walkwayRouteRejectedCount ?? 0,
        narrowFacadeRejectedCount: diagnostics?.narrowFacadeRejectedCount ?? 0,`,
    `        requiredMainTerminalMaterial: "BGATE1",
        walkwayRouteRejectedCount: diagnostics?.walkwayRouteRejectedCount ?? 0,
        nonMainFacadeRejectedCount: diagnostics?.nonMainFacadeRejectedCount ?? 0,`,
  );

  source = source.replace(
    `      if (fullHeightUpperConnection.walkwayRouteClearToSourcePivot !== true
        || fullHeightUpperConnection.mainTerminalFacadeVerified !== true
        || !(Number(fullHeightUpperConnection.triangleArea) >= 100)) {
        throw new Error(\`A1 Rotunda-height wall is not the broad main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(fullHeightUpperConnection)}\`);
      }`,
    `      if (fullHeightUpperConnection.walkwayRouteClearToSourcePivot !== true
        || fullHeightUpperConnection.mainTerminalFacadeVerified !== true
        || !/BGATE1/i.test(String(fullHeightUpperConnection.materialReference || ""))) {
        throw new Error(\`A1 Rotunda-height wall is not the BGATE1 main-terminal facade with a clear T4_WALK-free source-pivot route: \${JSON.stringify(fullHeightUpperConnection)}\`);
      }`,
  );

  source = source.replace(
    `wallSelectionVectorAuthority: "a1-main-terminal-facade-clear-route-v1",`,
    `wallSelectionVectorAuthority: "${marker}",`,
  );
  source = source.replace(
    `terminalConnection.authority = "a1-main-terminal-full-height-facade-clear-route-v32";`,
    `terminalConnection.authority = "a1-bgateg1-full-height-facade-clear-route-v33";`,
  );
  source = source.replace(
    `terminalConnection.mainTerminalFacadeAuthority = "a1-main-terminal-facade-clear-route-v1";`,
    `terminalConnection.mainTerminalFacadeAuthority = "${marker}";`,
  );
}

for (const required of [
  marker,
  "/BGATE1/i.test(materialReference)",
  'requiredMainTerminalMaterial: "BGATE1"',
  "nonMainFacadeRejectedCount",
  'wallSelectionVectorAuthority: "a1-bgateg1-main-facade-after-uv-split-v1"',
  'a1-bgateg1-full-height-facade-clear-route-v33',
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: BGATE1 post-split A1 wall contract is missing ${required}`);
}
for (const forbidden of [
  "forcePreferredHemisphere && area < 100",
  "minimumMainFacadeTriangleAreaSqM",
  "narrowFacadeRejectedCount",
  "Number(groundedConnection.triangleArea) >= 100",
  "Number(fullHeightUpperConnection.triangleArea) >= 100",
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale per-triangle A1 wall ownership survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Prepared A1 final wall ownership from BGATE1 source-facade identity after runtime UV-cell splitting, retaining the zero-T4_WALK route requirement and leaving the exact jetway geometry untouched.");
