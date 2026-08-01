import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

// Source-first v25 intentionally leaves the converted Terminal 4 geometry and
// original materials as the final lower-facade authority. Earlier continuity
// passes generated a second structural span and then copied selected source
// triangles into a concrete-colored skin. Even when shaped from source faces,
// that was still an overlay and could make the ramp-level openings look cloned.
// Remove every continuity/skin hook and do not manufacture a replacement.
source = source
  .replace('import { buildTerminal4FacadeContinuity } from "./terminal4FacadeContinuityV8.js";\n', "")
  .replace('import { buildTerminal4LowerFacadeSkin } from "./terminal4LowerFacadeSkinV9.js";\n', "");

const continuityStart = source.indexOf("  const terminal4FacadeContinuity = buildTerminal4FacadeContinuity(");
if (continuityStart >= 0) {
  const continuityEndToken = "  terminal4OpenServiceBayCount = 0;";
  const continuityEnd = source.indexOf(continuityEndToken, continuityStart);
  if (continuityEnd < 0) throw new Error(`${path}: could not remove legacy facade continuity block`);
  source = `${source.slice(0, continuityStart)}${source.slice(continuityEnd + continuityEndToken.length + 1)}`;
}

const skinStart = source.indexOf("  const terminal4LowerFacadeSkin = buildTerminal4LowerFacadeSkin(");
if (skinStart >= 0) {
  const skinEndToken = "  terminal4LowerFacadeFitCount += terminal4LowerFacadeSkin.userData.sourceTriangleCount;";
  const skinEnd = source.indexOf(skinEndToken, skinStart);
  if (skinEnd < 0) throw new Error(`${path}: could not remove legacy lower-facade skin block`);
  source = `${source.slice(0, skinStart)}${source.slice(skinEnd + skinEndToken.length + 1)}`;
}

const authorityLine = '  group.userData.facadeInfillAuthority = "source-authored-terminal4-lower-facade-v25-no-overlay";';
const authorityPatterns = [
  /  group\.userData\.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";/,
  /  group\.userData\.facadeInfillAuthority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";/,
  /  group\.userData\.facadeInfillAuthority = "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans";/,
  /  group\.userData\.facadeInfillAuthority = "source-wall-plus-localized-skin-no-synthetic-span-panels-v12";/,
];
if (!source.includes(authorityLine)) {
  const matched = authorityPatterns.find((pattern) => pattern.test(source));
  if (!matched) throw new Error(`${path}: missing facade authority anchor`);
  source = source.replace(matched, authorityLine);
}

for (const forbidden of [
  "buildTerminal4FacadeContinuity",
  "buildTerminal4LowerFacadeSkin",
  "Terminal4FacadeContinuity",
  "terminal4LowerFacadeSkin",
  "source-wall-plus-localized-skin-no-synthetic-span-panels-v12",
  "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: lower-facade overlay remains: ${forbidden}`);
}
if (!source.includes("source-authored-terminal4-lower-facade-v25-no-overlay")) {
  throw new Error(`${path}: source-only lower-facade authority is missing`);
}

fs.writeFileSync(path, source, "utf8");
await import("./prepare-terminal4-source-facade-selection-v27.mjs");
await import("./prepare-terminal4-facade-splitter-runtime-v33.mjs");
await import("./prepare-terminal4-facade-variant-safety-v34.mjs");
await import("./prepare-terminal4-jetway-source-uv-v36.mjs");
await import("./prepare-terminal4-jetway-visual-upgrade-v35.mjs");
await import("./prepare-a1-terminal-portal-seal-v37.mjs");
console.log("Prepared Terminal 4 source-only facade and full jetway visual v37: package geometry remains authoritative, facade cells use safe source variants, exact M1DGJETWAY corrugation projects along each bridge, all jetways receive structural detail, and A1 visibly overlaps the measured T4_WALK terminal portal.");
