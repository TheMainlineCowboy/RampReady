import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v3-resolver-scope-repair";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// The earlier A1 facade preparer owns the actual restriction. This final pass runs
// after the legacy Terminal 4 generators, so it also repairs the resolver scope if
// one of those later passes preserved the cone guards but dropped their local
// effectiveMinimumPreferredDot declaration. That exact mismatch previously built
// cleanly and then crashed every browser evidence path at runtime.
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

const usesEffectiveThreshold = resolver.includes("effectiveMinimumPreferredDot");
const hasLocalThreshold = /const\s+effectiveMinimumPreferredDot\s*=/.test(resolver);
if (usesEffectiveThreshold && !hasLocalThreshold) {
  const preferredAnchor = "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();";
  if (!resolver.includes(preferredAnchor)) {
    throw new Error(`${path}: A1 facade cone guards survived but resolver-local preferred direction is missing`);
  }
  const thresholdBlock = `${preferredAnchor}\n  // ${marker}: restore the A1-only threshold in the resolver scope after all generators.\n  const a1OriginIsExactA1 = Math.hypot(\n    originX - (-21.01),\n    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),\n  ) <= 0.75;\n  const effectiveMinimumPreferredDot = a1OriginIsExactA1\n    ? Math.max(Number(minimumPreferredDot), 0.5)\n    : Number(minimumPreferredDot);`;
  resolver = resolver.replace(preferredAnchor, thresholdBlock);
  source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);
}

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

// Re-read only the final resolver and fail closed if guards can still reference an
// undeclared threshold. This is deliberately stronger than checking the whole file.
const finalResolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!finalResolverMatch || !Number.isInteger(finalResolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver vanished during normalization`);
}
const finalStart = finalResolverMatch.index;
const finalNext = source.indexOf("\nfunction ", finalStart + finalResolverMatch[0].length);
const finalEnd = finalNext >= 0 ? finalNext : source.length;
const finalResolver = source.slice(finalStart, finalEnd);
if (finalResolver.includes("effectiveMinimumPreferredDot") && !/const\s+effectiveMinimumPreferredDot\s*=/.test(finalResolver)) {
  throw new Error(`${path}: final A1 facade cone threshold is referenced outside its resolver declaration scope`);
}
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: A1 origin-owned facade cone authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: repaired the resolver-local A1 facade threshold after all generators and removed the retired T4_WALK portal override.`);
