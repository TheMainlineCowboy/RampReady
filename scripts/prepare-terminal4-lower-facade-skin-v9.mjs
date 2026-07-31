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
  'import { buildTerminal4FacadeContinuity } from "./terminal4FacadeContinuityV8.js";',
  'import { buildTerminal4LowerFacadeSkin } from "./terminal4LowerFacadeSkinV9.js";',
  "buildTerminal4LowerFacadeSkin",
  "lower-facade skin import",
);

insertAfter(
  "  terminal4OpenServiceBayCount = 0;",
  `  const terminal4LowerFacadeSkin = buildTerminal4LowerFacadeSkin(THREE, terminal, materials);
  group.add(terminal4LowerFacadeSkin);
  terminal4FacadeInfillCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount;
  terminal4LowerFacadeFitCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount;`,
  "const terminal4LowerFacadeSkin = buildTerminal4LowerFacadeSkin",
  "lower-facade skin construction",
);

replaceRequired(
  '  group.userData.facadeInfillAuthority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";',
  '  group.userData.facadeInfillAuthority = "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans";',
  "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
  "lower-facade skin authority",
);

for (const token of [
  "buildTerminal4LowerFacadeSkin",
  "const terminal4LowerFacadeSkin = buildTerminal4LowerFacadeSkin",
  "terminal4FacadeInfillCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount",
  "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
]) {
  if (!source.includes(token)) throw new Error(`${path}: Terminal 4 lower-facade skin v9 is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared Terminal 4 lower-facade skin v9: copied source-shaped low vertical BGATE/DGATE/PHX faces receive subtle concrete instead of repeated oversized black rectangles.");
