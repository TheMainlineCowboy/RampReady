import fs from "node:fs";

const runtimePath = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-original-bgateg1-node-authority-v1";
const sourceFacadeAuthority = "source-package-facade-cell-variation-v31";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const oldClassifier = `      const isMainTerminalFacade = /BGATE1/i.test(materialReference);`;
  const newClassifier = `      // ${marker}
      // splitRepeatedBGATE1Facade keeps the original BGATE1 mesh node and marks
      // that node with sourceFacadeVariationAuthority, while its individual UV
      // cells intentionally receive BGATE3/DGATE3/DGATE1/BGATE1 materials.
      // Wall ownership therefore follows the original source node, not the
      // cosmetic material assigned to the current cell.
      const originalSourceFacadeAuthority = String(node.userData?.sourceFacadeVariationAuthority || "");
      const isMainTerminalFacade = originalSourceFacadeAuthority === "${sourceFacadeAuthority}";`;
  if (!source.includes(oldClassifier)) throw new Error(`${runtimePath}: BGATE1 material classifier is missing`);
  source = source.replace(oldClassifier, newClassifier);

  source = source.replace(
    `        diagnostics.requiredMainTerminalMaterial = "BGATE1";`,
    `        diagnostics.requiredMainTerminalSourceAuthority = "${sourceFacadeAuthority}";`,
  );
  source = source.replace(
    `          requiredMainTerminalMaterial: forcePreferredHemisphere ? "BGATE1" : null,`,
    `          originalSourceFacadeAuthority: forcePreferredHemisphere ? originalSourceFacadeAuthority : null,\n          requiredMainTerminalSourceAuthority: forcePreferredHemisphere ? "${sourceFacadeAuthority}" : null,`,
  );

  source = source.replace(
    `        || !/BGATE1/i.test(String(groundedConnection.materialReference || ""))) {`,
    `        || groundedConnection.originalSourceFacadeAuthority !== "${sourceFacadeAuthority}") {`,
  );
  source = source.replace(
    `A1 grounded wall is not the BGATE1 main-terminal facade with a clear T4_WALK-free source-pivot route`,
    `A1 grounded wall is not the original BGATE1 source-facade node with a clear T4_WALK-free source-pivot route`,
  );

  source = source.replace(
    `        requiredMainTerminalMaterial: "BGATE1",`,
    `        requiredMainTerminalSourceAuthority: "${sourceFacadeAuthority}",`,
  );

  source = source.replace(
    `        || !/BGATE1/i.test(String(fullHeightUpperConnection.materialReference || ""))) {`,
    `        || fullHeightUpperConnection.originalSourceFacadeAuthority !== "${sourceFacadeAuthority}") {`,
  );
  source = source.replace(
    `A1 Rotunda-height wall is not the BGATE1 main-terminal facade with a clear T4_WALK-free source-pivot route`,
    `A1 Rotunda-height wall is not the original BGATE1 source-facade node with a clear T4_WALK-free source-pivot route`,
  );

  source = source.replace(
    `wallSelectionVectorAuthority: "a1-bgateg1-main-facade-after-uv-split-v1",`,
    `wallSelectionVectorAuthority: "${marker}",`,
  );
  source = source.replace(
    `terminalConnection.authority = "a1-bgateg1-full-height-facade-clear-route-v33";`,
    `terminalConnection.authority = "a1-original-bgateg1-node-full-height-clear-route-v34";`,
  );
  source = source.replace(
    `terminalConnection.mainTerminalFacadeAuthority = "a1-bgateg1-main-facade-after-uv-split-v1";`,
    `terminalConnection.mainTerminalFacadeAuthority = "${marker}";`,
  );
  source = source.replace(
    `terminalConnection.requiredMainTerminalMaterial = "BGATE1";`,
    `terminalConnection.requiredMainTerminalSourceAuthority = "${sourceFacadeAuthority}";`,
  );
}

for (const required of [
  marker,
  `originalSourceFacadeAuthority === "${sourceFacadeAuthority}"`,
  `requiredMainTerminalSourceAuthority = "${sourceFacadeAuthority}"`,
  `originalSourceFacadeAuthority: forcePreferredHemisphere ? originalSourceFacadeAuthority : null`,
  `groundedConnection.originalSourceFacadeAuthority !== "${sourceFacadeAuthority}"`,
  `fullHeightUpperConnection.originalSourceFacadeAuthority !== "${sourceFacadeAuthority}"`,
  'wallSelectionVectorAuthority: "a1-original-bgateg1-node-authority-v1"',
  'a1-original-bgateg1-node-full-height-clear-route-v34',
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: original BGATE1 node wall contract is missing ${required}`);
}
for (const forbidden of [
  "const isMainTerminalFacade = /BGATE1/i.test(materialReference);",
  'diagnostics.requiredMainTerminalMaterial = "BGATE1"',
  '!/BGATE1/i.test(String(groundedConnection.materialReference || ""))',
  '!/BGATE1/i.test(String(fullHeightUpperConnection.materialReference || ""))',
]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: cosmetic-material wall ownership survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Prepared A1 wall ownership from the original BGATE1 source mesh-node authority retained through UV-cell material variation; zero-T4_WALK route clearance remains mandatory and exact jetway geometry is unchanged.");

// The correct installation pass has already aligned the complete supplied A1
// parent to the measured main-terminal wall. Preserve that physical parent yaw
// immediately after final wall ownership is established; the replaced stock
// AIR_Jetway01 BGL heading is provenance only and must not rotate A1 away again.
await import(`./prepare-a1-preserve-measured-wall-parent-yaw-v1.mjs?after-source-wall=${Date.now()}`);
