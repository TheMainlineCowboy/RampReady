import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v4-inline-threshold";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// The earlier A1 facade preparer owns the actual restriction. This final pass runs
// immediately before Vite after every legacy Terminal 4 generator. Older variants
// left effectiveMinimumPreferredDot references in one resolver scope while its const
// declaration lived in another/nested scope, which built cleanly but crashed every
// browser path. Remove that derived runtime variable entirely: every guard now uses
// the A1-only threshold expression directly in the resolver scope.
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: origin-owned A1 facade cone authority is missing before final runtime normalization`);
}

const resolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!resolverMatch || !Number.isInteger(resolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver is missing`);
}
const resolverStart = resolverMatch.index;
const nextFunction = source.indexOf("\nfunction ", resolverStart + resolverMatch[0].length);
const resolverEnd = nextFunction >= 0 ? nextFunction : source.length;
let resolver = source.slice(resolverStart, resolverEnd);

const inlineThreshold = `((Math.hypot(
    originX - (-21.01),
    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),
  ) <= 0.75)
    ? Math.max(Number(minimumPreferredDot), 0.5)
    : Number(minimumPreferredDot))`;

// Remove every known generated declaration form before replacing remaining uses.
// The non-greedy block is bounded to the semicolon and only runs inside the resolver.
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, inlineThreshold);

if (resolver.includes("effectiveMinimumPreferredDot")) {
  throw new Error(`${path}: derived A1 facade threshold token survived inline normalization`);
}
if (!resolver.includes("Math.max(Number(minimumPreferredDot), 0.5)")) {
  throw new Error(`${path}: final resolver lost the A1-only 0.5 facade cone threshold`);
}

source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

// Re-read the final resolver and fail closed. There is deliberately no derived
// threshold variable anymore, so generation order cannot create an undeclared ref.
const finalResolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!finalResolverMatch || !Number.isInteger(finalResolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver vanished during normalization`);
}
const finalStart = finalResolverMatch.index;
const finalNext = source.indexOf("\nfunction ", finalStart + finalResolverMatch[0].length);
const finalEnd = finalNext >= 0 ? finalNext : source.length;
const finalResolver = source.slice(finalStart, finalEnd);
if (finalResolver.includes("effectiveMinimumPreferredDot")) {
  throw new Error(`${path}: undeclared derived A1 facade threshold survived final normalization`);
}
if (!finalResolver.includes("Math.max(Number(minimumPreferredDot), 0.5)")) {
  throw new Error(`${path}: inline A1 facade cone threshold is missing from final resolver`);
}
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: A1 origin-owned facade cone authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: inlined the resolver-local A1 facade threshold so no generation pass can leave an undeclared runtime variable, and removed the retired T4_WALK portal override.`);
