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
  group.add(terminal4FacadeContinuity);
  terminal4FacadeInfillCount += terminal4FacadeContinuity.userData.panelCount;
  terminal4LowerFacadeFitCount += terminal4FacadeContinuity.userData.panelCount;
  terminal4OpenServiceBayCount = 0;`,
  "const terminal4FacadeContinuity = buildTerminal4FacadeContinuity",
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
  "terminal4FacadeInfillCount += terminal4FacadeContinuity.userData.panelCount",
  "terminal4OpenServiceBayCount = 0",
]) {
  if (!source.includes(token)) throw new Error(`${path}: Terminal 4 facade continuity v8 is missing ${token}`);
}
if (!hasMarker([
  "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
  "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
])) {
  throw new Error(`${path}: Terminal 4 facade continuity authority is missing`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-terminal4-lower-facade-skin-v9.mjs");
console.log("Prepared Terminal 4 facade continuity v8 plus source-shaped lower-facade skin v9 idempotently: V9 is accepted as the completed superset on runtime replay.");
