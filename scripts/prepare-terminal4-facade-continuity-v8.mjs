import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

function hasMarker(marker) {
  return (Array.isArray(marker) ? marker : [marker]).some((candidate) => source.includes(candidate));
}

function insertAfter(anchor, addition, marker, label) {
  if (hasMarker(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
}

function replaceRequired(anchor, replacement, marker, label) {
  if (hasMarker(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, replacement);
}

insertAfter(
  'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";',
  'import { buildTerminal4FacadeContinuity } from "./terminal4FacadeContinuityV8.js";',
  "buildTerminal4FacadeContinuity",
  "facade continuity import",
);

insertAfter(
  "  group.add(animatedA1Jetway);",
  `  const terminal4FacadeContinuity = buildTerminal4FacadeContinuity(
    THREE,
    terminal,
    jetways,
    parkingByGate,
    materials,
    SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset,
  );
  const syntheticFacadeChildren = [...terminal4FacadeContinuity.children]
    .filter((child) => child.name !== "Terminal4_A3_SourceWallArchitecturalDetail_V11");
  for (const child of syntheticFacadeChildren) terminal4FacadeContinuity.remove(child);
  terminal4FacadeContinuity.userData.suppressedSyntheticChildCount = syntheticFacadeChildren.length;
  terminal4FacadeContinuity.userData.suppressedSyntheticPanelCount = terminal4FacadeContinuity.userData.panelCount;
  terminal4FacadeContinuity.userData.panelCount = 0;
  terminal4FacadeContinuity.userData.doorCount = 0;
  terminal4FacadeContinuity.userData.ventCount = 0;
  terminal4FacadeContinuity.userData.authority = "source-wall-plus-localized-skin-no-synthetic-span-panels-v12";
  transforms.facadeInfill.length = 0;
  transforms.facadeDoor.length = 0;
  transforms.facadeVent.length = 0;
  terminal4FacadeInfillCount = 0;
  terminal4LowerFacadeFitCount = 0;
  group.add(terminal4FacadeContinuity);
  terminal4OpenServiceBayCount = 0;`,
  "source-wall-plus-localized-skin-no-synthetic-span-panels-v12",
  "facade continuity construction",
);

replaceRequired(
  '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";',
  '  group.userData.facadeInfillAuthority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";',
  [
    "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
    "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
  ],
  "facade continuity authority",
);

for (const token of [
  "buildTerminal4FacadeContinuity",
  "const terminal4FacadeContinuity = buildTerminal4FacadeContinuity",
  "source-wall-plus-localized-skin-no-synthetic-span-panels-v12",
  "transforms.facadeInfill.length = 0",
  "transforms.facadeDoor.length = 0",
  "transforms.facadeVent.length = 0",
  "terminal4OpenServiceBayCount = 0",
]) {
  if (!source.includes(token)) throw new Error(`${path}: Terminal 4 facade continuity v12 cleanup is missing ${token}`);
}
if (!hasMarker([
  "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
  "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
])) {
  throw new Error(`${path}: Terminal 4 facade continuity authority is missing`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-terminal4-lower-facade-skin-v9.mjs");
console.log("Prepared Terminal 4 facade v12: authored wall and localized source-shaped skin remain active while duplicate legacy blocks and synthetic full-span panels are suppressed.");
