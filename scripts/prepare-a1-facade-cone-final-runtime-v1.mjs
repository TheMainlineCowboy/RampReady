import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const marker = "a1-final-runtime-facade-cone-v7-cast-or-radial-and-vertex-guard";
const originOwnedMarker = "a1-bgate1-preferred-facade-cone-v6-origin-owned";
let source = fs.readFileSync(path, "utf8");

// Last A1 wall-normalization pass before Vite. Earlier preparers may rewrite the
// resolver internals, so accept either a shared cast(direction) helper or an inlined
// radial search. A1 alone is restricted to the apron-facing +/-60 degree cone;
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

let directionalGuardInstalled = false;

// Preferred production shape: constrain the shared raycast helper itself. Every
// preferred/radial fallback ray passes through this boundary, so later changes to
// radial-loop spelling cannot reopen the wrong perpendicular A1 facade.
const castNeedle = "  const cast = (direction, far = 48) => {";
if (resolver.includes(castNeedle)) {
  resolver = resolver.replace(
    castNeedle,
    `${castNeedle}\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;`,
  );
  directionalGuardInstalled = true;
}

// Alternate generated shape: if cast() has been inlined, guard a recognizable
// radial direction declaration. Support both the historical angle spelling and
// direct sample expressions.
const radialPatterns = [
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\(angle\),\s*0,\s*Math\.cos\(angle\)\);)/m,
  /(^\s*const\s+direction\s*=\s*new THREE\.Vector3\(Math\.sin\([^\n]+\),\s*0,\s*Math\.cos\([^\n]+\)\);)/m,
];
for (const pattern of radialPatterns) {
  if (!pattern.test(resolver)) continue;
  resolver = resolver.replace(
    pattern,
    `$1\n    if (a1FinalOriginIsA1 && direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;`,
  );
  directionalGuardInstalled = true;
  break;
}
if (!directionalGuardInstalled) {
  throw new Error(`${path}: final resolver has neither a guardable cast boundary nor radial fallback direction`);
}

// The nearest-authored-vertex fallback can bypass raycasting entirely.
const distancePattern = /(^\s*const\s+distance\s*=\s*Math\.hypot\(dx,\s*dz\);)/m;
if (!distancePattern.test(resolver)) {
  throw new Error(`${path}: final resolver nearest-vertex distance anchor is missing`);
}
resolver = resolver.replace(
  distancePattern,
  `$1\n      if (a1FinalOriginIsA1 && distance > 0.05\n        && ((dx * preferred.x + dz * preferred.z) / distance) < a1FinalMinimumPreferredDot) continue;`,
);

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
const hasCastGuard = finalResolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) return null;");
const hasRadialGuard = finalResolver.includes("direction.dot(preferred) < a1FinalMinimumPreferredDot) continue;");
if (!hasCastGuard && !hasRadialGuard) {
  throw new Error(`${path}: final resolver lost its A1 directional facade-cone guard`);
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
console.log(`Prepared ${marker}: A1 facade ownership is constrained at the final raycast boundary or radial fallback plus nearest-vertex fallback; A3+ remain unrestricted and the retired T4_WALK override is absent.`);
