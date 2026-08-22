import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v8-preserve-origin-owned-and-vertex-guard";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// Last A1 wall-normalization pass before Vite. Earlier production preparers own the
// resolver's ray-search implementation and may inline or rewrite it. Do not require
// one transient cast/radial spelling here. Instead preserve the already-installed
// origin-owned A1 facade authority, restore the local A1 threshold used by any
// surviving guards, and independently constrain the nearest-authored-vertex fallback.
// A3+ remain unchanged because their threshold is -1.
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

const preferredNeedle = "  const preferred = new THREE.Vector3(preferredX, 0, preferredZ).normalize();";
if (!resolver.includes(preferredNeedle)) {
  throw new Error(`${path}: final resolver preferred-direction anchor is missing`);
}

resolver = resolver.replace(
  /\n\s*const\s+a1FinalOriginIsA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+a1FinalMinimumPreferredDot\s*=\s*a1FinalOriginIsA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(
  /\n\s*const\s+a1OriginIsExactA1\s*=\s*Math\.hypot\([\s\S]*?;\s*\n\s*const\s+effectiveMinimumPreferredDot\s*=\s*a1OriginIsExactA1[\s\S]*?;\s*/g,
  "\n",
);
resolver = resolver.replace(/\beffectiveMinimumPreferredDot\b/g, "a1FinalMinimumPreferredDot");

const finalLocalAuthority = `${preferredNeedle}\n  // ${marker}\n  const a1FinalOriginIsA1 = Math.hypot(\n    originX - (-21.01),\n    originZ - (-16.15 + Number(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2] || 0)),\n  ) <= 0.75;\n  const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;`;
resolver = resolver.replace(preferredNeedle, finalLocalAuthority);

// If a recognizable shared cast or radial fallback survives this late generation
// stage, reinforce it. Absence is not an error: the origin-owned v6 resolver may
// already have folded the cone into its own ray-search implementation.
const castNeedle = "  const cast = (direction, far = 48) => {";
if (resolver.includes(castNeedle)
  && !resolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;")) {
  resolver = resolver.replace(
    castNeedle,
    `${castNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;`,
  );
}

const radialPatterns = [
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\(angle\),\s*0,\s*Math\.cos\(angle\)\);)/m,
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\([^\n]+\),\s*0,\s*Math\.cos\([^\n]+\)\);)/m,
];
if (!resolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;")) {
  for (const pattern of radialPatterns) {
    if (!pattern.test(resolver)) continue;
    resolver = resolver.replace(
      pattern,
      `$1\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;`,
    );
    break;
  }
}

// The nearest-authored-vertex fallback can bypass raycasting entirely and therefore
// always receives an explicit A1 cone check at this final stage.
const distancePattern = /(^\s*const\s+distance\s*=\s*Math\.hypot\(dx,\s*dz\);)/m;
if (!distancePattern.test(resolver)) {
  throw new Error(`${path}: final resolver nearest-vertex distance anchor is missing`);
}
if (!resolver.includes("(dx * preferred.x + dz * preferred.z) / distance")) {
  resolver = resolver.replace(
    distancePattern,
    `$1\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
  );
}

source = source.slice(0, resolverStart) + resolver + source.slice(resolverEnd);

// A1 must never be redirected to the retired hard-coded T4_WALK portal.
source = source.replace(
  /\n\s*if \(jetway\.g === "A1"\) \{\s*const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\s*\}\);\s*\}/g,
  `\n    // ${marker}: preserve the authored apron-facing BGATE1 facade hit; no T4_WALK portal override.`,
);

const finalResolverMatch = source.match(/function findTerminalWallConnection\(([^)]*)\)\s*\{/);
if (!finalResolverMatch || !Number.isInteger(finalResolverMatch.index)) {
  throw new Error(`${path}: final Terminal 4 wall resolver vanished during normalization`);
}
const finalStart = finalResolverMatch.index;
const finalNext = source.indexOf("\nfunction ", finalStart + finalResolverMatch[0].length);
const finalEnd = finalNext >= 0 ? finalNext : source.length;
const finalResolver = source.slice(finalStart, finalEnd);
for (const required of [
  marker,
  "const a1FinalOriginIsA1 = Math.hypot(",
  "const a1FinalMinimumPreferredDot = a1FinalOriginIsA1 ? 0.5 : -1;",
  "(dx * preferred.x + dz * preferred.z) / distance",
]) {
  if (!finalResolver.includes(required)) {
    throw new Error(`${path}: final resolver lost required A1 facade-cone runtime guard: ${required}`);
  }
}
if (finalResolver.includes("effectiveMinimumPreferredDot")) {
  throw new Error(`${path}: stale derived A1 facade threshold survived final normalization`);
}
if (!source.includes(originOwnedMarker)) {
  throw new Error(`${path}: A1 origin-owned facade cone authority was lost`);
}
if (source.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${path}: wrong T4_WALK A1 override survived final runtime normalization`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: preserved the generation-order-safe origin-owned A1 facade cone, reinforced any recognizable ray fallback without requiring a transient implementation shape, guarded the nearest-vertex fallback, and kept A3+ unrestricted.`);
