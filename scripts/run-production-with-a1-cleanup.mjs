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

function restoreStructuralFacadeFilter() {
  let source = fs.readFileSync(jetwayPath, "utf8");
  if (source.includes(structuralFacadeFilter)) source = source.replace(structuralFacadeFilter, committedHitSelection);
  if (!source.includes(committedHitSelection) || source.includes("return /BGATE|DGATE|PHX_TERM400/i.test")) {
    throw new Error("RampReady production cleanup failed to restore the committed terminal-hit selection baseline.");
  }
  fs.writeFileSync(jetwayPath, source, "utf8");
}

try {
  await import("./build-production.mjs");
} finally {
  restoreStructuralFacadeFilter();
}

console.log("RampReady production wrapper preserved the structural-facade A1 connector in the artifact and restored its temporary source filter afterward.");
