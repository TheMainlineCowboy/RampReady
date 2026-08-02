import fs from "node:fs";

const skinPath = "src/environment/terminal4LowerFacadeSkinV9.js";
const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let skin = fs.readFileSync(skinPath, "utf8");
let jetways = fs.readFileSync(jetwayPath, "utf8");

// Source-first v25 supersedes this legacy production overlay. Do not recolor
// copied triangles, widen a generated skin to 220 metres, or retain generated
// door/vent details when the converted source terminal is authoritative.
if (jetways.includes("source-authored-terminal4-lower-facade-v25-no-overlay")) {
  for (const forbidden of [
    "source-shaped-broad-lower-facade-skin-v16",
    "source-wall-plus-broad-skin-sparse-doors-vents-no-synthetic-panels-v16",
    "source-shaped-broad-lower-facade-skin-v16-with-sparse-ramp-details",
  ]) {
    if (jetways.includes(forbidden)) throw new Error(`${jetwayPath}: legacy v16 facade overlay remains: ${forbidden}`);
  }
  console.log("Skipped Terminal 4 ramp facade v16 because source-only facade v25 is authoritative.");
  process.exit(0);
}

const skinMarker = "source-shaped-broad-lower-facade-skin-v16";
if (!skin.includes(skinMarker)) {
  const spanAnchor = "const LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS = 10;";
  if (!skin.includes(spanAnchor)) throw new Error(`${skinPath}: missing localized facade span anchor`);
  skin = skin.replace(
    spanAnchor,
    `// ${skinMarker}\n// Preserve broad source wall planes instead of exposing the same dark legacy\n// gate-bay atlas across every ramp module. The copied geometry remains the\n// supplied terminal topology; only its lower-wall daylight material changes.\nconst LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS = 220;`,
  );

  const rejectionCheck = `  if (rejectedOversizedTriangleCount < 1) {\n    throw new Error("Terminal 4 lower-facade skin did not reject any oversized legacy triangles");\n  }\n`;
  if (!skin.includes(rejectionCheck)) throw new Error(`${skinPath}: missing obsolete oversized-triangle assertion`);
  skin = skin.replace(rejectionCheck, "");

  const authorityAnchor = '  skin.userData.authority = "source-shaped-low-vertical-BGATE-DGATE-terminal-face-skin-v9-clipped-to-ramp-height";';
  if (!skin.includes(authorityAnchor)) throw new Error(`${skinPath}: missing lower-facade authority anchor`);
  skin = skin.replace(
    authorityAnchor,
    '  skin.userData.authority = "source-shaped-broad-low-vertical-terminal-face-skin-v16-clipped-to-ramp-height";',
  );
}

const oldSuppression = `  const syntheticFacadeChildren = [...terminal4FacadeContinuity.children]\n    .filter((child) => child.name !== "Terminal4_A3_SourceWallArchitecturalDetail_V11");\n  for (const child of syntheticFacadeChildren) terminal4FacadeContinuity.remove(child);`;
const newSuppression = `  const retainedSparseFacadeDetail = /Terminal 4 irregular (?:closed service door|lower facade vent)/i;\n  const syntheticFacadeChildren = [...terminal4FacadeContinuity.children]\n    .filter((child) => child.name !== "Terminal4_A3_SourceWallArchitecturalDetail_V11"\n      && !retainedSparseFacadeDetail.test(child.name || ""));\n  for (const child of syntheticFacadeChildren) terminal4FacadeContinuity.remove(child);`;
if (!jetways.includes("retainedSparseFacadeDetail")) {
  if (!jetways.includes(oldSuppression)) throw new Error(`${jetwayPath}: missing facade suppression anchor`);
  jetways = jetways.replace(oldSuppression, newSuppression);

  jetways = jetways
    .replace("  terminal4FacadeContinuity.userData.doorCount = 0;\n", "")
    .replace("  terminal4FacadeContinuity.userData.ventCount = 0;\n", "");

  const continuityAuthority = '  terminal4FacadeContinuity.userData.authority = "source-wall-plus-localized-skin-no-synthetic-span-panels-v12";';
  if (!jetways.includes(continuityAuthority)) throw new Error(`${jetwayPath}: missing facade continuity authority`);
  jetways = jetways.replace(
    continuityAuthority,
    '  terminal4FacadeContinuity.userData.authority = "source-wall-plus-broad-skin-sparse-doors-vents-no-synthetic-panels-v16";',
  );

  const fillAuthority = '  group.userData.facadeInfillAuthority = "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans";';
  if (!jetways.includes(fillAuthority)) throw new Error(`${jetwayPath}: missing facade fill authority`);
  jetways = jetways.replace(
    fillAuthority,
    '  group.userData.facadeInfillAuthority = "source-shaped-broad-lower-facade-skin-v16-with-sparse-ramp-details";',
  );
}

for (const token of [
  skinMarker,
  "LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS = 220",
  "source-shaped-broad-low-vertical-terminal-face-skin-v16-clipped-to-ramp-height",
  "retainedSparseFacadeDetail",
  "source-wall-plus-broad-skin-sparse-doors-vents-no-synthetic-panels-v16",
  "source-shaped-broad-lower-facade-skin-v16-with-sparse-ramp-details",
]) {
  if (!skin.includes(token) && !jetways.includes(token)) {
    throw new Error(`Terminal 4 ramp facade v16 is missing ${token}`);
  }
}

fs.writeFileSync(skinPath, skin, "utf8");
fs.writeFileSync(jetwayPath, jetways, "utf8");
console.log("Prepared Terminal 4 ramp facade v16: broad supplied wall planes receive daylight concrete while sparse service doors and vents remain, eliminating repeated dark gate bays without synthetic span panels.");
