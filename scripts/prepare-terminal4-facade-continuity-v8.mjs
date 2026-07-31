import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

function insertAfter(anchor, addition, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`${path}: missing ${label} anchor`);
  source = source.replace(anchor, `${anchor}\n${addition}`);
}

function replaceRequired(anchor, replacement, marker, label) {
  if (source.includes(marker)) return;
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
  "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
  "facade continuity authority",
);

for (const token of [
  "buildTerminal4FacadeContinuity",
  "const terminal4FacadeContinuity = buildTerminal4FacadeContinuity",
  "terminal4FacadeInfillCount += terminal4FacadeContinuity.userData.panelCount",
  "terminal4OpenServiceBayCount = 0",
  "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
]) {
  if (!source.includes(token)) throw new Error(`${path}: Terminal 4 facade continuity v8 is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-terminal4-lower-facade-skin-v9.mjs");
console.log("Prepared Terminal 4 facade continuity v8 plus source-shaped lower-facade skin v9: structural spans close gaps and the original low dark texture faces receive subtle concrete coverage.");
