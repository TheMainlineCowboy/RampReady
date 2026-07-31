import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const structuralFacadeFilter = `  const hit = raycaster.intersectObject(terminal, true).find((entry) => {
    if (entry.object?.visible === false) return false;
    const materials = Array.isArray(entry.object?.material)
      ? entry.object.material
      : [entry.object?.material];
    const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
    return /BGATE|DGATE|PHX_TERM400/i.test(material?.name || "");
  });`;
const committedHitSelection = "  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);";
const facadeContinuityImport = 'import { buildTerminal4FacadeContinuity } from "./terminal4FacadeContinuityV8.js";';
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
const continuityAuthority = '  group.userData.facadeInfillAuthority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";';
const committedFacadeAuthority = '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";';

function restoreGeneratedSourcePasses() {
  let source = fs.readFileSync(jetwayPath, "utf8");
  if (source.includes(structuralFacadeFilter)) source = source.replace(structuralFacadeFilter, committedHitSelection);
  source = source
    .replace(`${facadeContinuityImport}\n`, "")
    .replace(`\n${facadeContinuityImport}`, "")
    .replace(`${facadeContinuityConstruction}\n`, "")
    .replace(`\n${facadeContinuityConstruction}`, "")
    .replace(continuityAuthority, committedFacadeAuthority);

  for (const forbidden of [
    "return /BGATE|DGATE|PHX_TERM400/i.test",
    "buildTerminal4FacadeContinuity",
    "terminal4FacadeContinuity.userData.panelCount",
    "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
  ]) {
    if (source.includes(forbidden)) throw new Error(`RampReady production cleanup left generated source token ${forbidden}`);
  }
  if (!source.includes(committedHitSelection) || !source.includes(committedFacadeAuthority)) {
    throw new Error("RampReady production cleanup failed to restore the committed jetway/facade baseline.");
  }
  fs.writeFileSync(jetwayPath, source, "utf8");
}

try {
  await import("./build-production.mjs");
} finally {
  restoreGeneratedSourcePasses();
}

console.log("RampReady production wrapper preserved structural A1 fitting and continuous Terminal 4 facade spans in the artifact, then restored their temporary source patches exactly.");
