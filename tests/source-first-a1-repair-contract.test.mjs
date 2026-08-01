import fs from "node:fs";

const entry = fs.readFileSync("src/components/PushbackTrainer.jsx", "utf8");
const facade = fs.readFileSync("scripts/prepare-terminal4-facade-visual-v7.mjs", "utf8");
const continuity = fs.readFileSync("scripts/prepare-terminal4-facade-continuity-v8.mjs", "utf8");
const facadeSelection = fs.readFileSync("scripts/prepare-terminal4-source-facade-selection-v27.mjs", "utf8");
const directInspection = fs.readFileSync("scripts/prepare-direct-inspection-launch-v28.mjs", "utf8");
const connector = fs.readFileSync("scripts/prepare-a1-terminal-connector-v11.mjs", "utf8");

for (const token of [
  "Drive tug / inspect airport",
  'launch("inspection")',
  'initialInspectionMode={launchMode === "inspection"}',
]) {
  if (!entry.includes(token)) throw new Error(`Direct tug launch is missing ${token}`);
}
for (const forbidden of [
  'document.querySelector(".rr-inspection-toggle")',
  "inspectionButton.click()",
]) {
  if (entry.includes(forbidden)) throw new Error(`Direct tug launch still depends on DOM polling: ${forbidden}`);
}

for (const token of [
  "source-authored-lower-facade-authority-v25",
  '"transforms.facadeInfill.push"',
  '"transforms.facadeDoor.push"',
  '"transforms.facadeVent.push"',
]) {
  if (!facade.includes(token)) throw new Error(`Source-first facade contract is missing ${token}`);
}

for (const token of [
  "source-authored-terminal4-lower-facade-v25-no-overlay",
  '"buildTerminal4FacadeContinuity"',
  '"buildTerminal4LowerFacadeSkin"',
  'await import("./prepare-terminal4-source-facade-selection-v27.mjs")',
]) {
  if (!continuity.includes(token)) throw new Error(`Source-only continuity cleanup is missing ${token}`);
}
if (continuity.includes('await import("./prepare-terminal4-lower-facade-skin-v9.mjs")')) {
  throw new Error("The copied lower-facade skin is still invoked");
}

for (const token of [
  'sourceKey === "BGATE1.BMP" ? "BGATE3.BMP"',
  "source-BGATE3-closed-bay-variant-replaces-repeated-BGATE1-open-bay-v27",
  "const a1LowerFacadePanelCount = 0;",
  "source-authored-A1-lower-facade-no-rejected-BGATE1-overlay-v27",
]) {
  if (!facadeSelection.includes(token)) throw new Error(`Package-native facade selection is missing ${token}`);
}
if (facadeSelection.includes("CanvasTexture")) {
  throw new Error("The facade selection recreated a generated texture atlas");
}

for (const token of [
  "initialInspectionMode = false,",
  "toggleInspectionDrive();",
  "window.requestAnimationFrame(activate)",
  "terminal4SourceClosedBayMaterialCount",
]) {
  if (!directInspection.includes(token)) throw new Error(`Direct inspection runtime preparation is missing ${token}`);
}
if (directInspection.includes("querySelector")) {
  throw new Error("Direct inspection runtime preparation still queries the DOM");
}

for (const token of [
  "exactWalkwayPortalX = -30.16857013",
  "exactWalkwayPortalZ = jetway.z",
  "exact-T4_WALK-A1-terminal-portal-v25",
]) {
  if (!connector.includes(token)) throw new Error(`A1 source portal contract is missing ${token}`);
}

if (connector.includes("const exactWallX = -3.55299146")) {
  throw new Error("The detached diagonal BGATE A1 target remains");
}

console.log("Source-first A1, package-native facade and direct tug inspection contracts verified.");
