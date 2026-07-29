import fs from "node:fs";

const path = "src/environment/authoredKphxGround.js";
let source = fs.readFileSync(path, "utf8");
const operations = [
  {
    marker: 'import { installKphxRunwayVisuals } from "./kphxRunwayVisuals.js";',
    oldText: 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";\n',
    newText: 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";\nimport { installKphxRunwayVisuals } from "./kphxRunwayVisuals.js";\n',
  },
  {
    marker: "const runwayVisuals = await installKphxRunwayVisuals(THREE, authored);",
    oldText: "  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);",
    newText: "  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);\n  const runwayVisuals = await installKphxRunwayVisuals(THREE, authored);",
  },
  {
    marker: "environment.userData.kphxRunwayVisualDetailLevel",
    oldText: `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;\n  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;`,
    newText: `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;\n  environment.userData.kphxRunwayCount = runwayVisuals.userData.runwayCount;\n  environment.userData.kphxRunwayIdentifierCount = runwayVisuals.userData.identifierCount;\n  environment.userData.kphxRunwayLightCount = runwayVisuals.userData.lightCount;\n  environment.userData.kphxRunwayVisualDetailLevel = runwayVisuals.userData.detailLevel;\n  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;`,
  },
];
for (const operation of operations) {
  if (source.includes(operation.marker)) continue;
  if (!source.includes(operation.oldText)) throw new Error(`KPHX runway runtime anchor is missing for ${operation.marker}`);
  source = source.replace(operation.oldText, operation.newText);
}
fs.writeFileSync(path, source, "utf8");
for (const token of [
  'import { installKphxRunwayVisuals } from "./kphxRunwayVisuals.js";',
  "const runwayVisuals = await installKphxRunwayVisuals(THREE, authored);",
  "environment.userData.kphxRunwayCount",
  "environment.userData.kphxRunwayVisualDetailLevel",
]) {
  if (!source.includes(token)) throw new Error(`KPHX runway runtime preparation is missing ${token}`);
}
console.log("Prepared KPHX runway runtime: exact BGL runway surfaces, identifiers, thresholds and lights are installed.");
