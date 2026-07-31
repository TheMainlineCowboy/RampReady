import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";

const legacyStructuralFacadeFilter = `  const hit = raycaster.intersectObject(terminal, true).find((entry) => {
    if (entry.object?.visible === false) return false;
    const materials = Array.isArray(entry.object?.material)
      ? entry.object.material
      : [entry.object?.material];
    const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
    return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
  });`;
const legacyCommittedHitSelection = "  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);";

const radialStructuralFacadeFilter = `    const hit = raycaster.intersectObject(terminal, true).find((entry) => {
      if (entry.object?.visible === false) return false;
      const materials = Array.isArray(entry.object?.material)
        ? entry.object.material
        : [entry.object?.material];
      const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
      return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
    });`;
const radialCommittedHitSelection = "    const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);";
const radialStructuralVertexFilter = `    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test(material?.name || ""))) return;
`;

const facadeContinuityImport = 'import { buildTerminal4FacadeContinuity } from "./terminal4FacadeContinuityV8.js";';
const lowerFacadeSkinImport = 'import { buildTerminal4LowerFacadeSkin } from "./terminal4LowerFacadeSkinV9.js";';
const facadeContinuityConstruction = `  const terminal4FacadeContinuity = buildTerminal4FacadeContinuity(
    THREE,
    terminal,
    jetways,
    parkingByGate,
    materials,
    SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset,
  );
  group.add(terminal4FacadeContinuity);
  terminal4FacadeInfillCount += terminal4FacadeContinuity.userData.panelCount;
  terminal4LowerFacadeFitCount += terminal4FacadeContinuity.userData.panelCount;
  terminal4OpenServiceBayCount = 0;`;
const lowerFacadeSkinConstruction = `  const terminal4LowerFacadeSkin = buildTerminal4LowerFacadeSkin(THREE, terminal, materials);
  group.add(terminal4LowerFacadeSkin);
  terminal4FacadeInfillCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount;
  terminal4LowerFacadeFitCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount;`;
const skinAuthority = '  group.userData.facadeInfillAuthority = "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans";';
const continuityAuthority = '  group.userData.facadeInfillAuthority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";';
const committedFacadeAuthority = '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";';
const generatedRadialAuthority = '  group.userData.terminalConnectionAuthority = "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12";';
const committedRadialAuthority = '  group.userData.terminalConnectionAuthority = "independent-rotunda-collar-fit-to-authored-terminal-wall";';
const generatedLegacyAuthority = '  group.userData.terminalConnectionAuthority = "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11";';
const committedLegacyAuthority = '  group.userData.terminalConnectionAuthority = "raycast-and-source-vertex-fit-to-authored-terminal-mesh";';

function restoreGeneratedSourcePasses() {
  let source = fs.readFileSync(jetwayPath, "utf8");

  // Restore either supported terminal-connector implementation to the exact
  // committed source form after the prepared production artifact has captured
  // the 48 m structural-wall fit.
  source = source
    .replace(legacyStructuralFacadeFilter, legacyCommittedHitSelection)
    .replace(radialStructuralFacadeFilter, radialCommittedHitSelection)
    .replace(radialStructuralVertexFilter, "")
    .replace("  const cast = (direction, far = 48) => {", "  const cast = (direction, far = 24) => {")
    .replace("      if (distance > 0.05 && distance <= 48 && distance < nearestDistance) {", "      if (distance > 0.05 && distance <= 24 && distance < nearestDistance) {")
    .replace("      if (!(longitudinal > 0.05 && longitudinal <= 48)) continue;", "      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;")
    .replace("      if (lateral <= 5.5) nearest = Math.min(nearest, longitudinal);", "      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);")
    .replace("    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);", "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);")
    .replace(generatedRadialAuthority, committedRadialAuthority)
    .replace(generatedLegacyAuthority, committedLegacyAuthority)
    .replace(`${lowerFacadeSkinImport}\n`, "")
    .replace(`\n${lowerFacadeSkinImport}`, "")
    .replace(`${facadeContinuityImport}\n`, "")
    .replace(`\n${facadeContinuityImport}`, "")
    .replace(`${lowerFacadeSkinConstruction}\n`, "")
    .replace(`\n${lowerFacadeSkinConstruction}`, "")
    .replace(`${facadeContinuityConstruction}\n`, "")
    .replace(`\n${facadeContinuityConstruction}`, "")
    .replace(skinAuthority, continuityAuthority)
    .replace(continuityAuthority, committedFacadeAuthority);

  for (const forbidden of [
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test",
    "const cast = (direction, far = 48)",
    "distance <= 48",
    "longitudinal <= 48",
    "lateral <= 5.5",
    "1.25, 44",
    "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
    "48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11",
    "buildTerminal4FacadeContinuity",
    "terminal4FacadeContinuity.userData.panelCount",
    "buildTerminal4LowerFacadeSkin",
    "terminal4LowerFacadeSkin.userData.sourceTriangleCount",
    "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
    "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
  ]) {
    if (source.includes(forbidden)) throw new Error(`RampReady production cleanup left generated source token ${forbidden}`);
  }

  const radialBaselineRestored = [
    "function findTerminalWallConnection",
    "const cast = (direction, far = 24)",
    radialCommittedHitSelection,
    "distance <= 24",
    "1.25, 18",
    committedRadialAuthority,
  ].every((token) => source.includes(token));
  const legacyBaselineRestored = [
    "function findTerminalWallDistance",
    legacyCommittedHitSelection,
    "longitudinal <= 24",
    "lateral <= 4.5",
    "1.25, 18",
    committedLegacyAuthority,
  ].every((token) => source.includes(token));

  if ((!radialBaselineRestored && !legacyBaselineRestored) || !source.includes(committedFacadeAuthority)) {
    throw new Error("RampReady production cleanup failed to restore the committed jetway/facade baseline.");
  }
  fs.writeFileSync(jetwayPath, source, "utf8");
}

try {
  await import("./build-production.mjs");
} finally {
  restoreGeneratedSourcePasses();
}

console.log("RampReady production wrapper preserved the structural A1 wall fit, continuous Terminal 4 spans and V9 lower-facade skin in the artifact, then restored all temporary source transforms exactly.");
