import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v2-preserve-origin-owned";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// The earlier A1 facade preparer now owns the restriction inside
// findTerminalWallConnection() from A1's exact decoded source origin. Do not
// rewrite a later terminalConnection call here: repeated Terminal 4 preparers
// legitimately change that call shape, and trying to patch one spelling has
// repeatedly aborted production before visual evidence can render.
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: origin-owned A1 facade cone authority is missing before final runtime normalization`);
}

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

// Fail closed on the two regressions this final pass is responsible for. The
// origin-owned preparer itself remains the sole owner of how A1 is identified
// and how its facade cone is applied; A3+ therefore keep their normal resolver.
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: A1 origin-owned facade cone authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: preserved the generation-order-safe origin-owned A1 facade cone and removed only the retired T4_WALK portal override.`);
